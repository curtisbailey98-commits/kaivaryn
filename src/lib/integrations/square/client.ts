/**
 * Minimal Square HTTP client (no SDK dependency).
 * - Retries 429 RATE_LIMITED and 5xx with exponential backoff + jitter (Square's documented guidance:
 *   https://developer.squareup.com/docs/build-basics/general-considerations/handling-errors).
 * - Errors never include tokens or secrets: only HTTP status + Square error codes/categories.
 * - Transport is injectable so tests mock Square completely (no live calls).
 */
import { SQUARE_API_VERSION, type SquareConfig } from "./config";

export type SquareFetch = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ status: number; json: () => Promise<unknown> }>;

type Transport = { fetch: SquareFetch; sleep: (ms: number) => Promise<void>; pageDelayMs: number; maxAttempts: number };

const defaultTransport: Transport = {
  fetch: async (url, init) => {
    const r = await fetch(url, { method: init.method, headers: init.headers, body: init.body, cache: "no-store" });
    return { status: r.status, json: () => r.json().catch(() => ({})) };
  },
  sleep: (ms) => new Promise((res) => setTimeout(res, ms)),
  pageDelayMs: 150,
  maxAttempts: 4,
};

let transport: Transport = { ...defaultTransport };

/** Test hook: replace the network layer. Pass null to restore the real one. */
export function __setSquareTransport(t: Partial<Transport> | null) {
  transport = t ? { ...defaultTransport, ...t } : { ...defaultTransport };
}
export function pageDelay() {
  return transport.pageDelayMs > 0 ? transport.sleep(transport.pageDelayMs) : Promise.resolve();
}

type SquareErrorItem = { category?: string; code?: string; detail?: string };

export class SquareApiError extends Error {
  status: number;
  codes: string[];
  /** True when Square rejected our credentials (expired/revoked token, bad client secret). */
  auth: boolean;
  constructor(status: number, errors: SquareErrorItem[], what: string) {
    const codes = errors.map((e) => String(e.code || e.category || "")).filter(Boolean);
    const auth = status === 401 || errors.some((e) => e.category === "AUTHENTICATION_ERROR" || e.code === "UNAUTHORIZED" || e.code === "ACCESS_TOKEN_EXPIRED" || e.code === "ACCESS_TOKEN_REVOKED" || e.code === "INSUFFICIENT_SCOPES");
    super(`Square ${what} failed (HTTP ${status}${codes.length ? ` · ${codes.slice(0, 3).join(", ")}` : ""})`);
    this.status = status;
    this.codes = codes;
    this.auth = auth;
  }
}

function errorsOf(body: unknown): SquareErrorItem[] {
  const b = body as { errors?: SquareErrorItem[]; error?: string; type?: string; message?: string } | null;
  if (b && Array.isArray(b.errors)) return b.errors.map((e) => ({ category: e?.category, code: e?.code }));
  // OAuth endpoints sometimes answer with {type, message} or {error}
  if (b && (b.type || b.error)) return [{ code: String(b.type || b.error) }];
  return [];
}

export async function squareRequest<T>(opts: { url: string; method?: "GET" | "POST"; authorization?: string; body?: unknown; what: string }): Promise<T> {
  const headers: Record<string, string> = {
    "Square-Version": SQUARE_API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts.authorization) headers.Authorization = opts.authorization;
  let attempt = 0;
  for (;;) {
    attempt++;
    let status = 0;
    let body: unknown = null;
    try {
      const r = await transport.fetch(opts.url, { method: opts.method || "GET", headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
      status = r.status;
      body = await r.json();
    } catch {
      status = 0; // network error → retry like a 5xx
    }
    if (status >= 200 && status < 300) return body as T;
    const retryable = status === 0 || status === 429 || status >= 500;
    if (retryable && attempt < transport.maxAttempts) {
      const base = Math.min(500 * 2 ** (attempt - 1), 8000);
      await transport.sleep(base + Math.floor(Math.random() * base));
      continue;
    }
    throw new SquareApiError(status, errorsOf(body), opts.what);
  }
}

export const bearer = (accessToken: string) => `Bearer ${accessToken}`;

// ---- OAuth endpoints -------------------------------------------------------------------------

export type SquareTokenResponse = { access_token: string; token_type?: string; expires_at?: string; merchant_id?: string; refresh_token?: string };

export function obtainTokenFromCode(cfg: SquareConfig, code: string) {
  // Code flow: client_id + client_secret + code. https://developer.squareup.com/reference/square/oauth-api/obtain-token
  return squareRequest<SquareTokenResponse>({
    url: `${cfg.oauthBase}/token`, method: "POST", what: "token exchange",
    body: { client_id: cfg.appId, client_secret: cfg.appSecret, code, grant_type: "authorization_code" },
  });
}

export function refreshAccessToken(cfg: SquareConfig, refreshToken: string) {
  return squareRequest<SquareTokenResponse>({
    url: `${cfg.oauthBase}/token`, method: "POST", what: "token refresh",
    body: { client_id: cfg.appId, client_secret: cfg.appSecret, refresh_token: refreshToken, grant_type: "refresh_token" },
  });
}

export function revokeAccessToken(cfg: SquareConfig, accessToken: string) {
  // https://developer.squareup.com/reference/square/oauth-api/revoke-token — header "Authorization: Client APPLICATION_SECRET"
  return squareRequest<{ success?: boolean }>({
    url: `${cfg.oauthBase}/revoke`, method: "POST", authorization: `Client ${cfg.appSecret}`, what: "token revoke",
    body: { client_id: cfg.appId, access_token: accessToken },
  });
}

// ---- Read APIs -------------------------------------------------------------------------------

export type SquareMoney = { amount?: number | null; currency?: string | null } | null | undefined;
export type SquareLocation = { id: string; name?: string; timezone?: string; currency?: string; status?: string };
export type SquarePayment = {
  id: string; created_at?: string; updated_at?: string; status?: string; source_type?: string; location_id?: string; order_id?: string;
  amount_money?: SquareMoney; tip_money?: SquareMoney; total_money?: SquareMoney; refunded_money?: SquareMoney;
  card_details?: { card?: { card_brand?: string } };
};
export type SquareRefund = { id: string; created_at?: string; updated_at?: string; status?: string; location_id?: string; payment_id?: string; order_id?: string; reason?: string; amount_money?: SquareMoney };
export type SquareLineItem = { uid?: string; name?: string; quantity?: string; gross_sales_money?: SquareMoney; total_discount_money?: SquareMoney; total_money?: SquareMoney; applied_discounts?: Array<{ discount_uid?: string; applied_money?: SquareMoney }> };
export type SquareOrder = {
  id: string; location_id?: string; state?: string; created_at?: string; updated_at?: string; closed_at?: string;
  line_items?: SquareLineItem[]; discounts?: Array<{ uid?: string; name?: string; applied_money?: SquareMoney }>;
  total_money?: SquareMoney; total_tax_money?: SquareMoney; total_discount_money?: SquareMoney; total_tip_money?: SquareMoney; total_service_charge_money?: SquareMoney;
  return_amounts?: { total_money?: SquareMoney };
  tenders?: Array<{ type?: string; amount_money?: SquareMoney }>;
};

export async function retrieveMerchantName(cfg: SquareConfig, token: string, merchantId: string): Promise<string | null> {
  const r = await squareRequest<{ merchant?: { business_name?: string } }>({ url: `${cfg.apiBase}/merchants/${encodeURIComponent(merchantId)}`, authorization: bearer(token), what: "merchant lookup" });
  return r.merchant?.business_name?.trim() || null;
}

export async function listLocations(cfg: SquareConfig, token: string): Promise<SquareLocation[]> {
  const r = await squareRequest<{ locations?: SquareLocation[] }>({ url: `${cfg.apiBase}/locations`, authorization: bearer(token), what: "locations" });
  return (r.locations || []).map((l) => ({ id: l.id, name: l.name, timezone: l.timezone, currency: l.currency, status: l.status }));
}

export function listPaymentsPage(cfg: SquareConfig, token: string, q: { locationId: string; begin: string; end: string; cursor?: string | null }) {
  const u = new URL(`${cfg.apiBase}/payments`);
  u.searchParams.set("location_id", q.locationId);
  u.searchParams.set("updated_at_begin_time", q.begin);
  u.searchParams.set("updated_at_end_time", q.end);
  u.searchParams.set("sort_field", "UPDATED_AT");
  u.searchParams.set("sort_order", "ASC");
  u.searchParams.set("limit", "100");
  if (q.cursor) u.searchParams.set("cursor", q.cursor);
  return squareRequest<{ payments?: SquarePayment[]; cursor?: string }>({ url: u.toString(), authorization: bearer(token), what: "payments list" });
}

export function listRefundsPage(cfg: SquareConfig, token: string, q: { locationId: string; begin: string; end: string; cursor?: string | null }) {
  const u = new URL(`${cfg.apiBase}/refunds`);
  u.searchParams.set("location_id", q.locationId);
  u.searchParams.set("updated_at_begin_time", q.begin);
  u.searchParams.set("updated_at_end_time", q.end);
  u.searchParams.set("sort_field", "UPDATED_AT");
  u.searchParams.set("sort_order", "ASC");
  u.searchParams.set("limit", "100");
  if (q.cursor) u.searchParams.set("cursor", q.cursor);
  return squareRequest<{ refunds?: SquareRefund[]; cursor?: string }>({ url: u.toString(), authorization: bearer(token), what: "refunds list" });
}

export function searchOrdersPage(cfg: SquareConfig, token: string, q: { locationIds: string[]; begin: string; end: string; cursor?: string | null }) {
  return squareRequest<{ orders?: SquareOrder[]; cursor?: string }>({
    url: `${cfg.apiBase}/orders/search`, method: "POST", authorization: bearer(token), what: "orders search",
    body: {
      location_ids: q.locationIds.slice(0, 10),
      limit: 500,
      return_entries: false,
      ...(q.cursor ? { cursor: q.cursor } : {}),
      query: {
        filter: {
          date_time_filter: { updated_at: { start_at: q.begin, end_at: q.end } },
          state_filter: { states: ["COMPLETED", "CANCELED"] },
        },
        // The sort field must match the timestamp used in date_time_filter.
        sort: { sort_field: "UPDATED_AT", sort_order: "ASC" },
      },
    },
  });
}
