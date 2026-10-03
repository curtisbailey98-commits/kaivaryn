/**
 * HTTP-level voice isolation smoke test (UI routes + API + webhook + tool endpoint).
 * Requires a running server (BASE_URL, default http://localhost:3000) on the LOCAL seeded DB, started
 * with the same VAPI_WEBHOOK_SECRET as this process. Creates and removes its own test rows.
 * Run: npm run test:voice:api
 */
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SECRET = process.env.VAPI_WEBHOOK_SECRET || "";
let passed = 0;
let failed = 0;
function assert(c: unknown, m: string) { if (c) { passed++; console.log("OK:", m); } else { failed++; console.error("FAIL:", m); } }

if (!/kaivaryn_local|kaivaryn_ci|localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "")) { console.error("Refusing: not a local DB"); process.exit(1); }

class Jar {
  cookies = new Map<string, string>();
  absorb(res: Response) {
    for (const c of (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair!.indexOf("=");
      this.cookies.set(pair!.slice(0, i), pair!.slice(i + 1));
    }
  }
  header() { return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; "); }
}
async function login(email: string, password: string) {
  const jar = new Jar();
  const c = await fetch(`${BASE}/api/auth/csrf`);
  jar.absorb(c);
  const { csrfToken } = (await c.json()) as { csrfToken: string };
  const r = await fetch(`${BASE}/api/auth/callback/credentials`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.header() }, body: new URLSearchParams({ csrfToken, email, password, json: "true", callbackUrl: `${BASE}/app` }) });
  jar.absorb(r);
  return jar;
}
async function call(jar: Jar | null, path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...init, redirect: "manual", headers: { "content-type": "application/json", ...(jar ? { cookie: jar.header() } : {}), ...(init?.headers || {}) } });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, text, json };
}

async function main() {
  const sfx = randomBytes(4).toString("hex");
  const acme = await prisma.organization.findUniqueOrThrow({ where: { slug: "acme-demo" } });
  const other = await prisma.organization.findUniqueOrThrow({ where: { slug: "other-co" } });
  const agA = await prisma.voiceAgent.create({ data: { tenantId: acme.id, kind: "CLIENT", name: `SmokeA ${sfx}`, providerAssistantId: `smoke-A-${sfx}`, status: "draft" } });
  const agO = await prisma.voiceAgent.create({ data: { tenantId: other.id, kind: "CLIENT", name: `SmokeO ${sfx}`, providerAssistantId: `smoke-O-${sfx}`, status: "draft" } });
  const cA = await prisma.voiceCall.create({ data: { tenantId: acme.id, voiceAgentId: agA.id, providerCallId: `smoke-call-A-${sfx}`, callerName: `Acme Caller ${sfx}`, transcript: `Caller: acme transcript ${sfx}`, transcriptJson: JSON.stringify([{ role: "caller", text: `acme transcript ${sfx}` }]), startedAt: new Date(), durationSeconds: 60 } });
  const cO = await prisma.voiceCall.create({ data: { tenantId: other.id, voiceAgentId: agO.id, providerCallId: `smoke-call-O-${sfx}`, callerName: `Other Caller ${sfx}`, transcript: `Caller: OTHER SECRET ${sfx}`, transcriptJson: JSON.stringify([{ role: "caller", text: `OTHER SECRET ${sfx}` }]), startedAt: new Date(), durationSeconds: 60 } });
  try {
    const owner = await login("owner@acme-demo.kaivaryn.com", "DemoClient!2026");
    const analyst = await login("demo@kaivaryn.com", "DemoClient!2026");
    const otherUser = await login("analyst@other-co.test", "DemoClient!2026");

    let r = await call(null, "/api/voice/calls");
    assert(r.status === 401, "unauthenticated /api/voice/calls → 401");
    r = await call(owner, "/api/voice/calls");
    const ids = ((r.json?.calls as Array<{ id: string }>) || []).map((c) => c.id);
    assert(r.status === 200 && ids.includes(cA.id) && !ids.includes(cO.id), "API list: Acme sees its call, not Other Co's");
    r = await call(otherUser, "/api/voice/calls");
    const ids2 = ((r.json?.calls as Array<{ id: string }>) || []).map((c) => c.id);
    assert(ids2.includes(cO.id) && !ids2.includes(cA.id), "API list: Other Co sees only its own");
    r = await call(owner, `/api/voice/calls/${cO.id}`);
    assert(r.status === 404 && !r.text.includes("OTHER SECRET"), "API detail: Acme → Other Co call id = 404");
    r = await call(otherUser, `/api/voice/calls/${cA.id}`);
    assert(r.status === 404, "API detail: Other Co → Acme call id = 404");
    r = await call(owner, `/api/voice/calls/${cA.id}`);
    assert(r.status === 200 && String((r.json?.call as { transcript?: string })?.transcript).includes("acme transcript"), "owner reads own transcript");
    r = await call(analyst, `/api/voice/calls/${cA.id}`);
    assert(r.status === 200 && (r.json?.call as { transcriptHidden?: boolean })?.transcriptHidden === true, "analyst (view-only demo user): transcript hidden");
    r = await call(otherUser, "/api/voice/agents");
    const agIds = ((r.json?.agents as Array<{ id: string }>) || []).map((a) => a.id);
    assert(agIds.includes(agO.id) && !agIds.includes(agA.id), "API agents: tenant-scoped");
    r = await call(owner, "/api/voice/usage");
    assert(r.status === 200 && r.json?.usage && !("providerCostUsd" in (r.json.usage as object)), "API usage: own tenant, no provider cost");

    r = await call(owner, `/app/calls/${cO.id}`);
    assert(r.status === 404 && !r.text.includes(`OTHER SECRET ${sfx}`), "UI detail page: other tenant's call → 404");
    r = await call(owner, "/app/calls");
    assert(r.status === 200 && r.text.includes(`Acme Caller ${sfx}`) && !r.text.includes(`Other Caller ${sfx}`) && r.text.includes("Included Voice Usage") && !/vapi credits/i.test(r.text), "UI calls page: own calls only, 'Included Voice Usage', no 'Vapi credits'");
    r = await call(otherUser, "/app/calls");
    assert(r.status === 200 && !r.text.includes(`Acme Caller ${sfx}`), "UI calls page for Other Co excludes Acme");
    r = await call(owner, "/app/voice-agent");
    assert(r.status === 200 && r.text.includes("Create your company") && r.text.includes(`SmokeA ${sfx}`), "voice-agent page renders the tenant's own agent");
    assert(!r.text.includes(`SmokeO ${sfx}`), "voice-agent page never shows another tenant's agent");

    r = await call(null, "/api/voice/webhook", { method: "POST", body: JSON.stringify({ message: { type: "end-of-call-report", call: { id: `x-${sfx}`, assistantId: agA.providerAssistantId } } }) });
    assert(r.status === 401 || r.status === 503, `webhook without secret refused (${r.status})`);
    if (SECRET) {
      r = await call(null, "/api/voice/webhook", { method: "POST", headers: { "x-vapi-secret": SECRET }, body: JSON.stringify({ message: { type: "end-of-call-report", call: { id: `unk-${sfx}`, assistantId: `nobody-${sfx}` } } }) });
      assert(r.status === 200 && r.json?.ignored === "unknown_assistant", "webhook: unknown assistant ignored");
      assert((await prisma.voiceCall.count({ where: { providerCallId: `unk-${sfx}` } })) === 0, "webhook: nothing stored for unknown assistant");
    }

    r = await call(null, "/api/voice/session", { method: "POST", body: JSON.stringify({ mode: "workspace" }) });
    assert(r.status === 401, "workspace voice session needs sign-in");
    r = await call(owner, "/api/voice/session", { method: "POST", body: JSON.stringify({ mode: "preview", agentId: agO.id }) });
    assert(r.json?.available === false, "preview session for another tenant's agent refused");
    r = await call(owner, "/api/voice/session", { method: "POST", body: JSON.stringify({ mode: "workspace" }) });
    const key = process.env.VAPI_PRIVATE_KEY || "§never§";
    assert(!r.text.includes(key), "session response never contains the private key");
    if (r.json?.available) {
      const vv = r.json.variableValues as Record<string, string>;
      assert(typeof vv.kvToken === "string" && vv.kvToken.startsWith("kv1.") && vv.orgName === "Acme Industries", "workspace session: signed kv token bound to Acme");
      if (SECRET && process.env.VAPI_WORKSPACE_ASSISTANT_ID) {
        const tc = await call(null, "/api/voice/webhook", { method: "POST", headers: { "x-vapi-secret": SECRET }, body: JSON.stringify({ message: { type: "tool-calls", call: { id: `ws-${sfx}`, assistantId: process.env.VAPI_WORKSPACE_ASSISTANT_ID, assistantOverrides: { variableValues: vv } }, toolCallList: [{ id: "t", name: "get_top_opportunities", parameters: { organizationId: other.id } }] } }) });
        const out = String((tc.json?.results as Array<{ result: string }>)?.[0]?.result);
        assert(!out.includes("Other-org secret") && !out.startsWith("unavailable: this call"), "tool endpoint over HTTP: Acme token → Acme data only (org arg ignored)");
        const tc2 = await call(null, "/api/voice/webhook", { method: "POST", headers: { "x-vapi-secret": SECRET }, body: JSON.stringify({ message: { type: "tool-calls", call: { id: `ws2-${sfx}`, assistantId: process.env.VAPI_WORKSPACE_ASSISTANT_ID, assistantOverrides: { variableValues: { ...vv, kvToken: "kv1.bad.bad" } } }, toolCallList: [{ id: "t", name: "get_workspace_overview", parameters: {} }] } }) });
        assert(String((tc2.json?.results as Array<{ result: string }>)?.[0]?.result).startsWith("unavailable"), "tool endpoint over HTTP: bad token → no data");
      }
    } else {
      assert(typeof r.json?.reason === "string", "workspace session unavailable → honest reason");
    }
    r = await call(null, "/api/voice/session", { method: "POST", body: "{}" });
    assert(r.status === 200 && typeof r.json?.available === "boolean" && !r.text.includes(key), "public session returns availability without secrets");

    r = await call(null, "/api/voice/sync", { method: "POST" });
    assert(r.status === 401, "sync unauthenticated → 401");
    r = await call(null, "/api/voice/sync", { method: "POST", headers: { authorization: "Bearer wrong-token-wrong-token" } });
    assert(r.status === 401, "sync with wrong bearer → 401");
    r = await call(analyst, "/api/voice/sync", { method: "POST" });
    assert(r.status === 403, "sync as analyst → 403");

    r = await call(null, "/");
    assert(r.status === 200 && r.text.includes("Talk to Viki"), "public homepage renders 'Talk to Viki'");
  } finally {
    await prisma.voiceCall.deleteMany({ where: { id: { in: [cA.id, cO.id] } } });
    await prisma.voiceAgent.deleteMany({ where: { id: { in: [agA.id, agO.id] } } });
    await prisma.voiceToolSession.deleteMany({ where: { tenantId: acme.id, providerCallId: { startsWith: "ws" } } });
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  if (failed) process.exit(1);
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
