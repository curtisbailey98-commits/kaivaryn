/**
 * CSRF-safe OAuth `state` for the Square connection.
 * Signed (HMAC-SHA256, purpose-separated key) payload bound to org + user + a random nonce that is also
 * set as an httpOnly cookie on the browser that started the flow. Expires after 10 minutes.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const SQUARE_STATE_COOKIE = "kv_sq_oauth";
export const SQUARE_STATE_TTL_MS = 10 * 60_000;

type StatePayload = { p: "square"; o: string; u: string; n: string; exp: number };

function hmacKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for OAuth state signing.");
  return createHmac("sha256", secret).update("kaivaryn:square-oauth-state:v1").digest();
}

export function signSquareState(organizationId: string, userId: string, now = Date.now()) {
  const nonce = randomBytes(18).toString("base64url");
  const payload: StatePayload = { p: "square", o: organizationId, u: userId, n: nonce, exp: now + SQUARE_STATE_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", hmacKey()).update(body).digest("base64url");
  return { state: `${body}.${sig}`, nonce };
}

export type VerifiedSquareState = { organizationId: string; userId: string };

/** Throws on any mismatch. `expected` is the signed-in user's org + id at callback time. */
export function verifySquareState(raw: string, cookieNonce: string | null | undefined, expected: { organizationId: string | null; userId: string }, now = Date.now()): VerifiedSquareState {
  const [body, sig] = String(raw || "").split(".");
  if (!body || !sig) throw new Error("invalid_state");
  const want = createHmac("sha256", hmacKey()).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (want.length !== got.length || !timingSafeEqual(want, got)) throw new Error("invalid_state");
  let p: StatePayload;
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
  } catch {
    throw new Error("invalid_state");
  }
  if (p.p !== "square" || !p.o || !p.u || !p.n || typeof p.exp !== "number") throw new Error("invalid_state");
  if (p.exp < now) throw new Error("expired_state");
  const a = Buffer.from(String(cookieNonce || ""));
  const b = Buffer.from(p.n);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("state_browser_mismatch");
  if (p.u !== expected.userId || p.o !== expected.organizationId) throw new Error("state_session_mismatch");
  return { organizationId: p.o, userId: p.u };
}
