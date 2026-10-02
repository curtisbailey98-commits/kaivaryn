/**
 * HTTP smoke + tenant-isolation test for the operating-layer API and key pages.
 * Requires a running server (BASE_URL, default http://localhost:3000) and a seeded DB.
 * Run: npm run test:operate:api
 */
export {};
const BASE = process.env.BASE_URL || "http://localhost:3000";
let failed = 0;
let passed = 0;
function assert(cond: unknown, msg: string) {
  if (cond) {
    passed++;
    console.log("OK:", msg);
  } else {
    failed++;
    console.error("FAIL:", msg);
  }
}

class Jar {
  cookies = new Map<string, string>();
  absorb(res: Response) {
    const raw = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const c of raw) {
      const [pair] = c.split(";");
      const i = pair!.indexOf("=");
      this.cookies.set(pair!.slice(0, i), pair!.slice(i + 1));
    }
  }
  header() {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function login(email: string, password: string) {
  const jar = new Jar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.absorb(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.header() },
    body: new URLSearchParams({ csrfToken, email, password, json: "true", callbackUrl: `${BASE}/app` }),
  });
  jar.absorb(res);
  return jar;
}

async function call(jar: Jar | null, path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    redirect: "manual",
    headers: { "content-type": "application/json", ...(jar ? { cookie: jar.header() } : {}), ...(init?.headers || {}) },
  });
  let body: unknown = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body: body as Record<string, unknown> & string, location: res.headers.get("location") };
}

async function main() {
  console.log(`=== Operating layer HTTP smoke (${BASE}) ===`);
  // Public pages
  for (const p of ["/", "/platform", "/how-it-works", "/intelligence", "/pricing", "/solutions/revenue-recovery", "/solutions/operations-efficiency", "/company", "/demo", "/login"]) {
    const r = await call(null, p);
    assert(r.status === 200, `public ${p} → 200 (got ${r.status})`);
  }
  // Unauthenticated API is rejected
  assert((await call(null, "/api/command")).status === 401, "unauthenticated /api/command → 401");
  assert((await call(null, "/api/inbox")).status === 401, "unauthenticated /api/inbox → 401");
  const tick = await call(null, "/api/operate/tick", { method: "POST", headers: { authorization: "Bearer wrong-token-wrong-token" } });
  assert(tick.status === 401, "tick with bad bearer token → 401");

  const demo = await login("demo@kaivaryn.com", "DemoClient!2026");
  assert(demo.header().includes("session-token"), "demo user signs in");
  const other = await login("analyst@other-co.test", "DemoClient!2026");
  const otherOk = other.header().includes("session-token");
  const viewer = await login("viewer@acme-demo.kaivaryn.com", "DemoClient!2026");
  const viewerOk = viewer.header().includes("session-token");

  // SaaS pages render
  for (const p of ["/app", "/app/command", "/app/inbox", "/app/automations", "/app/playbooks", "/app/initiatives", "/app/operate", "/app/action-center", "/app/revenue", "/app/operations", "/app/intelligence", "/app/approvals"]) {
    const r = await call(demo, p);
    assert(r.status === 200, `page ${p} → 200 (got ${r.status}${r.location ? ` → ${r.location}` : ""})`);
  }
  for (const [from, to] of [["/app/query?q=top", "/app/command"], ["/app/notifications", "/app/inbox"], ["/app/jobs", "/app/automations"]]) {
    const r = await call(demo, from!);
    assert([307, 308].includes(r.status) && (r.location || "").includes(to!), `${from} redirects to ${to}`);
  }

  // Command API
  const cmd = await call(demo, "/api/command", { method: "POST", body: JSON.stringify({ text: "How much revenue have we recovered?", idempotencyKey: `smoke-${Date.now()}` }) });
  assert(cmd.status === 200 && cmd.body.route === "ANSWER" && cmd.body.status === "OK", "POST /api/command ANSWER");
  const st = await call(demo, "/api/command", { method: "POST", body: JSON.stringify({ text: "status" }) });
  assert(st.status === 200 && st.body.route === "STATUS", "POST /api/command STATUS");
  const hist = await call(demo, "/api/command");
  const demoCmdIds = new Set(((hist.body.commands as Array<{ id: string }>) || []).map((c) => c.id));
  assert(hist.status === 200 && demoCmdIds.has(String(cmd.body.id)), "GET /api/command lists own commands");

  const inbox = await call(demo, "/api/inbox");
  assert(inbox.status === 200 && typeof (inbox.body.counts as { total?: number })?.total === "number", "GET /api/inbox");
  const pbs = await call(demo, "/api/playbooks");
  const books = (pbs.body.playbooks as Array<{ id: string; slug: string }>) || [];
  assert(pbs.status === 200 && books.length >= 6, "GET /api/playbooks returns system playbooks");
  const health = await call(demo, "/api/operate/health");
  assert(health.status === 200 && !!health.body.latest, "GET /api/operate/health");
  const runs = await call(demo, "/api/runs");
  const demoRuns = (runs.body.runs as Array<{ id: string }>) || [];
  assert(runs.status === 200 && demoRuns.length >= 1, "GET /api/runs");
  const inis = await call(demo, "/api/initiatives");
  const demoInis = (inis.body.initiatives as Array<{ id: string }>) || [];
  assert(inis.status === 200 && demoInis.length >= 1, "GET /api/initiatives");
  const so = await call(demo, "/api/standing-orders", { method: "POST", body: JSON.stringify({ directive: "every day digest smoke" }) });
  const soId = (so.body.standingOrder as { id?: string })?.id;
  assert(so.status === 200 && !!soId, "POST /api/standing-orders");

  // Tenant isolation over HTTP
  if (otherOk) {
    const pbId = books.find((b) => b.slug === "platform-health-check")?.id;
    const r1 = await call(other, `/api/playbooks/${pbId}/run`, { method: "POST", body: "{}" });
    assert(r1.status === 404, `other tenant cannot run acme playbook by id (got ${r1.status})`);
    const r2 = await call(other, `/api/runs/${demoRuns[0]?.id}`);
    assert(r2.status === 404, `other tenant cannot read acme run (got ${r2.status})`);
    const r3 = await call(other, `/api/initiatives/${demoInis[0]?.id}`);
    assert(r3.status === 404, `other tenant cannot read acme initiative (got ${r3.status})`);
    const r4 = await call(other, `/api/standing-orders/${soId}`, { method: "PATCH", body: JSON.stringify({ enabled: false }) });
    assert(r4.status === 404, `other tenant cannot toggle acme standing order (got ${r4.status})`);
    const r5 = await call(other, "/api/command");
    const otherIds = ((r5.body.commands as Array<{ id: string }>) || []).map((c) => c.id);
    assert(!otherIds.some((id) => demoCmdIds.has(id)), "other tenant command history excludes acme commands");
  } else {
    console.log("SKIP: other-co analyst password not known in this environment");
  }

  // RBAC over HTTP
  if (viewerOk) {
    const v = await call(viewer, "/api/command", { method: "POST", body: JSON.stringify({ text: "Analyze churn" }) });
    assert(v.status === 200 && v.body.status === "DENIED", "viewer analysis is DENIED");
    const v2 = await call(viewer, "/api/standing-orders", { method: "POST", body: JSON.stringify({ directive: "every day digest" }) });
    assert(v2.status === 403, `viewer cannot create standing orders (got ${v2.status})`);
  }

  if (soId) await call(demo, `/api/standing-orders/${soId}`, { method: "DELETE" });

  // Executive surfaces still render for platform admin
  const admin = await login("admin@kaivaryn.com", "KaivarynAdmin!2026");
  for (const p of ["/executive/ceo", "/executive/chief", "/executive/cseo", "/admin", "/app/command"]) {
    const r = await call(admin, p);
    assert(r.status === 200, `admin ${p} → 200 (got ${r.status}${r.location ? ` → ${r.location}` : ""})`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
