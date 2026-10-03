/**
 * Server-only Vapi client. The private key is read from VAPI_PRIVATE_KEY at call time and is never
 * logged, returned, or sent to the browser. Browsers receive only short-lived, public-scoped JWTs
 * restricted to one assistant and Kaivaryn's origins (minted here from the private key).
 */
import { createHmac } from "crypto";
import { protectedAssistantIds, WEB_TOKEN_TTL_SECONDS } from "./constants";

const BASE = process.env.VAPI_API_BASE || "https://api.vapi.ai";

export type FetchLike = typeof fetch;

export class VapiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function vapiConfigured(): boolean {
  return Boolean(process.env.VAPI_PRIVATE_KEY && process.env.VAPI_PRIVATE_KEY.length >= 16);
}

function key(): string {
  const k = process.env.VAPI_PRIVATE_KEY;
  if (!k) throw new VapiError("Voice provider is not configured", 503);
  return k;
}

async function req<T>(path: string, init: RequestInit = {}, f: FetchLike = fetch): Promise<T> {
  const res = await f(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${key()}`, ...(init.headers || {}) },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    // Provider error bodies never contain our key; still, keep only a short message.
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      msg = Array.isArray(j.message) ? j.message.join("; ") : String(j.message || j.error || msg);
    } catch { /* keep text */ }
    throw new VapiError(`Vapi ${init.method || "GET"} ${path.split("?")[0]} failed (${res.status}): ${msg.slice(0, 300)}`, res.status);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export type VapiCall = {
  id: string;
  orgId?: string;
  type?: string; // inboundPhoneCall | outboundPhoneCall | webCall
  status?: string;
  assistantId?: string | null;
  assistantOverrides?: { variableValues?: Record<string, unknown>; metadata?: Record<string, unknown> } | null;
  metadata?: Record<string, unknown> | null;
  phoneNumberId?: string | null;
  customer?: { number?: string; name?: string; email?: string } | null;
  createdAt?: string;
  startedAt?: string;
  endedAt?: string;
  endedReason?: string;
  cost?: number;
  transcript?: string;
  summary?: string;
  analysis?: { summary?: string; structuredData?: Record<string, unknown>; successEvaluation?: unknown } | null;
  artifact?: { transcript?: string; messages?: Array<Record<string, unknown>>; variableValues?: Record<string, unknown> } | null;
  messages?: Array<Record<string, unknown>>;
};

export type VapiAssistant = {
  id: string;
  orgId?: string;
  name?: string;
  server?: { url?: string } | null;
  serverUrl?: string | null;
  voice?: Record<string, unknown>;
  model?: Record<string, unknown>;
  transcriber?: Record<string, unknown>;
};

export async function getAssistant(id: string, f?: FetchLike) {
  return req<VapiAssistant>(`/assistant/${encodeURIComponent(id)}`, {}, f);
}

export async function listCalls(params: { assistantId: string; createdAtGt?: string; limit?: number }, f?: FetchLike) {
  const q = new URLSearchParams({ assistantId: params.assistantId, limit: String(params.limit ?? 100) });
  if (params.createdAtGt) q.set("createdAtGt", params.createdAtGt);
  return req<VapiCall[]>(`/call?${q.toString()}`, {}, f);
}

export async function getCall(id: string, f?: FetchLike) {
  return req<VapiCall>(`/call/${encodeURIComponent(id)}`, {}, f);
}

export async function listPhoneNumbers(f?: FetchLike) {
  return req<Array<{ id: string; number?: string; provider?: string; assistantId?: string | null; name?: string }>>(`/phone-number`, {}, f);
}

/** Creates a NEW assistant. Kaivaryn never edits assistants it did not create. */
export async function createAssistant(body: Record<string, unknown>, f?: FetchLike) {
  return req<VapiAssistant>(`/assistant`, { method: "POST", body: JSON.stringify(body) }, f);
}

/**
 * Updates an assistant Kaivaryn created. Refuses protected ids (Viki) unconditionally, and refuses
 * any id the caller has not proven Kaivaryn owns (ownedByKaivaryn must come from our own DB row).
 */
export async function updateOwnedAssistant(id: string, body: Record<string, unknown>, ownedByKaivaryn: boolean, f?: FetchLike) {
  if (protectedAssistantIds().includes(id)) throw new VapiError("Refusing to modify a protected assistant", 403);
  if (!ownedByKaivaryn) throw new VapiError("Refusing to modify an assistant Kaivaryn did not create", 403);
  return req<VapiAssistant>(`/assistant/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }, f);
}

let cachedOrgId: string | null = null;
/** Vapi org id (not secret) — env VAPI_ORG_ID, else read from the Viki assistant record. */
export async function vapiOrgId(f?: FetchLike): Promise<string> {
  if (process.env.VAPI_ORG_ID) return process.env.VAPI_ORG_ID;
  if (cachedOrgId) return cachedOrgId;
  const a = await getAssistant(protectedAssistantIds()[0]!, f);
  if (!a.orgId) throw new VapiError("Could not determine voice provider org", 502);
  cachedOrgId = a.orgId;
  return cachedOrgId;
}

const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

/**
 * Mint a short-lived PUBLIC-scoped Vapi JWT for the Web SDK. Public scope can only create web calls;
 * restrictions pin it to the given assistant(s) and origins and forbid transient assistants.
 */
export async function mintPublicWebToken(opts: { assistantIds: string[]; origins: string[]; ttlSeconds?: number }, f?: FetchLike): Promise<{ token: string; expiresAt: number }> {
  const orgId = await vapiOrgId(f);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (opts.ttlSeconds ?? WEB_TOKEN_TTL_SECONDS);
  const header = b64u({ alg: "HS256", typ: "JWT" });
  const payload = b64u({
    orgId,
    token: { tag: "public", restrictions: { enabled: true, allowedOrigins: opts.origins, allowedAssistantIds: opts.assistantIds, allowTransientAssistant: false } },
    iat: now,
    exp,
  });
  const sig = createHmac("sha256", key()).update(`${header}.${payload}`).digest("base64url");
  return { token: `${header}.${payload}.${sig}`, expiresAt: exp * 1000 };
}

/** Origins allowed to use minted web tokens. */
export function allowedWebOrigins(): string[] {
  const out = new Set<string>();
  for (const raw of [process.env.NEXTAUTH_URL, process.env.PUBLIC_APP_URL, "https://kaivaryn.onrender.com"]) {
    if (!raw) continue;
    try {
      out.add(new URL(raw).origin);
    } catch { /* ignore */ }
  }
  if (process.env.NODE_ENV !== "production") out.add("http://localhost:3000");
  return Array.from(out);
}
