/**
 * Square POS connection validation. Square HTTP is fully mocked — no live calls.
 * Pure checks always; tenant-isolated DB checks when DATABASE_URL is set (local DB only).
 * Run: npm run test:square
 */
import { readFileSync } from "fs";
import { join } from "path";

process.env.NEXTAUTH_SECRET ||= "square-validation-local-secret-0123456789";
const ENV_KEYS = ["SQUARE_APP_ID", "SQUARE_APP_SECRET", "SQUARE_ENV", "NEXTAUTH_URL", "SQUARE_BACKFILL_DAYS"] as const;
const savedEnv: Record<string, string | undefined> = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
for (const k of ENV_KEYS) delete process.env[k];

import { PrismaClient } from "@prisma/client";
import { squareConfigStatus, getSquareConfig, buildSquareAuthorizeUrl, SQUARE_SCOPES, type SquareConfig } from "../src/lib/integrations/square/config";
import { signSquareState, verifySquareState, SQUARE_STATE_TTL_MS } from "../src/lib/integrations/square/state";
import { __setSquareTransport, squareRequest, SquareApiError, type SquareFetch } from "../src/lib/integrations/square/client";
import { mapPayment, mapRefund, mapOrder, orderDiscounts } from "../src/lib/integrations/square/mapping";
import { buildPosSummary, detectPosSignals, type PosRow } from "../src/lib/integrations/square/summary";
import { startSquareConnect, completeSquareCallback, canConnectSquare } from "../src/lib/integrations/square/oauth-flow";
import { getSquareView, disconnectSquare, loadSquareConnection, ensureFreshAccessToken } from "../src/lib/integrations/square/connection";
import { syncSquareForOrg, syncAllSquare } from "../src/lib/integrations/square/sync";
import { openSecret } from "../src/lib/secret-box";
import { resolveSystemStates, systemUsable } from "../src/lib/industry/states";
import type { Role } from "../src/lib/enums";
import { can } from "../src/lib/rbac";

let failed = 0;
let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) { failed++; console.error("FAIL:", msg); } else { passed++; console.log("OK:", msg); }
}
const root = join(__dirname, "..");
const src = (p: string) => readFileSync(join(root, p), "utf8");

const ACCESS1 = "EAAAl-test-access-token-ONE-7f3a";
const ACCESS2 = "EAAAl-test-access-token-TWO-91bc";
const REFRESH = "EQAAl-test-refresh-token-5d2e";
const APP_SECRET = "sq0csp-test-app-secret-value";
const SECRETS = [ACCESS1, ACCESS2, REFRESH, APP_SECRET];

const SANDBOX_ENV = { SQUARE_APP_ID: "sandbox-sq0idb-testapp", SQUARE_APP_SECRET: APP_SECRET, SQUARE_ENV: "sandbox", NEXTAUTH_URL: "https://kaivaryn.example.test" } as unknown as NodeJS.ProcessEnv;
const CFG = getSquareConfig(SANDBOX_ENV) as SquareConfig;

// ---------------------------------------------------------------- mock Square
type Call = { method: string; url: URL; headers: Record<string, string>; body: Record<string, unknown> | null };
const iso = (d: Date) => d.toISOString();
const DAY = 86_400_000;

function makeSquare(now: Date) {
  const calls: Call[] = [];
  const state = {
    access: ACCESS1,
    apiDown401: false,
    refreshFails: false,
    payments: new Map<string, Array<Record<string, unknown>>>(),
    refunds: [] as Array<Record<string, unknown>>,
    orders: new Map<string, Array<Record<string, unknown>>>(),
    expiresAt: iso(new Date(now.getTime() + 30 * DAY)),
  };
  const mkPay = (loc: string, i: number, status = "COMPLETED", source = i % 3 === 0 ? "CASH" : "CARD") => ({
    id: `pay_${loc}_${i}`, location_id: loc, status, source_type: source, created_at: iso(new Date(now.getTime() - (i % 25) * DAY - 3600_000)), updated_at: iso(new Date(now.getTime() - (i % 25) * DAY)),
    amount_money: { amount: 2000 + i, currency: "USD" }, tip_money: { amount: 300, currency: "USD" }, total_money: { amount: 2300 + i, currency: "USD" }, order_id: `ord_${loc}_${i}`,
  });
  state.payments.set("L1", Array.from({ length: 250 }, (_, i) => mkPay("L1", i)));
  state.payments.get("L1")!.push(mkPay("L1", 900, "FAILED"));
  state.payments.set("L2", Array.from({ length: 30 }, (_, i) => mkPay("L2", i)));
  state.refunds = [
    { id: "ref_1", location_id: "L1", status: "COMPLETED", payment_id: "pay_L1_1", amount_money: { amount: 1500, currency: "USD" }, created_at: iso(new Date(now.getTime() - 2 * DAY)), reason: "Cold food" },
    { id: "ref_2", location_id: "L1", status: "FAILED", payment_id: "pay_L1_2", amount_money: { amount: 700, currency: "USD" }, created_at: iso(new Date(now.getTime() - 3 * DAY)) },
    { id: "ref_3", location_id: "L2", status: "PENDING", payment_id: "pay_L2_1", amount_money: { amount: 900, currency: "USD" }, created_at: iso(new Date(now.getTime() - 1 * DAY)) },
  ];
  const mkOrder = (loc: string, i: number) => ({
    id: `ord_${loc}_${i}`, location_id: loc, state: i % 40 === 39 ? "CANCELED" : "COMPLETED", closed_at: iso(new Date(now.getTime() - (i % 20) * DAY)),
    created_at: iso(new Date(now.getTime() - (i % 20) * DAY - 3600_000)), updated_at: iso(new Date(now.getTime() - (i % 20) * DAY)),
    discounts: i % 10 === 0 ? [{ uid: "d1", name: "Comp - manager" }] : i % 5 === 0 ? [{ uid: "d2", name: "Happy hour 10%" }] : [],
    line_items: [
      { uid: "a", name: "Burger", gross_sales_money: { amount: 1500 }, total_discount_money: { amount: i % 10 === 0 ? 1500 : i % 5 === 0 ? 150 : 0 }, applied_discounts: i % 10 === 0 ? [{ discount_uid: "d1" }] : i % 5 === 0 ? [{ discount_uid: "d2" }] : [] },
      { uid: "b", name: "Fries", gross_sales_money: { amount: 500 }, total_discount_money: { amount: 0 } },
    ],
    total_discount_money: { amount: i % 10 === 0 ? 1500 : i % 5 === 0 ? 150 : 0, currency: "USD" },
    total_money: { amount: 2000 - (i % 10 === 0 ? 1500 : i % 5 === 0 ? 150 : 0) + 160, currency: "USD" },
    total_tax_money: { amount: 160 }, tenders: [{ type: "CARD" }],
  });
  state.orders.set("L1", Array.from({ length: 1200 }, (_, i) => mkOrder("L1", i)));
  state.orders.set("L2", Array.from({ length: 40 }, (_, i) => mkOrder("L2", i)));

  function page<T>(items: T[], cursor: string | null, size: number) {
    const start = cursor ? Number(cursor.replace("c", "")) : 0;
    const slice = items.slice(start, start + size);
    const next = start + size < items.length ? `c${start + size}` : undefined;
    return { slice, next };
  }
  const json = (status: number, body: unknown) => ({ status, json: async () => body });
  // Square filters by updated_at window; the mock does too (inclusive), so incremental runs only see changes.
  const inWindow = (o: Record<string, unknown>, begin?: string | null, end?: string | null) => {
    const t = new Date(String(o.updated_at || o.created_at)).getTime();
    return (!begin || t >= new Date(begin).getTime()) && (!end || t <= new Date(end).getTime());
  };

  const fetchImpl: SquareFetch = async (raw, init) => {
    const url = new URL(raw);
    const body = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    calls.push({ method: init.method, url, headers: init.headers, body });
    const auth = init.headers.Authorization || "";
    if (url.pathname === "/oauth2/token") {
      if (body?.grant_type === "authorization_code") {
        if (body.code !== "good-code" || body.client_secret !== APP_SECRET) return json(401, { type: "unauthorized", message: "bad code" });
        state.access = ACCESS1;
        return json(200, { access_token: ACCESS1, token_type: "bearer", expires_at: state.expiresAt, merchant_id: "MERCH1", refresh_token: REFRESH });
      }
      if (body?.grant_type === "refresh_token") {
        if (state.refreshFails || body.refresh_token !== REFRESH) return json(401, { errors: [{ category: "AUTHENTICATION_ERROR", code: "UNAUTHORIZED" }] });
        state.access = ACCESS2;
        return json(200, { access_token: ACCESS2, token_type: "bearer", expires_at: iso(new Date(now.getTime() + 30 * DAY)), merchant_id: "MERCH1", refresh_token: REFRESH });
      }
      return json(400, { errors: [{ code: "BAD_REQUEST" }] });
    }
    if (url.pathname === "/oauth2/revoke") {
      if (auth !== `Client ${APP_SECRET}`) return json(401, { errors: [{ code: "UNAUTHORIZED" }] });
      return json(200, { success: true });
    }
    if (state.apiDown401 || auth !== `Bearer ${state.access}`) return json(401, { errors: [{ category: "AUTHENTICATION_ERROR", code: "ACCESS_TOKEN_EXPIRED" }] });
    if (url.pathname === "/v2/merchants/MERCH1") return json(200, { merchant: { id: "MERCH1", business_name: "Testa Trattoria" } });
    if (url.pathname === "/v2/locations") return json(200, { locations: [{ id: "L1", name: "Downtown", timezone: "America/New_York", status: "ACTIVE" }, { id: "L2", name: "Uptown", timezone: "America/Chicago", status: "ACTIVE" }, { id: "L3", name: "Closed spot", status: "INACTIVE" }] });
    if (url.pathname === "/v2/payments") {
      const loc = url.searchParams.get("location_id") || "";
      const items = (state.payments.get(loc) || []).filter((o) => inWindow(o, url.searchParams.get("updated_at_begin_time"), url.searchParams.get("updated_at_end_time")));
      const p = page(items, url.searchParams.get("cursor"), Number(url.searchParams.get("limit") || 100));
      return json(200, { payments: p.slice, cursor: p.next });
    }
    if (url.pathname === "/v2/refunds") {
      const loc = url.searchParams.get("location_id") || "";
      const p = page(state.refunds.filter((r) => r.location_id === loc && inWindow(r, url.searchParams.get("updated_at_begin_time"), url.searchParams.get("updated_at_end_time"))), url.searchParams.get("cursor"), 100);
      return json(200, { refunds: p.slice, cursor: p.next });
    }
    if (url.pathname === "/v2/orders/search") {
      const loc = ((body?.location_ids as string[]) || [])[0];
      const w = ((body?.query as { filter?: { date_time_filter?: { updated_at?: { start_at?: string; end_at?: string } } } })?.filter?.date_time_filter?.updated_at) || {};
      const p = page((state.orders.get(loc) || []).filter((o) => inWindow(o, w.start_at, w.end_at)), (body?.cursor as string) || null, Number(body?.limit || 500));
      return json(200, { orders: p.slice, cursor: p.next });
    }
    return json(404, { errors: [{ code: "NOT_FOUND" }] });
  };
  return { calls, state, fetchImpl };
}

// ---------------------------------------------------------------- pure checks
async function pure() {
  console.log("--- config: missing env is an honest 'not switched on yet' ---");
  assert(squareConfigStatus({} as NodeJS.ProcessEnv).enabled === false, "no SQUARE_* env → not enabled");
  assert(!squareConfigStatus({ SQUARE_APP_ID: "x", NEXTAUTH_URL: "https://a" } as unknown as NodeJS.ProcessEnv).enabled, "missing secret → not enabled");
  const bad = squareConfigStatus({ ...SANDBOX_ENV, SQUARE_ENV: "staging" } as NodeJS.ProcessEnv);
  assert(!bad.enabled && bad.reason === "bad_environment", "SQUARE_ENV must be sandbox|production");
  const mism = squareConfigStatus({ ...SANDBOX_ENV, SQUARE_ENV: "production" } as NodeJS.ProcessEnv);
  assert(!mism.enabled && mism.reason === "environment_mismatch", "sandbox app id + production env → not enabled");
  const noBase = squareConfigStatus({ ...SANDBOX_ENV, NEXTAUTH_URL: "" } as NodeJS.ProcessEnv);
  assert(!noBase.enabled && noBase.reason === "missing_base_url", "missing app base URL → not enabled");
  assert(CFG && CFG.oauthBase === "https://connect.squareupsandbox.com/oauth2" && CFG.apiBase === "https://connect.squareupsandbox.com/v2", "sandbox base URLs");
  const prod = getSquareConfig({ SQUARE_APP_ID: "sq0idp-abc", SQUARE_APP_SECRET: "s", NEXTAUTH_URL: "https://kaivaryn.onrender.com/" } as unknown as NodeJS.ProcessEnv);
  assert(prod?.env === "production" && prod.oauthBase === "https://connect.squareup.com/oauth2" && prod.apiBase === "https://connect.squareup.com/v2", "production is the default env with production base URLs");
  assert(prod?.redirectUri === "https://kaivaryn.onrender.com/api/integrations/square/callback", "redirect URL derived from the app base URL");
  assert(getSquareConfig() === null, "test process has no Square env → getSquareConfig() is null");

  console.log("--- authorize URL: read-only scopes, state, no secret ---");
  const u = new URL(buildSquareAuthorizeUrl(prod!, "STATE123"));
  assert(u.origin + u.pathname === "https://connect.squareup.com/oauth2/authorize", "production authorize endpoint");
  assert(u.searchParams.get("client_id") === "sq0idp-abc" && u.searchParams.get("state") === "STATE123", "client_id + state set");
  assert(u.searchParams.get("scope") === "MERCHANT_PROFILE_READ ORDERS_READ PAYMENTS_READ", "exact read-only scopes requested");
  assert(SQUARE_SCOPES.every((s) => s.endsWith("_READ")), "no WRITE scopes");
  assert(u.searchParams.get("session") === "false", "session=false for production");
  assert(!u.toString().includes("client_secret") && !buildSquareAuthorizeUrl(CFG, "s").includes(APP_SECRET), "app secret never in the authorize URL");
  assert(!new URL(buildSquareAuthorizeUrl(CFG, "s")).searchParams.has("session"), "sandbox omits session param");

  console.log("--- state: bound to org + user + browser, short expiry ---");
  const t0 = Date.now();
  const { state, nonce } = signSquareState("orgA", "userA", t0);
  const ok = verifySquareState(state, nonce, { organizationId: "orgA", userId: "userA" }, t0 + 1000);
  assert(ok.organizationId === "orgA" && ok.userId === "userA", "valid state verifies");
  const err = (f: () => unknown) => { try { f(); return "none"; } catch (e) { return (e as Error).message; } };
  assert(err(() => verifySquareState(state, nonce, { organizationId: "orgA", userId: "userA" }, t0 + SQUARE_STATE_TTL_MS + 1)) === "expired_state", "state expires after 10 minutes");
  assert(SQUARE_STATE_TTL_MS <= 10 * 60_000, "state TTL ≤ 10 minutes");
  assert(err(() => verifySquareState(state, "wrong-nonce-wrong-nonce", { organizationId: "orgA", userId: "userA" }, t0)) === "state_browser_mismatch", "state from another browser (cookie nonce) rejected");
  assert(err(() => verifySquareState(state, null, { organizationId: "orgA", userId: "userA" }, t0)) === "state_browser_mismatch", "missing nonce cookie rejected");
  assert(err(() => verifySquareState(state, nonce, { organizationId: "orgB", userId: "userA" }, t0)) === "state_session_mismatch", "state for another org rejected");
  assert(err(() => verifySquareState(state, nonce, { organizationId: "orgA", userId: "userB" }, t0)) === "state_session_mismatch", "state for another user rejected");
  const [b, s] = state.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(b, "base64url").toString()), o: "orgB" })).toString("base64url");
  assert(err(() => verifySquareState(`${forged}.${s}`, nonce, { organizationId: "orgB", userId: "userA" }, t0)) === "invalid_state", "tampered state rejected");
  assert(err(() => verifySquareState("garbage", nonce, { organizationId: "orgA", userId: "userA" }, t0)) === "invalid_state", "garbage state rejected");

  console.log("--- who can connect ---");
  for (const r of ["VIEWER", "ANALYST", "MANAGER"] as Role[]) {
    assert(!canConnectSquare(r), `${r} cannot connect Square`);
    const st = startSquareConnect({ userId: "u", organizationId: "o", effectiveRole: r }, CFG);
    assert(!st.nonce && st.location.startsWith("/app/integrations?error=1") && !st.location.includes("squareup"), `${r}: connect refused, never sent to Square`);
  }
  for (const r of ["ADMIN", "OWNER"] as Role[]) {
    const st = startSquareConnect({ userId: "u", organizationId: "o", effectiveRole: r }, CFG);
    assert(canConnectSquare(r) && !!st.nonce && st.location.startsWith("https://connect.squareupsandbox.com/oauth2/authorize?"), `${r}: sent to Square's authorize page with a state nonce`);
  }
  const off = startSquareConnect({ userId: "u", organizationId: "o", effectiveRole: "OWNER" }, null);
  assert(!off.nonce && decodeURIComponent(off.location).includes("isn't switched on yet"), "missing env → honest 'not switched on yet', no redirect to Square");
  assert(startSquareConnect(null, CFG).location === "/login", "signed out → login");

  console.log("--- mapping ---");
  const pm = mapPayment({ id: "p1", status: "COMPLETED", source_type: "CASH", location_id: "L1", amount_money: { amount: 1234 }, tip_money: { amount: 200 }, total_money: { amount: 1434, currency: "USD" }, created_at: "2026-09-01T12:00:00Z" });
  assert(pm.type === "PAYMENT" && pm.status === "SUCCEEDED" && pm.amount === 14.34 && pm.sourceId === "payment:p1" && pm.source === "square" && pm.locationId === "L1", "payment → SUCCEEDED, cents → dollars (incl. tip), keyed by Square id");
  assert((pm.detail as { tender: string; tip: number }).tender === "CASH" && (pm.detail as { tip: number }).tip === 2, "payment keeps tender + tip");
  assert(mapPayment({ id: "p2", status: "FAILED" }).status === "DECLINED", "declined card → DECLINED (not FAILED — no failed-payment spam)");
  assert(mapPayment({ id: "p3", status: "CANCELED" }).status === "CANCELED" && mapPayment({ id: "p4", status: "APPROVED" }).status === "PENDING", "canceled/approved payments mapped");
  assert(mapRefund({ id: "r1", status: "COMPLETED", amount_money: { amount: 500 } }).status === "SUCCEEDED" && mapRefund({ id: "r2", status: "FAILED" }).status === "REJECTED" && mapRefund({ id: "r3", status: "REJECTED" }).status === "REJECTED", "refund statuses never FAILED");
  const om = mapOrder({ id: "o1", state: "CANCELED" });
  assert(om.type === "ORDER" && om.status === "VOIDED", "canceled order → VOIDED");
  const d = orderDiscounts({ id: "o2", discounts: [{ uid: "x", name: "Comp" }, { uid: "y", name: "10% off" }], line_items: [
    { name: "Steak", gross_sales_money: { amount: 3000 }, total_discount_money: { amount: 3000 }, applied_discounts: [{ discount_uid: "x" }] },
    { name: "Wine", gross_sales_money: { amount: 1000 }, total_discount_money: { amount: 100 }, applied_discounts: [{ discount_uid: "y" }] },
    { name: "Bread", gross_sales_money: { amount: 400 }, total_discount_money: { amount: 400 } },
  ], total_discount_money: { amount: 3500 } });
  assert(d.gross === 44 && d.comps === 34 && d.discounts === 1 && d.compItems.includes("Steak") && d.compItems.includes("Bread"), "comps (named or fully discounted) split from discounts, no double count");

  console.log("--- client: backoff on 429, no retry on 401, no secrets in errors ---");
  let n = 0;
  const sleeps: number[] = [];
  __setSquareTransport({ fetch: async () => (++n < 3 ? { status: 429, json: async () => ({ errors: [{ category: "RATE_LIMIT_ERROR", code: "RATE_LIMITED" }] }) } : { status: 200, json: async () => ({ ok: 1 }) }), sleep: async (ms) => { sleeps.push(ms); }, pageDelayMs: 0 });
  const r = await squareRequest<{ ok: number }>({ url: "https://connect.squareupsandbox.com/v2/locations", authorization: `Bearer ${ACCESS1}`, what: "x" });
  assert(r.ok === 1 && n === 3 && sleeps.length === 2 && sleeps[1] >= sleeps[0] * 0.5 && sleeps[0] >= 500, "429 retried with exponential backoff + jitter");
  n = 0;
  __setSquareTransport({ fetch: async () => { n++; return { status: 401, json: async () => ({ errors: [{ category: "AUTHENTICATION_ERROR", code: "ACCESS_TOKEN_REVOKED", detail: `token ${ACCESS1} revoked` }] }) }; }, sleep: async () => {}, pageDelayMs: 0 });
  try {
    await squareRequest({ url: "https://x/v2/locations", authorization: `Bearer ${ACCESS1}`, what: "locations" });
    assert(false, "401 should throw");
  } catch (e) {
    assert(e instanceof SquareApiError && e.auth && n === 1, "401 → auth error, not retried");
    assert(!String((e as Error).message).includes(ACCESS1), "error message never contains the token");
  }
  __setSquareTransport(null);

  console.log("--- signals: only with enough data; estimate vs own baseline ---");
  const now = new Date("2026-10-05T16:00:00Z");
  const rows: PosRow[] = [];
  for (let day = 0; day < 90; day++) {
    for (let k = 0; k < 4; k++) {
      const recent = day < 30;
      const discRate = recent ? 0.08 : 0.03;
      rows.push({ type: "ORDER", status: "SUCCEEDED", amount: 100 * (1 - discRate), occurredAt: new Date(now.getTime() - day * DAY - k * 3600_000), locationId: "L1", detailJson: JSON.stringify({ gross: 100, discounts: 100 * discRate * 0.5, comps: 100 * discRate * 0.5 }) });
    }
  }
  const sig = detectPosSignals(rows, now);
  const cd = sig.signals.find((x) => x.ruleId === "square_comps_discounts");
  assert(!sig.insufficient && cd && Math.abs(cd.estimate - 0.05 * 120 * 100) < 1, `comps/discounts spike estimate = extra rate × recent gross (${cd?.estimate})`);
  assert(cd && /estimate, not money recovered/.test(cd.description), "signal text says it's an estimate");
  assert(!sig.signals.find((x) => x.ruleId === "square_refunds"), "no refund signal without a refund increase");
  assert(detectPosSignals(rows.filter((x) => x.occurredAt > new Date(now.getTime() - 40 * DAY)), now).signals.length === 0, "no signal with < 90 days of history");
  const flat = rows.map((x) => ({ ...x, detailJson: JSON.stringify({ gross: 100, discounts: 1.5, comps: 1.5 }) }));
  assert(detectPosSignals(flat, now).signals.length === 0, "no signal when the rate matches the baseline");
  const summ = buildPosSummary(rows, [{ id: "L1", name: "Downtown", timezone: "America/New_York" }], now, 30);
  const inWin = rows.filter((x) => x.occurredAt >= new Date(now.getTime() - 30 * DAY)).length;
  assert(summ.totals.orders === inWin && summ.byDay.every((x) => x.locationName === "Downtown") && summ.byDay.reduce((a, x) => a + x.orders, 0) === inWin, "daily sales by location reconcile to window totals");
}

// ---------------------------------------------------------------- DB checks
async function db() {
  if (!process.env.DATABASE_URL) { console.log("SKIP DB checks: DATABASE_URL not set"); return; }
  const prisma = new PrismaClient();
  const stamp = Date.now().toString(36);
  const now = new Date();
  const a = await prisma.organization.create({ data: { name: `SqV A ${stamp}`, slug: `sqv-a-${stamp}` } });
  const b = await prisma.organization.create({ data: { name: `SqV B ${stamp}`, slug: `sqv-b-${stamp}` } });
  const users = await Promise.all(["owner", "admin", "analyst", "viewer", "bowner"].map((k) => prisma.user.create({ data: { email: `sqv-${k}-${stamp}@test.local`, name: k, passwordHash: "x", role: "VIEWER" } })));
  const [owner, admin, analyst, viewer, bowner] = users;
  const sq = makeSquare(now);
  __setSquareTransport({ fetch: sq.fetchImpl, sleep: async () => {}, pageDelayMs: 0 });
  const logs: string[] = [];
  const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  const capture = () => { for (const k of ["warn", "info"] as const) console[k] = (...x: unknown[]) => { logs.push(x.map(String).join(" ")); }; };
  capture();
  const ctxFor = (u: { id: string }, org: { id: string }, role: Role) => ({ userId: u.id, organizationId: org.id, effectiveRole: role });
  try {
    for (const m of [[a, owner, "OWNER"], [a, admin, "ADMIN"], [a, analyst, "ANALYST"], [a, viewer, "VIEWER"], [b, bowner, "OWNER"]] as const) {
      await prisma.membership.create({ data: { organizationId: m[0].id, userId: m[1].id, role: m[2] } });
    }

    console.log("--- missing env: honest state ---");
    const v0 = await getSquareView(a.id);
    assert(v0.state === "not_enabled" && v0.rowsSynced === 0, "no env, no connection → 'not switched on yet' (never connected)");
    assert((await syncSquareForOrg(a.id, { cfg: null })).skipped === "not_enabled", "sync with no env → skipped not_enabled");
    assert((await syncAllSquare()).configured === false, "scheduled sync does nothing without env");

    console.log("--- callback: viewer / analyst refused; mismatched state refused ---");
    for (const [u, role] of [[viewer, "VIEWER"], [analyst, "ANALYST"]] as const) {
      const st = signSquareState(a.id, u.id);
      const r = await completeSquareCallback({ ctx: ctxFor(u, a, role), code: "good-code", state: st.state, cookieNonce: st.nonce, error: null, cfg: CFG });
      assert(!r.connected && r.location.includes("error=1"), `${role} callback refused`);
    }
    assert(!(await loadSquareConnection(a.id)), "nothing stored after refused callbacks");
    assert(!sq.calls.some((c) => c.url.pathname === "/oauth2/token"), "refused callbacks never exchange the code");
    const stB = signSquareState(a.id, owner.id);
    const cross = await completeSquareCallback({ ctx: ctxFor(bowner, b, "OWNER"), code: "good-code", state: stB.state, cookieNonce: stB.nonce, error: null, cfg: CFG });
    assert(!cross.connected && !(await loadSquareConnection(b.id)) && !(await loadSquareConnection(a.id)), "state for org A used by org B owner → refused, nothing stored anywhere");
    const stOld = signSquareState(a.id, owner.id, Date.now() - SQUARE_STATE_TTL_MS - 5000);
    const expired = await completeSquareCallback({ ctx: ctxFor(owner, a, "OWNER"), code: "good-code", state: stOld.state, cookieNonce: stOld.nonce, error: null, cfg: CFG });
    assert(!expired.connected && decodeURIComponent(expired.location).includes("expired"), "expired state refused with a plain message");
    const denied = await completeSquareCallback({ ctx: ctxFor(owner, a, "OWNER"), code: null, state: null, cookieNonce: null, error: "access_denied", cfg: CFG });
    assert(!denied.connected && decodeURIComponent(denied.location).includes("cancelled"), "seller declining on Square → cancelled, nothing connected");
    const badCode = signSquareState(a.id, owner.id);
    const bc = await completeSquareCallback({ ctx: ctxFor(owner, a, "OWNER"), code: "bad-code", state: badCode.state, cookieNonce: badCode.nonce, error: null, cfg: CFG });
    assert(!bc.connected && !(await loadSquareConnection(a.id)), "bad code → nothing stored");

    console.log("--- connect as Admin: sealed tokens, merchant + locations, honest status ---");
    const st = signSquareState(a.id, admin.id);
    const res = await completeSquareCallback({ ctx: ctxFor(admin, a, "ADMIN"), code: "good-code", state: st.state, cookieNonce: st.nonce, error: null, cfg: CFG, firstSyncPages: 2 });
    assert(res.connected && decodeURIComponent(res.location).includes("Testa Trattoria"), "admin connects; merchant name shown");
    const tokCall = sq.calls.find((c) => c.url.pathname === "/oauth2/token" && c.body?.code === "good-code");
    assert(tokCall?.body?.grant_type === "authorization_code" && tokCall.body.client_id === CFG.appId && tokCall.body.code === "good-code", "code flow token exchange (client_id + secret + code)");
    const conn = await loadSquareConnection(a.id);
    const raw = conn!.row.configJson || "";
    assert(SECRETS.every((x) => !raw.includes(x)), "no plaintext token or secret in stored config");
    assert(openSecret(conn!.stored!.tokens.access) === ACCESS1 && openSecret(conn!.stored!.tokens.refresh!) === REFRESH, "stored tokens decrypt (AES-256-GCM via secret-box)");
    assert(conn!.stored!.merchantId === "MERCH1" && conn!.stored!.locations.length === 3, "merchant id + locations recorded");
    const v1 = await getSquareView(a.id);
    assert(v1.merchantName === "Testa Trattoria" && v1.rowsSynced > 0 && v1.state === "connected" && conn!.row.status === "CONNECTED", "after first (partial) sync with real rows → Connected");
    assert(!v1.lastSync?.complete, "first sync was partial (page budget) and says so");

    console.log("--- pagination + resume + idempotency ---");
    let guard = 0;
    let r = await syncSquareForOrg(a.id, { pageBudget: 7, cfg: CFG });
    while (r.ok && !r.complete && guard++ < 20) r = await syncSquareForOrg(a.id, { pageBudget: 7, cfg: CFG });
    assert(r.ok && r.complete, `small page budget resumes across runs until complete (${guard} extra runs)`);
    const payCalls = sq.calls.filter((c) => c.url.pathname === "/v2/payments" && c.url.searchParams.get("location_id") === "L1");
    const cursors = payCalls.map((c) => c.url.searchParams.get("cursor"));
    assert(["c100", "c200"].every((c) => cursors.includes(c)), "payments followed Square cursors page by page");
    const resumed = payCalls.filter((c) => c.url.searchParams.get("cursor"));
    const win = (c: Call) => `${c.url.searchParams.get("updated_at_begin_time")}|${c.url.searchParams.get("updated_at_end_time")}`;
    assert(resumed.length > 0 && resumed.every((c) => payCalls.some((f) => !f.url.searchParams.get("cursor") && win(f) === win(c))), "resumed pages reuse the original query window (same begin + end)");
    assert(sq.calls.some((c, i) => i > 0 && c.url.pathname === "/v2/payments" && c.url.searchParams.get("cursor") === "c200"), "a run that hit its page budget resumed from the saved cursor");
    assert(!sq.calls.some((c) => c.url.searchParams.get("location_id") === "L3" || ((c.body?.location_ids as string[]) || []).includes("L3")), "inactive locations skipped");
    const orderCalls = sq.calls.filter((c) => c.url.pathname === "/v2/orders/search");
    assert(orderCalls.every((c) => ((c.body?.location_ids as string[]) || []).length <= 10 && (c.body?.query as { sort?: { sort_field?: string } })?.sort?.sort_field === "UPDATED_AT"), "orders search ≤10 locations, sort matches the date filter");
    const expected = 251 + 30 + 3 + 1200 + 40;
    const count = await prisma.transaction.count({ where: { organizationId: a.id, source: "square" } });
    assert(count === expected, `every Square object stored exactly once (${count}/${expected})`);
    const again = await syncSquareForOrg(a.id, { pageBudget: 100, cfg: CFG });
    assert(again.ok && again.created === 0 && (await prisma.transaction.count({ where: { organizationId: a.id, source: "square" } })) === expected, "incremental re-sync creates no duplicates");
    await prisma.integrationConnection.update({ where: { id: conn!.row.id }, data: { configJson: JSON.stringify({ ...(await loadSquareConnection(a.id))!.stored!, streams: {} }) } });
    const full = await syncSquareForOrg(a.id, { pageBudget: 200, cfg: CFG });
    assert(full.ok && full.created === 0 && full.updated === 0 && (await prisma.transaction.count({ where: { organizationId: a.id, source: "square" } })) === expected, "full re-backfill is idempotent (0 created, 0 updated)");
    const incr = sq.calls.filter((c) => c.url.pathname === "/v2/refunds").pop()!;
    assert(new Date(incr.url.searchParams.get("updated_at_begin_time")!).getTime() >= now.getTime() - 91 * DAY, "backfill window ≤ 90 days");
    sq.state.payments.get("L1")![5].status = "CANCELED";
    sq.state.payments.get("L1")![5].updated_at = iso(new Date(now.getTime() + 30_000));
    const upd = await syncSquareForOrg(a.id, { pageBudget: 100, cfg: CFG, now: new Date(now.getTime() + 60_000) });
    const p5 = await prisma.transaction.findFirst({ where: { organizationId: a.id, source: "square", sourceId: "payment:pay_L1_5" } });
    assert(upd.ok && upd.updated >= 1 && p5?.status === "CANCELED", "changed Square object updates the same row");

    console.log("--- stored data: honest statuses, location, restaurant signals ---");
    const failedRows = await prisma.transaction.count({ where: { organizationId: a.id, source: "square", status: "FAILED" } });
    assert(failedRows === 0 && (await prisma.transaction.count({ where: { organizationId: a.id, sourceId: "payment:pay_L1_900", status: "DECLINED" } })) === 1, "declined card stored as DECLINED, never FAILED");
    assert((await prisma.transaction.count({ where: { organizationId: a.id, source: "square", locationId: null } })) === 0, "every Square row carries its location");
    const voids = await prisma.transaction.count({ where: { organizationId: a.id, type: "ORDER", status: "VOIDED" } });
    assert(voids === 30 + 1, `voided orders counted (${voids})`);
    const view = await getSquareView(a.id);
    const { getPosSummary } = await import("../src/lib/integrations/square/summary");
    const sum = await getPosSummary(a.id, view.locations.map((l) => ({ id: l.id, name: l.name, timezone: view.locationTimezones[l.id] })));
    assert(sum.totals.comps > 0 && sum.totals.discounts > 0 && sum.totals.refunds === 15 && sum.tenders.some((t) => t.tender === "CASH") && sum.byDay.some((d) => d.locationName === "Uptown"), "summary: comps, discounts, refunds, tenders, daily sales by location from real rows");
    assert(view.rowsSynced === expected, "card's 'records synced' = real row count");

    console.log("--- detection + Money recovered unaffected ---");
    const { runDetectionEngines } = await import("../src/lib/detection");
    await runDetectionEngines(a.id);
    assert((await prisma.opportunity.count({ where: { organizationId: a.id, type: "failed_payments" } })) === 0, "Square declines don't create failed-payment findings");
    const opps = await prisma.opportunity.findMany({ where: { organizationId: a.id } });
    assert(opps.every((o) => o.recoveredAmount === 0 && o.verifiedAmount === 0), "nothing auto-realized: recovered/verified stay 0");
    const { getRecoveryTracker } = await import("../src/lib/recovery/tracker");
    const tr = await getRecoveryTracker(a.id);
    assert(tr.revenue.wonBack === 0 && tr.operations.wonBack === 0, "Money recovered shows nothing won back from POS data");

    console.log("--- tenant isolation ---");
    assert((await prisma.transaction.count({ where: { organizationId: b.id } })) === 0, "org B has no Square rows");
    assert((await getSquareView(b.id)).state !== "connected" && (await syncSquareForOrg(b.id, { cfg: CFG })).skipped === "not_connected", "org B: not connected, sync refuses");
    assert((await prisma.transaction.count({ where: { source: "square", sourceId: { startsWith: "payment:pay_L1_" }, organizationId: { not: a.id }, createdAt: { gte: now } } })) === 0, "no Square rows written outside org A");

    console.log("--- token refresh before expiry ---");
    const s1 = (await loadSquareConnection(a.id))!;
    await prisma.integrationConnection.update({ where: { id: s1.row.id }, data: { configJson: JSON.stringify({ ...s1.stored!, tokens: { ...s1.stored!.tokens, expiresAt: new Date(now.getTime() + 2 * DAY).toISOString() } }) } });
    const before = sq.calls.length;
    const rr = await syncSquareForOrg(a.id, { pageBudget: 50, cfg: CFG });
    const refreshCall = sq.calls.slice(before).find((c) => c.url.pathname === "/oauth2/token");
    assert(rr.ok && refreshCall?.body?.grant_type === "refresh_token", "token within 7 days of expiry → refreshed before syncing");
    assert(sq.calls.slice(before).filter((c) => c.url.pathname.startsWith("/v2/")).every((c) => c.headers.Authorization === `Bearer ${ACCESS2}`), "API calls use the refreshed token");
    const s2 = (await loadSquareConnection(a.id))!;
    assert(openSecret(s2.stored!.tokens.access) === ACCESS2 && !s2.row.configJson!.includes(ACCESS2), "refreshed token stored sealed");
    const tokNow = await ensureFreshAccessToken(a.id, CFG);
    assert(tokNow === ACCESS2 && sq.calls.filter((c) => c.url.pathname === "/oauth2/token" && c.body?.grant_type === "refresh_token").length === 1, "fresh token reused without another refresh");

    console.log("--- revoked access → Needs attention ---");
    sq.state.apiDown401 = true;
    sq.state.refreshFails = true;
    const dead = await syncSquareForOrg(a.id, { pageBudget: 10, cfg: CFG });
    const vDead = await getSquareView(a.id);
    assert(dead.skipped === "needs_attention" && vDead.state === "needs_attention" && !!vDead.errorMessage, "401 + failed refresh → Needs attention with a reconnect message");
    assert((await syncAllSquare()).configured === false, "(env still off for the scheduler)");
    assert((await syncSquareForOrg(a.id, { cfg: CFG })).skipped === "needs_attention", "no syncing while access is rejected");
    assert(resolveSystemStates(["pos_square"], [{ provider: "pos_square", status: "NEEDS_ATTENTION" }]).get("pos_square") === "selected", "needs attention never shows as connected on the ladder");
    sq.state.apiDown401 = false;
    sq.state.refreshFails = false;

    console.log("--- disconnect revokes and deletes secrets ---");
    const pre = (await loadSquareConnection(a.id))!;
    const currentAccess = openSecret(pre.stored!.tokens.access);
    const dc = await disconnectSquare(a.id, admin.id, CFG);
    const revokeCall = sq.calls.find((c) => c.url.pathname === "/oauth2/revoke");
    assert(dc.removed && dc.revoked && revokeCall?.headers.Authorization === `Client ${APP_SECRET}` && revokeCall.body?.access_token === currentAccess && revokeCall.body?.client_id === CFG.appId, "disconnect revokes at Square (Authorization: Client <secret>)");
    assert(!(await loadSquareConnection(a.id)), "connection row (and every secret) deleted");
    assert((await prisma.transaction.count({ where: { organizationId: a.id, source: "square" } })) === expected, "synced sales stay after disconnect");
    assert((await getSquareView(a.id)).state === "not_connected" || (await getSquareView(a.id)).state === "not_enabled", "after disconnect the card is not connected");

    console.log("--- selected != connected ---");
    const sel = resolveSystemStates(["pos_square"], []);
    assert(sel.get("pos_square") === "selected" && !systemUsable(sel.get("pos_square")!), "picked in onboarding only → selected, not usable");
    assert(resolveSystemStates(["pos_square"], [{ provider: "pos_square", status: "CONFIGURED" }]).get("pos_square") === "configured", "tokens but no data → configured, not connected");
    // connect org B with a merchant that has no sales → stays CONFIGURED / waiting
    const sqB = makeSquare(now);
    sqB.state.payments = new Map();
    sqB.state.orders = new Map();
    sqB.state.refunds = [];
    __setSquareTransport({ fetch: sqB.fetchImpl, sleep: async () => {}, pageDelayMs: 0 });
    const stB2 = signSquareState(b.id, bowner.id);
    const rb = await completeSquareCallback({ ctx: ctxFor(bowner, b, "OWNER"), code: "good-code", state: stB2.state, cookieNonce: stB2.nonce, error: null, cfg: CFG });
    const vb = await getSquareView(b.id);
    const rowB = await loadSquareConnection(b.id);
    assert(rb.connected && vb.state === "connected_waiting" && rowB?.row.status === "CONFIGURED" && vb.rowsSynced === 0, "connected Square account with no sales → 'waiting for data', never Connected");
    assert((await prisma.transaction.count({ where: { organizationId: b.id } })) === 0, "org B still has zero rows (no data invented)");

    console.log("--- secrets never logged / audited ---");
    const audits = await prisma.auditLog.findMany({ where: { organizationId: { in: [a.id, b.id] } } });
    assert(audits.some((x) => x.action === "square.connected") && audits.some((x) => x.action === "square.disconnected"), "connect + disconnect audited");
    assert(audits.every((x) => SECRETS.every((s) => !(x.metadataJson || "").includes(s))), "audit metadata never contains tokens or the app secret");
    assert(logs.every((l) => SECRETS.every((s) => !l.includes(s))), "nothing logged contains tokens or the app secret");
    const allTx = await prisma.transaction.findMany({ where: { organizationId: { in: [a.id, b.id] } }, select: { detailJson: true } });
    assert(allTx.every((t) => SECRETS.every((s) => !(t.detailJson || "").includes(s))), "synced rows never contain tokens");
  } finally {
    Object.assign(console, orig);
    __setSquareTransport(null);
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [a.id, b.id] } } });
    await prisma.orgSettings.deleteMany({ where: { organizationId: { in: [a.id, b.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await prisma.$disconnect();
  }
}

function sources() {
  console.log("--- source checks ---");
  const lib = ["config", "state", "client", "connection", "sync", "mapping", "summary", "oauth-flow"].map((f) => src(`src/lib/integrations/square/${f}.ts`)).join("\n");
  assert(!/console\.(log|info|warn|error|debug)/.test(lib), "Square lib never logs");
  assert(!/_WRITE/.test(src("src/lib/integrations/square/config.ts")), "no write scopes in config");
  assert(!/(recoveredAmount|verifiedAmount|realizedSavings)\s*:/.test(lib), "Square code never writes recovered/realized amounts");
  const tick = src("src/app/api/operate/tick/route.ts");
  assert(/syncAllSquare\(\)/.test(tick) && /square_sync_failed/.test(tick), "scheduled tick runs Square sync isolated in try/catch");
  const connect = src("src/app/api/integrations/square/connect/route.ts");
  assert(/httpOnly: true/.test(connect) && /sameSite: "lax"/.test(connect), "nonce cookie is httpOnly + SameSite=Lax");
  const actions = src("src/app/app/integrations/actions.ts");
  assert(/syncSquareNowAction[\s\S]*requirePermission\("import"\)/.test(actions) && /disconnectSquareAction[\s\S]*requirePermission\("manage_settings"\)/.test(actions), "Sync now = Manager+, disconnect = Admin/Owner");
  assert(!can("VIEWER", "import") && !can("ANALYST", "import") && can("MANAGER", "import"), "viewer/analyst can't press Sync now; Manager+ can");
  assert(!can("MANAGER", "manage_settings") && can("ADMIN", "manage_settings") && can("OWNER", "manage_settings"), "only Admin/Owner can connect/disconnect");
  const card = src("src/components/integrations/square-card.tsx");
  assert(/isn&apos;t switched on yet/.test(card) && /waiting for data/.test(card) && /Needs attention/.test(card), "card has honest Not switched on / waiting / needs attention states");
  assert(!/partner|marketplace|App Marketplace/i.test(card + src("src/lib/integrations/guides/pos.ts").split("pos_square")[1].split("pos_clover")[0]), "no partner / marketplace claims for Square");
}

(async () => {
  await pure();
  sources();
  await db();
  for (const k of ENV_KEYS) if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k];
  console.log(`\nSquare validation: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
