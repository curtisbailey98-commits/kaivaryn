/**
 * Restaurant signals from synced Square rows — computed only from real rows, never invented.
 * - Daily sales by location, payment tenders, discounts vs comps, refunds, voids.
 * - Spike signals compare the latest 30 days with the same restaurant's own prior 60 days (its baseline).
 *   The dollar figure is an ESTIMATE (excess rate × recent gross sales) and only ever becomes an estimated
 *   opportunity — never recovered money.
 */
import { prisma } from "@/lib/prisma";
import { SQUARE_SOURCE } from "./config";

export type PosRow = { type: string; status: string; amount: number; occurredAt: Date; locationId: string | null; detailJson: string | null };

const r2 = (n: number) => Math.round(n * 100) / 100;
function detail(row: PosRow): Record<string, unknown> {
  try { return row.detailJson ? (JSON.parse(row.detailJson) as Record<string, unknown>) : {}; } catch { return {}; }
}
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Calendar day in the location's own time zone (falls back to UTC). */
export function localDay(d: Date, tz?: string | null) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export type PosWindowTotals = { orders: number; netSales: number; grossSales: number; discounts: number; comps: number; voids: number; refunds: number; refundCount: number };

export function windowTotals(rows: PosRow[], from: Date, to: Date): PosWindowTotals {
  const t: PosWindowTotals = { orders: 0, netSales: 0, grossSales: 0, discounts: 0, comps: 0, voids: 0, refunds: 0, refundCount: 0 };
  for (const row of rows) {
    if (row.occurredAt < from || row.occurredAt >= to) continue;
    if (row.type === "ORDER") {
      if (row.status === "VOIDED") { t.voids++; continue; }
      if (row.status !== "SUCCEEDED") continue;
      const d = detail(row);
      t.orders++;
      t.netSales += row.amount;
      t.grossSales += num(d.gross);
      t.discounts += num(d.discounts);
      t.comps += num(d.comps);
    } else if (row.type === "REFUND" && row.status === "SUCCEEDED") {
      t.refunds += row.amount;
      t.refundCount++;
    }
  }
  return { ...t, netSales: r2(t.netSales), grossSales: r2(t.grossSales), discounts: r2(t.discounts), comps: r2(t.comps), refunds: r2(t.refunds) };
}

export type PosSummary = {
  days: number;
  totals: PosWindowTotals;
  byDay: Array<{ day: string; locationId: string; locationName: string; orders: number; netSales: number }>;
  tenders: Array<{ tender: string; count: number; amount: number }>;
  firstAt: Date | null;
  lastAt: Date | null;
};

export function buildPosSummary(rows: PosRow[], locations: Array<{ id: string; name?: string; timezone?: string }>, now = new Date(), days = 30): PosSummary {
  const from = new Date(now.getTime() - days * 86_400_000);
  const loc = new Map(locations.map((l) => [l.id, l]));
  const byDay = new Map<string, { day: string; locationId: string; locationName: string; orders: number; netSales: number }>();
  const tenders = new Map<string, { tender: string; count: number; amount: number }>();
  let firstAt: Date | null = null;
  let lastAt: Date | null = null;
  for (const row of rows) {
    if (!firstAt || row.occurredAt < firstAt) firstAt = row.occurredAt;
    if (!lastAt || row.occurredAt > lastAt) lastAt = row.occurredAt;
    if (row.occurredAt < from || row.occurredAt > now) continue;
    if (row.type === "ORDER" && row.status === "SUCCEEDED") {
      const l = row.locationId ? loc.get(row.locationId) : undefined;
      const day = localDay(row.occurredAt, l?.timezone);
      const key = `${day}|${row.locationId ?? ""}`;
      const cur = byDay.get(key) ?? { day, locationId: row.locationId ?? "", locationName: l?.name || row.locationId || "Unknown location", orders: 0, netSales: 0 };
      cur.orders++;
      cur.netSales = r2(cur.netSales + row.amount);
      byDay.set(key, cur);
    }
    if (row.type === "PAYMENT" && row.status === "SUCCEEDED") {
      const tender = String(detail(row).tender || "OTHER");
      const cur = tenders.get(tender) ?? { tender, count: 0, amount: 0 };
      cur.count++;
      cur.amount = r2(cur.amount + row.amount);
      tenders.set(tender, cur);
    }
  }
  return {
    days,
    totals: windowTotals(rows, from, new Date(now.getTime() + 1)),
    byDay: Array.from(byDay.values()).sort((a, b) => (a.day === b.day ? a.locationName.localeCompare(b.locationName) : b.day.localeCompare(a.day))),
    tenders: Array.from(tenders.values()).sort((a, b) => b.amount - a.amount),
    firstAt,
    lastAt,
  };
}

export async function getPosSummary(organizationId: string, locations: Array<{ id: string; name?: string; timezone?: string }>, now = new Date(), days = 30) {
  const rows = await prisma.transaction.findMany({
    where: { organizationId, source: SQUARE_SOURCE, occurredAt: { gte: new Date(now.getTime() - days * 86_400_000) } },
    select: { type: true, status: true, amount: true, occurredAt: true, locationId: true, detailJson: true },
  });
  return buildPosSummary(rows, locations, now, days);
}

export type PosSignal = {
  ruleId: "square_comps_discounts" | "square_refunds";
  periodKey: string;
  title: string;
  description: string;
  evidence: string;
  estimate: number;
};

/** Minimum data before any signal: 60 days of history before the recent window, and enough orders in both windows. */
export const SIGNAL_RULES = { recentDays: 30, baselineDays: 60, minRecentOrders: 100, minBaselineOrders: 150, minRateDeltaPts: 2, minEstimate: 250 };

export function detectPosSignals(rows: PosRow[], now = new Date()): { signals: PosSignal[]; insufficient: string | null } {
  const R = SIGNAL_RULES;
  const recentFrom = new Date(now.getTime() - R.recentDays * 86_400_000);
  const baseFrom = new Date(recentFrom.getTime() - R.baselineDays * 86_400_000);
  const recent = windowTotals(rows, recentFrom, new Date(now.getTime() + 1));
  const base = windowTotals(rows, baseFrom, recentFrom);
  const earliest = rows.reduce<Date | null>((m, r) => (!m || r.occurredAt < m ? r.occurredAt : m), null);
  if (!earliest || earliest > new Date(baseFrom.getTime() + 7 * 86_400_000) || recent.orders < R.minRecentOrders || base.orders < R.minBaselineOrders || recent.grossSales <= 0 || base.grossSales <= 0) {
    return { signals: [], insufficient: "pos signals: need ~90 days of Square orders (30-day window + 60-day baseline)" };
  }
  // One signal per rule per calendar month, so repeated detection runs never stack duplicates.
  const periodKey = localDay(now).slice(0, 7);
  const out: PosSignal[] = [];
  const rate = (x: number, of: number) => (of > 0 ? x / of : 0);
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  const recentCD = rate(recent.discounts + recent.comps, recent.grossSales);
  const baseCD = rate(base.discounts + base.comps, base.grossSales);
  const cdEstimate = r2((recentCD - baseCD) * recent.grossSales);
  if ((recentCD - baseCD) * 100 >= R.minRateDeltaPts && cdEstimate >= R.minEstimate) {
    out.push({
      ruleId: "square_comps_discounts",
      periodKey,
      title: `Comps & discounts above your usual rate (last ${R.recentDays} days)`,
      description: `Square shows comps + discounts at ${pct(recentCD)} of gross sales in the last ${R.recentDays} days vs ${pct(baseCD)} over the prior ${R.baselineDays} days (comps $${recent.comps.toFixed(2)}, discounts $${recent.discounts.toFixed(2)} on $${recent.grossSales.toFixed(2)} gross). Estimate = the extra rate × recent gross sales. It's an estimate, not money recovered.`,
      evidence: `square comps+discounts ${pct(recentCD)} vs baseline ${pct(baseCD)}; gross ${recent.grossSales.toFixed(2)}`,
      estimate: cdEstimate,
    });
  }
  const recentRf = rate(recent.refunds, recent.netSales);
  const baseRf = rate(base.refunds, base.netSales);
  const rfEstimate = r2((recentRf - baseRf) * recent.netSales);
  if ((recentRf - baseRf) * 100 >= R.minRateDeltaPts && rfEstimate >= R.minEstimate) {
    out.push({
      ruleId: "square_refunds",
      periodKey,
      title: `Refunds above your usual rate (last ${R.recentDays} days)`,
      description: `Square shows refunds at ${pct(recentRf)} of net sales in the last ${R.recentDays} days vs ${pct(baseRf)} over the prior ${R.baselineDays} days ($${recent.refunds.toFixed(2)} across ${recent.refundCount} refunds; ${recent.voids} voided orders). Estimate = the extra rate × recent net sales. It's an estimate, not money recovered.`,
      evidence: `square refunds ${pct(recentRf)} vs baseline ${pct(baseRf)}; net ${recent.netSales.toFixed(2)}`,
      estimate: rfEstimate,
    });
  }
  return { signals: out, insufficient: null };
}
