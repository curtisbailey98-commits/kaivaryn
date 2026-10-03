/**
 * Webhook authentication + signed per-call workspace tokens.
 *
 * Webhooks: Vapi sends VAPI_WEBHOOK_SECRET in `X-Vapi-Secret` (configured as a saved server header on
 * assistants Kaivaryn creates). We also accept `Authorization: Bearer <secret>` and an optional
 * HMAC-SHA256 body signature (`X-Kaivaryn-Signature: sha256=<hex>`). Comparison is constant-time.
 * No secret configured → every webhook is refused (fail closed).
 *
 * Workspace tokens: when a signed-in user starts an in-app call, the server issues
 * `kv1.<payload>.<sig>` binding tenant, user, role, nonce, and expiry. Tool calls trust ONLY this
 * token (never a caller-supplied org id). The nonce is bound to the first provider call id that uses
 * it, so a token can't be replayed into a different call.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { TOOL_SESSION_TTL_SECONDS } from "./constants";

export function webhookSecret(): string | null {
  const s = process.env.VAPI_WEBHOOK_SECRET || "";
  return s.length >= 24 ? s : null;
}

function safeEq(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type WebhookAuth = { ok: true; method: "header" | "bearer" | "hmac" } | { ok: false; status: 401 | 503; reason: string };

export function verifyWebhook(headers: Headers, rawBody: string, secret: string | null = webhookSecret()): WebhookAuth {
  if (!secret) return { ok: false, status: 503, reason: "webhook_secret_not_configured" };
  const sig = headers.get("x-kaivaryn-signature");
  if (sig) {
    const want = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    return safeEq(sig, want) ? { ok: true, method: "hmac" } : { ok: false, status: 401, reason: "bad_signature" };
  }
  const header = headers.get("x-vapi-secret");
  if (header) return safeEq(header, secret) ? { ok: true, method: "header" } : { ok: false, status: 401, reason: "bad_secret" };
  const auth = headers.get("authorization");
  if (auth && /^Bearer\s+/i.test(auth)) {
    return safeEq(auth.replace(/^Bearer\s+/i, ""), secret) ? { ok: true, method: "bearer" } : { ok: false, status: 401, reason: "bad_secret" };
  }
  return { ok: false, status: 401, reason: "missing_credentials" };
}

function sessionKey(secret: string): Buffer {
  // Domain-separated key so a leaked session token can never double as the webhook secret.
  return createHmac("sha256", secret).update("kaivaryn-voice-session-v1").digest();
}

export type SessionClaims = { t: string; u: string; r: string; n: string; exp: number };

export function signSessionToken(claims: Omit<SessionClaims, "n" | "exp"> & { n?: string; exp?: number }, secret: string | null = webhookSecret()): { token: string; claims: SessionClaims } {
  if (!secret) throw new Error("Voice session signing is not configured");
  const full: SessionClaims = {
    t: claims.t,
    u: claims.u,
    r: claims.r,
    n: claims.n || randomBytes(16).toString("hex"),
    exp: claims.exp || Math.floor(Date.now() / 1000) + TOOL_SESSION_TTL_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = createHmac("sha256", sessionKey(secret)).update(payload).digest("base64url");
  return { token: `kv1.${payload}.${sig}`, claims: full };
}

export type SessionVerify = { ok: true; claims: SessionClaims } | { ok: false; reason: string };

export function verifySessionToken(token: unknown, secret: string | null = webhookSecret(), nowSec = Math.floor(Date.now() / 1000)): SessionVerify {
  if (!secret) return { ok: false, reason: "not_configured" };
  if (typeof token !== "string" || !token.startsWith("kv1.")) return { ok: false, reason: "missing_token" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [, payload, sig] = parts as [string, string, string];
  const want = createHmac("sha256", sessionKey(secret)).update(payload).digest("base64url");
  if (!safeEq(sig, want)) return { ok: false, reason: "bad_signature" };
  let claims: SessionClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaims;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!claims.t || !claims.u || !claims.n || typeof claims.exp !== "number") return { ok: false, reason: "malformed" };
  if (claims.exp < nowSec) return { ok: false, reason: "expired" };
  return { ok: true, claims };
}
