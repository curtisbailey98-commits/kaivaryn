/**
 * Inbound API / webhook — a per-organization key that lets a system push records into Kaivaryn.
 * The key embeds its connection id; only a SHA-256 hash is stored and it is shown once.
 * The organization is derived from the verified key, never from the request body.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

export const INBOUND_PROVIDER = "inbound_api";
const TOKEN_RE = /^kvi_([a-z0-9]{10,40})_([A-Za-z0-9_-]{24,64})$/;

type InboundConfig = { tokenHash?: string; hint?: string; issuedAt?: string; issuedById?: string | null; revokedAt?: string };

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function readConfig(raw: string | null | undefined): InboundConfig {
  try {
    return raw ? (JSON.parse(raw) as InboundConfig) : {};
  } catch {
    return {};
  }
}

export async function getInboundConnection(organizationId: string) {
  const row = await prisma.integrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider: INBOUND_PROVIDER } } });
  if (!row) return null;
  const cfg = readConfig(row.configJson);
  return { id: row.id, status: row.status, lastSyncAt: row.lastSyncAt, hasKey: Boolean(cfg.tokenHash), hint: cfg.hint ?? null, issuedAt: cfg.issuedAt ?? null };
}

/** Issue (or rotate) the org's inbound key. Returns the plaintext key exactly once. */
export async function issueInboundToken(organizationId: string, userId: string | null) {
  const conn = await prisma.integrationConnection.upsert({
    where: { organizationId_provider: { organizationId, provider: INBOUND_PROVIDER } },
    update: {},
    create: { organizationId, provider: INBOUND_PROVIDER, displayName: "Inbound API / webhook", status: "AVAILABLE" },
  });
  const token = `kvi_${conn.id}_${randomBytes(24).toString("base64url")}`;
  const cfg: InboundConfig = { tokenHash: sha256(token), hint: token.slice(-4), issuedAt: new Date().toISOString(), issuedById: userId };
  const rotated = Boolean(readConfig(conn.configJson).tokenHash);
  await prisma.integrationConnection.update({ where: { id: conn.id }, data: { configJson: JSON.stringify(cfg), errorMessage: null } });
  await writeAudit({ organizationId, actorId: userId, action: rotated ? "inbound_key.rotated" : "inbound_key.issued", entityType: "IntegrationConnection", entityId: conn.id, metadata: { hint: cfg.hint } });
  return { token, hint: cfg.hint!, connectionId: conn.id };
}

export async function revokeInboundToken(organizationId: string, userId: string | null) {
  const conn = await prisma.integrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider: INBOUND_PROVIDER } } });
  if (!conn) return false;
  await prisma.integrationConnection.update({ where: { id: conn.id }, data: { configJson: JSON.stringify({ revokedAt: new Date().toISOString() }), status: "AVAILABLE" } });
  await writeAudit({ organizationId, actorId: userId, action: "inbound_key.revoked", entityType: "IntegrationConnection", entityId: conn.id });
  return true;
}

/** Verify a presented key. Returns the owning organization or null (constant-time hash compare). */
export async function verifyInboundToken(presented: string | null | undefined): Promise<{ organizationId: string; connectionId: string } | null> {
  const token = String(presented || "").replace(/^Bearer\s+/i, "").trim();
  const m = token.match(TOKEN_RE);
  if (!m) return null;
  const conn = await prisma.integrationConnection.findUnique({ where: { id: m[1]! } });
  if (!conn || conn.provider !== INBOUND_PROVIDER) return null;
  const cfg = readConfig(conn.configJson);
  if (!cfg.tokenHash) return null;
  const a = Buffer.from(sha256(token), "hex");
  const b = Buffer.from(cfg.tokenHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { organizationId: conn.organizationId, connectionId: conn.id };
}
