/**
 * Read-only Square sync: payments, refunds and orders per location → Transaction rows.
 * - First run backfills SQUARE_BACKFILL_DAYS (default 90, clamped 30–90); later runs are incremental from each
 *   stream's last completed window (re-reading a small overlap — upserts make that harmless).
 * - Paginated with Square cursors; a per-run page budget keeps scheduled ticks short. An unfinished window is saved
 *   (begin, end, cursor) and resumed next run with the identical query, as Square's pagination requires.
 * - Idempotent: rows are keyed by (organizationId, source "square", sourceId "payment:<id>" | "refund:<id>" | "order:<id>").
 * - One sync per workspace at a time (optimistic lock on the connection row).
 * Never writes recovered/realized amounts — POS data only feeds estimates.
 */
import { prisma } from "@/lib/prisma";
import { SQUARE_PROVIDER, SQUARE_SOURCE, getSquareConfig, type SquareConfig } from "./config";
import { listLocations, listPaymentsPage, listRefundsPage, pageDelay, searchOrdersPage, SquareApiError } from "./client";
import { ensureFreshAccessToken, loadSquareConnection, markNeedsAttention, parseStored, type SquareStored, type StreamState } from "./connection";
import { mapOrder, mapPayment, mapRefund, type MappedTxn } from "./mapping";

export const OVERLAP_MS = 15 * 60_000;
const LOCK_MS = 5 * 60_000;

export function backfillDays(env: NodeJS.ProcessEnv = process.env) {
  const n = Number(env.SQUARE_BACKFILL_DAYS || 90);
  return Math.min(90, Math.max(30, Number.isFinite(n) ? Math.round(n) : 90));
}

export type SquareSyncResult = {
  ok: boolean;
  skipped?: "not_enabled" | "not_connected" | "locked" | "needs_attention";
  created: number;
  updated: number;
  pages: number;
  complete: boolean;
  error?: string;
};

/** Upsert one mapped row for this org. Returns "created" | "updated" | "same". */
export async function upsertTxn(organizationId: string, m: MappedTxn, now = new Date()): Promise<"created" | "updated" | "same"> {
  const detailJson = JSON.stringify(m.detail);
  const existing = await prisma.transaction.findFirst({ where: { organizationId, source: m.source, sourceId: m.sourceId }, select: { id: true, status: true, amount: true, detailJson: true, occurredAt: true, locationId: true } });
  if (!existing) {
    await prisma.transaction.create({
      data: { organizationId, type: m.type, status: m.status, amount: m.amount, currency: m.currency, occurredAt: m.occurredAt, source: m.source, sourceId: m.sourceId, locationId: m.locationId, detailJson, importedAt: now, lastSyncAt: now },
    });
    return "created";
  }
  const changed = existing.status !== m.status || Math.abs(existing.amount - m.amount) > 0.0001 || existing.detailJson !== detailJson || existing.locationId !== m.locationId || existing.occurredAt.getTime() !== m.occurredAt.getTime();
  await prisma.transaction.update({
    where: { id: existing.id },
    data: changed ? { status: m.status, amount: m.amount, currency: m.currency, occurredAt: m.occurredAt, locationId: m.locationId, detailJson, lastSyncAt: now } : { lastSyncAt: now },
  });
  return changed ? "updated" : "same";
}

async function claimLock(organizationId: string, now: Date): Promise<{ id: string; stored: SquareStored } | null> {
  const conn = await loadSquareConnection(organizationId);
  if (!conn?.stored) return null;
  const s = conn.stored;
  if (s.lock?.until && new Date(s.lock.until).getTime() > now.getTime()) return null;
  const next: SquareStored = { ...s, lock: { until: new Date(now.getTime() + LOCK_MS).toISOString() } };
  const r = await prisma.integrationConnection.updateMany({ where: { id: conn.row.id, updatedAt: conn.row.updatedAt }, data: { configJson: JSON.stringify(next) } });
  return r.count === 1 ? { id: conn.row.id, stored: next } : null;
}

async function saveProgress(id: string, mutate: (s: SquareStored) => SquareStored, extra: { status?: string; errorMessage?: string | null; lastSyncAt?: Date } = {}) {
  const row = await prisma.integrationConnection.findUnique({ where: { id } });
  const s = parseStored(row?.configJson);
  if (!row || !s) return; // disconnected mid-sync: nothing to save (and no secrets to keep)
  await prisma.integrationConnection.update({ where: { id }, data: { configJson: JSON.stringify(mutate(s)), ...extra } });
}

type Fetcher = (token: string, q: { begin: string; end: string; cursor?: string | null }) => Promise<{ items: MappedTxn[]; cursor?: string }>;

/**
 * Sync one organization. `pageBudget` bounds Square calls per run (resumes next run).
 * `cfg` / `now` are injectable for tests.
 */
export async function syncSquareForOrg(organizationId: string, opts: { pageBudget?: number; cfg?: SquareConfig | null; now?: Date } = {}): Promise<SquareSyncResult> {
  const cfg = opts.cfg === undefined ? getSquareConfig() : opts.cfg;
  const empty = { created: 0, updated: 0, pages: 0, complete: false };
  if (!cfg) return { ok: false, skipped: "not_enabled", ...empty };
  const now = opts.now ?? new Date();
  const pre = await loadSquareConnection(organizationId);
  if (!pre?.stored) return { ok: false, skipped: "not_connected", ...empty };
  if (pre.row.status === "NEEDS_ATTENTION") return { ok: false, skipped: "needs_attention", ...empty };
  if (pre.stored.env !== cfg.env) return { ok: false, skipped: "not_enabled", ...empty, error: "Square environment changed since this workspace connected. Reconnect Square." };
  const claim = await claimLock(organizationId, now);
  if (!claim) return { ok: false, skipped: "locked", ...empty };

  let budget = Math.max(1, opts.pageBudget ?? 60);
  let created = 0;
  let updated = 0;
  let pages = 0;
  let complete = true;
  const streams: Record<string, StreamState> = { ...(claim.stored.streams || {}) };
  let locations = claim.stored.locations || [];
  const nowIso = now.toISOString();
  const backfillStart = new Date(now.getTime() - backfillDays() * 86_400_000).toISOString();

  let token: string;
  try {
    token = await ensureFreshAccessToken(organizationId, cfg, { now });
  } catch (e) {
    await saveProgress(claim.id, (s) => ({ ...s, lock: null }));
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, skipped: msg === "needs_attention" ? "needs_attention" : undefined, ...empty, error: msg === "needs_attention" ? undefined : msg };
  }

  // Square call with one forced refresh on an auth error (token may have been rotated or expired early).
  let refreshed = false;
  async function call<T>(fn: (t: string) => Promise<T>): Promise<T> {
    try {
      return await fn(token);
    } catch (e) {
      if (e instanceof SquareApiError && e.auth && !refreshed) {
        refreshed = true;
        token = await ensureFreshAccessToken(organizationId, cfg!, { force: true, now });
        return fn(token);
      }
      throw e;
    }
  }

  try {
    try {
      const fresh = await call((t) => listLocations(cfg, t));
      if (fresh.length) locations = fresh;
    } catch (e) {
      if (e instanceof SquareApiError && e.auth) throw e;
      // keep the stored list on a transient error
    }
    const active = locations.filter((l) => !l.status || l.status === "ACTIVE");
    const plans: Array<{ key: string; fetch: Fetcher }> = [];
    for (const loc of active) {
      plans.push({ key: `payments:${loc.id}`, fetch: async (t, q) => { const r = await listPaymentsPage(cfg, t, { locationId: loc.id, ...q }); return { items: (r.payments || []).map(mapPayment), cursor: r.cursor }; } });
      plans.push({ key: `refunds:${loc.id}`, fetch: async (t, q) => { const r = await listRefundsPage(cfg, t, { locationId: loc.id, ...q }); return { items: (r.refunds || []).map(mapRefund), cursor: r.cursor }; } });
      plans.push({ key: `orders:${loc.id}`, fetch: async (t, q) => { const r = await searchOrdersPage(cfg, t, { locationIds: [loc.id], ...q }); return { items: (r.orders || []).map(mapOrder), cursor: r.cursor }; } });
    }

    // Fairness when the page budget is smaller than the work: unfinished windows first, then never-synced streams,
    // then incremental streams with the oldest progress — so no location starves behind another.
    const rank = (k: string) => {
      const st = streams[k];
      if (st?.pending) return 0;
      if (!st?.doneUntil) return 1;
      return 2;
    };
    plans.sort((x, y) => rank(x.key) - rank(y.key) || String(streams[x.key]?.doneUntil ?? "").localeCompare(String(streams[y.key]?.doneUntil ?? "")));

    for (const plan of plans) {
      if (budget <= 0) { complete = false; break; }
      const st: StreamState = streams[plan.key] ?? { doneUntil: null };
      const begin = st.pending?.begin ?? (st.doneUntil ? new Date(new Date(st.doneUntil).getTime() - OVERLAP_MS).toISOString() : backfillStart);
      const end = st.pending?.end ?? nowIso;
      let cursor: string | null = st.pending?.cursor ?? null;
      let finished = false;
      while (budget > 0) {
        const page = await call((t) => plan.fetch(t, { begin, end, cursor }));
        budget--;
        pages++;
        for (const m of page.items) {
          const r = await upsertTxn(organizationId, m, now);
          if (r === "created") created++;
          else if (r === "updated") updated++;
        }
        cursor = page.cursor || null;
        if (!cursor) { finished = true; break; }
        await pageDelay();
      }
      streams[plan.key] = finished ? { doneUntil: end, pending: null } : { doneUntil: st.doneUntil, pending: { begin, end, cursor: cursor as string } };
      if (!finished) complete = false;
      // Persist after every stream so a crash never loses finished work.
      await saveProgress(claim.id, (s) => ({ ...s, streams: { ...s.streams, [plan.key]: streams[plan.key] }, locations }));
    }

    const rows = await prisma.transaction.count({ where: { organizationId, source: SQUARE_SOURCE } });
    await saveProgress(
      claim.id,
      (s) => ({ ...s, locations, streams: { ...s.streams, ...streams }, lock: null, lastSync: { at: nowIso, ok: true, created, updated, pages, complete, error: null } }),
      { status: rows > 0 ? "CONNECTED" : "CONFIGURED", errorMessage: null, lastSyncAt: now },
    );
    return { ok: true, created, updated, pages, complete };
  } catch (e) {
    const auth = (e instanceof SquareApiError && e.auth) || (e instanceof Error && e.message === "needs_attention");
    const msg = e instanceof Error ? e.message : String(e);
    await saveProgress(claim.id, (s) => ({ ...s, locations, streams: { ...s.streams, ...streams }, lock: null, lastSync: { at: nowIso, ok: false, created, updated, pages, complete: false, error: msg.slice(0, 200) } }), auth ? {} : { errorMessage: `Last Square sync failed: ${msg}`.slice(0, 300) });
    if (auth) {
      await markNeedsAttention(organizationId, "Square no longer accepts Kaivaryn's access (expired or revoked). Reconnect Square.");
      return { ok: false, skipped: "needs_attention", created, updated, pages, complete: false };
    }
    return { ok: false, created, updated, pages, complete: false, error: msg };
  }
}

/** Scheduled tick: every connected workspace, isolated per org. */
export async function syncAllSquare(opts: { pageBudgetPerOrg?: number } = {}) {
  const cfg = getSquareConfig();
  if (!cfg) return { configured: false as const, organizations: 0, created: 0, updated: 0, errors: 0 };
  const conns = await prisma.integrationConnection.findMany({ where: { provider: SQUARE_PROVIDER, status: { in: ["CONFIGURED", "CONNECTED"] } }, select: { organizationId: true } });
  let created = 0, updated = 0, errors = 0;
  for (const c of conns) {
    try {
      const r = await syncSquareForOrg(c.organizationId, { pageBudget: opts.pageBudgetPerOrg ?? 40, cfg });
      created += r.created;
      updated += r.updated;
      if (!r.ok && !r.skipped) errors++;
    } catch {
      errors++;
    }
  }
  return { configured: true as const, organizations: conns.length, created, updated, errors };
}
