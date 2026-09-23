import { createHmac, timingSafeEqual } from "crypto";

function secret() {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("NEXTAUTH_SECRET is required for OAuth state signing.");
  return value;
}

export function signAcquisitionOAuthState(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 10 * 60_000 }), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAcquisitionOAuthState(value: string) {
  const [payload, sig] = value.split(".");
  if (!payload || !sig) throw new Error("Invalid OAuth state.");
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(sig, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error("Invalid OAuth state signature.");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId: string; exp: number };
  if (!decoded.userId || decoded.exp < Date.now()) throw new Error("Expired OAuth state.");
  return decoded;
}
