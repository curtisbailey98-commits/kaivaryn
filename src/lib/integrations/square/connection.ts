/**
 * Square connection lifecycle for one organization: connect (code exchange), token refresh, disconnect (revoke + delete).
 * Stored on IntegrationConnection(provider "pos_square"). Tokens are sealed with secret-box (AES-256-GCM, fails closed
 * when no key is configured) and never logged, returned to the browser, or written to audit metadata.
 *
 * Honest status values:
 *   CONFIGURED       — Square access granted; no Square rows have arrived yet.
 *   CONNECTED        — at least one Square row has been stored for this workspace.
 *   NEEDS_ATTENTION  — Square rejected our access (expired/revoked) → reconnect.
 * Disconnect deletes the row (and with it every secret).
 */
import { prisma } from "@/lib/prisma";
import { openSecret, sealSecret } from "@/lib/secret-box";
import { writeAudit } from "@/lib/audit";
import { SQUARE_PROVIDER, SQUARE_SOURCE, getSquareConfig, squareConfigStatus, type SquareConfig, type SquareEnv } from "./config";
import { listLocations, obtainTokenFromCode, refreshAccessToken, retrieveMerchantName, revokeAccessToken, SquareApiError, type SquareLocation } from "./client";

export type StreamState = { doneUntil: string | null; pending?: { begin: string; end: string; cursor: string } | null };

export type SquareStored = {
  v: 1;
  env: SquareEnv;
  merchantId: string;
  merchantName: string | null;
  locations: SquareLocation[];
  tokens: { access: string; refresh: string | null; expiresAt: string | null };
  scopes: string[];
  connectedAt: string;
  connectedBy: string;
  streams: Record<string, StreamState>;
  lastSync?: { at: string; ok: boolean; created: number; updated: number; pages: number; complete: boolean; error?: string | null };
  lock?: { until: string } | null;
};

/** Refresh access tokens this long before Square's 30-day expiry. */
export const REFRESH_BEFORE_MS = 7 * 86_400_000;

export function parseStored(configJson: string | null | undefined): SquareStored | null {
  if (!configJson) return null;
  try {
    const j = JSON.parse(configJson) as SquareStored;
    return j && j.v === 1 && j.tokens?.access ? j : null;
  } catch {
    return null;
  }
}

export async function loadSquareConnection(organizationId: string) {
  const row = await prisma.integrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider: SQUARE_PROVIDER } } });
  return row ? { row, stored: parseStored(row.configJson) } : null;
}

export async function squareRowCount(organizationId: string) {
  return prisma.transaction.count({ where: { organizationId, source: SQUARE_SOURCE } });
}

/** Exchange the authorization code, look up the merchant + locations, store sealed tokens. Status CONFIGURED until rows arrive. */
export async function connectSquareFromCode(params: { organizationId: string; userId: string; code: string; cfg?: SquareConfig | null }) {
  const cfg = params.cfg ?? getSquareConfig();
  if (!cfg) throw new Error("not_enabled");
  const tok = await obtainTokenFromCode(cfg, params.code);
  if (!tok?.access_token || !tok.merchant_id) throw new Error("Square didn't return an access token.");
  const [merchantName, locations] = await Promise.all([
    retrieveMerchantName(cfg, tok.access_token, tok.merchant_id).catch(() => null),
    listLocations(cfg, tok.access_token),
  ]);
  const existing = await loadSquareConnection(params.organizationId);
  // Reconnecting the same Square account keeps sync progress; a different account starts fresh.
  const keepStreams = existing?.stored && existing.stored.merchantId === tok.merchant_id && existing.stored.env === cfg.env;
  const rows = await prisma.transaction.count({ where: { organizationId: params.organizationId, source: SQUARE_SOURCE } });
  const stored: SquareStored = {
    v: 1,
    env: cfg.env,
    merchantId: tok.merchant_id,
    merchantName,
    locations,
    tokens: { access: sealSecret(tok.access_token), refresh: tok.refresh_token ? sealSecret(tok.refresh_token) : null, expiresAt: tok.expires_at ?? null },
    scopes: ["MERCHANT_PROFILE_READ", "ORDERS_READ", "PAYMENTS_READ"],
    connectedAt: new Date().toISOString(),
    connectedBy: params.userId,
    streams: keepStreams ? existing!.stored!.streams : {},
    lastSync: keepStreams ? existing!.stored!.lastSync : undefined,
    lock: null,
  };
  const status = keepStreams && rows > 0 ? "CONNECTED" : "CONFIGURED";
  await prisma.integrationConnection.upsert({
    where: { organizationId_provider: { organizationId: params.organizationId, provider: SQUARE_PROVIDER } },
    update: { displayName: "Square", status, configJson: JSON.stringify(stored), errorMessage: null },
    create: { organizationId: params.organizationId, provider: SQUARE_PROVIDER, displayName: "Square", status, configJson: JSON.stringify(stored) },
  });
  await writeAudit({
    organizationId: params.organizationId, actorId: params.userId, action: "square.connected", entityType: "IntegrationConnection",
    metadata: { merchantId: tok.merchant_id, env: cfg.env, locations: locations.length },
  });
  return { merchantId: tok.merchant_id, merchantName, locations };
}

export async function markNeedsAttention(organizationId: string, message: string) {
  await prisma.integrationConnection.updateMany({
    where: { organizationId, provider: SQUARE_PROVIDER },
    data: { status: "NEEDS_ATTENTION", errorMessage: message.slice(0, 300) },
  });
}

/**
 * Return a usable access token, refreshing first if it expires within REFRESH_BEFORE_MS (or `force`).
 * Code-flow refresh tokens don't expire, so a failed refresh with an auth error means access was revoked.
 */
export async function ensureFreshAccessToken(organizationId: string, cfg: SquareConfig, opts: { force?: boolean; now?: Date } = {}): Promise<string> {
  const conn = await loadSquareConnection(organizationId);
  if (!conn?.stored) throw new Error("not_connected");
  const s = conn.stored;
  const now = opts.now ?? new Date();
  const exp = s.tokens.expiresAt ? new Date(s.tokens.expiresAt).getTime() : 0;
  const due = opts.force || !exp || exp - now.getTime() < REFRESH_BEFORE_MS;
  if (!due) return openSecret(s.tokens.access);
  if (!s.tokens.refresh) {
    await markNeedsAttention(organizationId, "Square access has expired. Reconnect Square to keep syncing.");
    throw new Error("needs_attention");
  }
  let tok;
  try {
    tok = await refreshAccessToken(cfg, openSecret(s.tokens.refresh));
  } catch (e) {
    if (e instanceof SquareApiError && (e.auth || e.status === 400)) {
      await markNeedsAttention(organizationId, "Square no longer accepts Kaivaryn's access (it may have been revoked). Reconnect Square.");
      throw new Error("needs_attention");
    }
    // Transient failure: keep using the current token while it is still valid.
    if (exp > now.getTime()) return openSecret(s.tokens.access);
    throw e;
  }
  if (!tok?.access_token) throw new Error("Square didn't return a refreshed token.");
  const next: SquareStored = {
    ...s,
    tokens: {
      access: sealSecret(tok.access_token),
      refresh: tok.refresh_token ? sealSecret(tok.refresh_token) : s.tokens.refresh,
      expiresAt: tok.expires_at ?? null,
    },
  };
  // Re-read so we don't clobber concurrent stream progress written since we loaded.
  const latest = await loadSquareConnection(organizationId);
  const merged = latest?.stored ? { ...latest.stored, tokens: next.tokens } : next;
  await prisma.integrationConnection.update({ where: { id: conn.row.id }, data: { configJson: JSON.stringify(merged) } });
  return tok.access_token;
}

/**
 * Revoke at Square (best effort) and delete the connection row with every secret. Synced rows stay.
 * If the workspace connected in a different Square environment (e.g. Sandbox) than the one Kaivaryn uses now,
 * the revoke is skipped — this server no longer holds that environment's app credentials, so it can't succeed.
 */
export async function disconnectSquare(organizationId: string, userId: string, cfgOverride?: SquareConfig | null) {
  const conn = await loadSquareConnection(organizationId);
  if (!conn) return { removed: false, revoked: false, envChanged: false, storedEnv: null as SquareEnv | null };
  let revoked = false;
  const cfg = cfgOverride ?? getSquareConfig();
  const storedEnv: SquareEnv | null = conn.stored?.env ?? null;
  const envChanged = Boolean(conn.stored && cfg && conn.stored.env !== cfg.env);
  if (conn.stored && cfg && !envChanged) {
    try {
      const r = await revokeAccessToken(cfg, openSecret(conn.stored.tokens.access));
      revoked = Boolean(r?.success);
    } catch {
      revoked = false;
    }
  }
  await prisma.integrationConnection.deleteMany({ where: { organizationId, provider: SQUARE_PROVIDER } });
  await writeAudit({
    organizationId, actorId: userId, action: "square.disconnected", entityType: "IntegrationConnection",
    metadata: { merchantId: conn.stored?.merchantId ?? null, revokedAtSquare: revoked, ...(envChanged ? { revokeSkipped: "environment_changed", storedEnv } : {}) },
  });
  return { removed: true, revoked, envChanged, storedEnv };
}

/** Shown when a workspace's stored Square connection is from a different environment than the live config. */
export function squareEnvChangedMessage(storedEnv: SquareEnv): string {
  return storedEnv === "sandbox"
    ? "This workspace is connected to Square Sandbox (test data). Kaivaryn now uses live Square, so reconnect Square to keep syncing."
    : "This workspace is connected to live Square, but Kaivaryn is now set to Square Sandbox (test data). Reconnect Square to keep syncing.";
}

export type SquareUiState = "not_enabled" | "not_connected" | "connected_waiting" | "connected" | "needs_attention";

export type SquareView = {
  state: SquareUiState;
  disabledReason: string | null;
  env: SquareEnv | null;
  merchantName: string | null;
  merchantId: string | null;
  locations: Array<{ id: string; name: string }>;
  locationTimezones: Record<string, string | undefined>;
  lastSyncAt: Date | null;
  lastSync: SquareStored["lastSync"] | null;
  rowsSynced: number;
  errorMessage: string | null;
};

/** What the integrations page shows. Counts come from real rows only. */
export async function getSquareView(organizationId: string, env: NodeJS.ProcessEnv = process.env): Promise<SquareView> {
  const cfgStatus = squareConfigStatus(env);
  const [conn, rows] = await Promise.all([loadSquareConnection(organizationId), squareRowCount(organizationId)]);
  const s = conn?.stored ?? null;
  let state: SquareUiState;
  // Display only (no DB write): a connection made in another Square environment can't sync with the live config.
  const envChanged = Boolean(s && cfgStatus.enabled && s.env !== cfgStatus.config.env);
  if (conn && s) {
    if (envChanged || conn.row.status === "NEEDS_ATTENTION") state = "needs_attention";
    else state = rows > 0 ? "connected" : "connected_waiting";
  } else {
    state = cfgStatus.enabled ? "not_connected" : "not_enabled";
  }
  return {
    state,
    disabledReason: cfgStatus.enabled ? null : cfgStatus.reason,
    env: s?.env ?? null,
    merchantName: s?.merchantName ?? null,
    merchantId: s?.merchantId ?? null,
    locations: (s?.locations ?? []).map((l) => ({ id: l.id, name: l.name || l.id })),
    locationTimezones: Object.fromEntries((s?.locations ?? []).map((l) => [l.id, l.timezone])),
    lastSyncAt: conn?.row.lastSyncAt ?? null,
    lastSync: s?.lastSync ?? null,
    rowsSynced: rows,
    errorMessage: envChanged && s ? squareEnvChangedMessage(s.env) : conn?.row.errorMessage ?? null,
  };
}
