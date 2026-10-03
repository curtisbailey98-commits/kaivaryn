/**
 * Voice layer (Viki Core) validation — runs against the LOCAL database only.
 * Covers: webhook secret/signature checks, tenant routing that fails closed (unknown assistant ids),
 * cross-tenant isolation for agents/calls/transcripts/usage across lib/API-layer functions, the webhook
 * and tool endpoints, signed per-call workspace tokens, action levels + role permissions, both
 * onboarding options (and no activation without approval + confirmation), usage thresholds, provider
 * provisioning payloads (mocked — no real Vapi resources), polling sync (mocked), and that Viki can
 * never be modified.
 * Run: npm run test:voice
 */
import { createHmac, randomBytes } from "node:crypto";

const SECRET = `test_whsec_${randomBytes(18).toString("hex")}`;
process.env.VAPI_WEBHOOK_SECRET = SECRET;
// Hermetic: no provider key unless a mocked fetch is passed explicitly.
const REAL_KEY = process.env.VAPI_PRIVATE_KEY;
process.env.VAPI_PRIVATE_KEY = "test-private-key-not-real-0000000000";

if (!/kaivaryn_local|kaivaryn_ci|localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "")) {
  console.error("Refusing to run: DATABASE_URL does not look like a local/CI database.");
  process.exit(1);
}

import { prisma } from "../src/lib/prisma";
import { verifyWebhook, signSessionToken, verifySessionToken } from "../src/lib/voice/security";
import { sanitizeToolMap, clampLevel, toolByKey, HANDOFF_TRIGGERS, CLIENT_TOOLS } from "../src/lib/voice/action-levels";
import { generateConfig, safeAgentName } from "../src/lib/voice/generator";
import { buildClientAgentPrompt, buildKaivarynWebPrompt, buildKaivarynWorkspacePrompt } from "../src/lib/voice/prompts";
import { usageState, recomputeUsage, currentUsage } from "../src/lib/voice/usage";
import { handleVoiceWebhook } from "../src/lib/voice/webhook";
import { resolveTenant } from "../src/lib/voice/tenancy";
import { issueToolSession } from "../src/lib/voice/session";
import { syncVoiceCalls } from "../src/lib/voice/sync";
import { provisionClientAgent } from "../src/lib/voice/provisioning";
import { updateOwnedAssistant, mintPublicWebToken } from "../src/lib/voice/vapi-client";
import { scrubText, normalizeCall } from "../src/lib/voice/calls";
import { VIKI_ASSISTANT_ID, VOICE_OUTBOUND_ENABLED, assertOutboundDisabled } from "../src/lib/voice/constants";
import { canVoice } from "../src/lib/voice/permissions";
import {
  saveSelfConfig, generateFromQuestionnaire, submitForReview, approveAgent, activateAgent, pauseAgent,
  listCallsForTenant, getCallForTenant, listAgentsForTenant, VoiceFlowError,
} from "../src/lib/voice/agents";

let passed = 0;
let failed = 0;
function assert(cond: unknown, msg: string) {
  if (cond) { passed++; console.log("OK:", msg); } else { failed++; console.error("FAIL:", msg); }
}
async function throws(fn: () => Promise<unknown>, re: RegExp, msg: string) {
  try { await fn(); assert(false, `${msg} (did not throw)`); } catch (e) { assert(re.test((e as Error).message), `${msg} (${(e as Error).message.slice(0, 80)})`); }
}

const sfx = Date.now().toString(36) + randomBytes(2).toString("hex");
const H = (h: Record<string, string>) => new Headers(h);
const hook = (body: unknown, headers: Record<string, string> = { "x-vapi-secret": SECRET }) => handleVoiceWebhook(JSON.stringify(body), H(headers));

function vapiCall(id: string, assistantId: string, extra: Record<string, unknown> = {}) {
  const started = new Date(Date.now() - 5 * 60_000);
  return {
    id, assistantId, type: "inboundPhoneCall", status: "ended",
    startedAt: started.toISOString(), endedAt: new Date(started.getTime() + 150_000).toISOString(), endedReason: "customer-ended-call",
    customer: { number: "+17045550190" }, cost: 0.21,
    artifact: { messages: [
      { role: "system", message: "SYSTEM PROMPT SHOULD NEVER BE STORED" },
      { role: "bot", message: "Thanks for calling. How can I help?", secondsFromStart: 0 },
      { role: "user", message: `Our billing team keeps underbilling invoices and we lose revenue. ${extra.secret || ""}`, secondsFromStart: 4 },
      { role: "tool_call_result", message: "{\"internal\":true}" },
    ] },
    analysis: { summary: `Caller discussed revenue leakage ${extra.secret || ""}`.trim() },
    ...extra,
  };
}

async function main() {
  console.log("--- pure: security ---");
  const body = JSON.stringify({ message: { type: "status-update" } });
  assert(verifyWebhook(H({}), body, null).ok === false && (verifyWebhook(H({}), body, null) as { status: number }).status === 503, "no secret configured → 503 (fail closed)");
  assert(!verifyWebhook(H({}), body).ok, "missing credentials rejected");
  assert(!verifyWebhook(H({ "x-vapi-secret": "wrong" }), body).ok, "wrong X-Vapi-Secret rejected");
  assert(!verifyWebhook(H({ "x-vapi-secret": SECRET + "x" }), body).ok, "secret with extra char rejected");
  assert(verifyWebhook(H({ "x-vapi-secret": SECRET }), body).ok, "correct X-Vapi-Secret accepted");
  assert(verifyWebhook(H({ authorization: `Bearer ${SECRET}` }), body).ok, "correct bearer accepted");
  assert(!verifyWebhook(H({ authorization: "Bearer nope" }), body).ok, "wrong bearer rejected");
  const sig = `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;
  assert(verifyWebhook(H({ "x-kaivaryn-signature": sig }), body).ok, "valid HMAC body signature accepted");
  assert(!verifyWebhook(H({ "x-kaivaryn-signature": sig }), body + " ").ok, "HMAC over a tampered body rejected");
  assert(!verifyWebhook(H({ "x-kaivaryn-signature": sig, "x-vapi-secret": SECRET }), body + " ").ok, "a bad signature is not rescued by a secret header");

  const tok = signSessionToken({ t: "tenantA", u: "user1", r: "OWNER" });
  assert(verifySessionToken(tok.token).ok, "session token verifies");
  const [, p, s] = tok.token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p!, "base64url").toString()), t: "tenantB" })).toString("base64url");
  assert(!verifySessionToken(`kv1.${forged}.${s}`).ok, "token with edited tenant claim rejected");
  assert(!verifySessionToken(signSessionToken({ t: "a", u: "b", r: "OWNER" }, "x".repeat(32)).token).ok, "token signed with another secret rejected");
  assert(!verifySessionToken(signSessionToken({ t: "a", u: "b", r: "OWNER", exp: 1000 }).token).ok, "expired token rejected");
  assert(verifySessionToken(signSessionToken({ t: "a", u: "b", r: "OWNER", exp: 1000 }).token, undefined, 0).ok, "expired token still authentic for after-call record routing");
  assert(!verifySessionToken("org_123").ok && !verifySessionToken(undefined).ok, "caller-supplied org ids / missing tokens rejected");

  console.log("--- pure: action levels, prompts, generator ---");
  assert(clampLevel(toolByKey("issue_refund")!, "EXECUTE") === "REQUIRE_APPROVAL", "refund can never be EXECUTE");
  assert(clampLevel(toolByKey("contract_change")!, "READ") === "REQUIRE_APPROVAL", "contract change always REQUIRE_APPROVAL");
  assert(clampLevel(toolByKey("take_message")!, "EXECUTE") === "DRAFT", "take_message capped at DRAFT");
  assert(clampLevel(toolByKey("lookup_account")!, "EXECUTE") === "READ", "lookups capped at READ");
  const san = sanitizeToolMap({ issue_refund: "EXECUTE", made_up_tool: "EXECUTE", take_message: "DRAFT" });
  assert(san.issue_refund === "REQUIRE_APPROVAL" && !("made_up_tool" in san) && san.financial_commitment === "REQUIRE_APPROVAL" && san.contract_change === "REQUIRE_APPROVAL", "sanitizeToolMap drops unknown tools and forces consequential tools to approval");
  const q = { agentName: "Ava", companyName: "Harbor HVAC", whatCompanyDoes: "HVAC service", whoCalls: ["customers"], whatToHandle: ["faq", "messages", "appointments"], alwaysHuman: ["complaints"], hours: "Mon-Fri 8-6", tone: "concise", canSchedule: "request_only" as const, systems: ["hubspot"], needsApproval: ["refunds"] };
  const g1 = generateConfig(q);
  const g2 = generateConfig(q);
  assert(JSON.stringify(g1) === JSON.stringify(g2), "generator is deterministic");
  assert(g1.name === "Ava" && g1.allowedTools.issue_refund === "REQUIRE_APPROVAL" && g1.allowedTools.request_appointment === "DRAFT", "generator honours name and safe levels");
  assert(HANDOFF_TRIGGERS.every((t) => g1.systemPrompt.includes(t)), "generated prompt includes every handoff trigger");
  assert(/REQUIRE_APPROVAL/.test(g1.systemPrompt) && /Refunds, contract or pricing changes/.test(g1.systemPrompt), "generated prompt bakes in action levels + approval rules");
  assert(/not connected yet/.test(g1.systemPrompt), "prompt is honest that selected systems are not connected");
  assert(safeAgentName("Viki", "Acme") === "Acme Assistant" && safeAgentName("", "Acme") === "Acme Assistant", "client agents never default to 'Viki'");
  assert(!/viki/i.test(buildClientAgentPrompt({ companyName: "Acme", name: "Ava", responsibilities: [], escalationRules: [], tools: {} })), "client prompt never mentions Viki");
  const web = buildKaivarynWebPrompt();
  assert(/Revenue Recovery/.test(web) && /Operations Efficiency/.test(web) && /scheduler\.zoom\.us\/curtis-bailey\/kaivaryn-executive-demo/.test(web) && /do NOT quote client results/i.test(web), "web prompt: RR/OE fit, Zoom demo CTA, no fake results");
  assert(/know NOTHING about this workspace except what your tools return/.test(buildKaivarynWorkspacePrompt()) && /estimated values and realized/.test(buildKaivarynWorkspacePrompt()), "workspace prompt: data only via tools; estimated ≠ realized");
  assert(VOICE_OUTBOUND_ENABLED === false, "outbound calling flag is off");
  await throws(async () => assertOutboundDisabled(), /disabled/, "outbound path throws");
  assert(scrubText("token kv1.abc_DEF.ghi-123 card 4111 1111 1111 1111") === "token [token] card [number removed]", "scrubText removes tokens and card-like numbers");
  const norm = normalizeCall(vapiCall("c-norm", "a") as never, "FIXED");
  assert(!norm.transcript!.includes("SYSTEM PROMPT") && !norm.transcript!.includes("internal"), "system prompt + tool payloads never stored in transcript");
  assert(norm.productFit === "REVENUE_RECOVERY" && norm.durationSeconds === 150 && norm.analysisSource === "provider", "normalized fields: fit, duration, analysis source");

  console.log("--- pure: usage thresholds ---");
  assert(usageState(5, null).state === "NO_ALLOWANCE" && usageState(5, null).percent === null, "no allowance → no percent, no hard-coded pricing");
  assert(usageState(7.4, 10).state === "OK", "74% → OK");
  assert(usageState(7.5, 10).state === "NOTICE_75" && usageState(7.5, 10).crossed.join() === "75", "75% → notice");
  assert(usageState(9, 10).state === "WARNING_90", "90% → warning");
  assert(usageState(10, 10).state === "AT_LIMIT" && usageState(10, 10).remaining === 0, "100% → at limit");
  assert(usageState(11, 10).state === "OVER" && usageState(11, 10).remaining === 0, ">100% → over");

  console.log("--- permissions ---");
  assert(!canVoice("VIEWER", "voice.calls.transcript") && canVoice("MANAGER", "voice.calls.transcript"), "transcripts need MANAGER+");
  assert(!canVoice("MANAGER", "voice.agent.activate") && canVoice("ADMIN", "voice.agent.activate") && canVoice("OWNER", "voice.agent.approve"), "activate/approve need ADMIN+");
  assert(!canVoice("ANALYST", "voice.agent.edit") && canVoice("MANAGER", "voice.agent.edit"), "editing needs MANAGER+");

  // ───────── DB fixtures (fresh, isolated orgs; removed at the end) ─────────
  const mkOrg = (n: string) => prisma.organization.create({ data: { name: `Voice Test ${n} ${sfx}`, slug: `voice-test-${n.toLowerCase()}-${sfx}` } });
  const orgA = await mkOrg("A");
  const orgB = await mkOrg("B");
  const mkUser = async (org: string, role: string, tag: string) => {
    const u = await prisma.user.create({ data: { email: `voice-${tag}-${sfx}@test.local`, name: `V ${tag}`, passwordHash: "x", role: "VIEWER" } });
    await prisma.membership.create({ data: { organizationId: org, userId: u.id, role } });
    return u;
  };
  const ownerA = await mkUser(orgA.id, "OWNER", "ownerA");
  const managerA = await mkUser(orgA.id, "MANAGER", "managerA");
  const viewerA = await mkUser(orgA.id, "VIEWER", "viewerA");
  const ownerB = await mkUser(orgB.id, "OWNER", "ownerB");
  for (const o of [orgA, orgB]) await prisma.entitlement.create({ data: { organizationId: o.id, product: "REVENUE_RECOVERY", active: true } });
  await prisma.opportunity.create({ data: { organizationId: orgA.id, title: `A visible opportunity ${sfx}`, estimatedAmount: 12000, potentialAmount: 12000, recoveredAmount: 3000, verifiedAmount: 1000 } });
  await prisma.opportunity.create({ data: { organizationId: orgB.id, title: `B SECRET opportunity ${sfx}`, estimatedAmount: 999999, potentialAmount: 999999 } });
  const ctxA = { tenantId: orgA.id, userId: ownerA.id, role: "OWNER" };
  const ctxAm = { tenantId: orgA.id, userId: managerA.id, role: "MANAGER" };
  const ctxAv = { tenantId: orgA.id, userId: viewerA.id, role: "VIEWER" };
  const ctxB = { tenantId: orgB.id, userId: ownerB.id, role: "OWNER" };

  const asstA = `test-asst-A-${sfx}`;
  const asstB = `test-asst-B-${sfx}`;
  const asstWS = `test-asst-WS-${sfx}`;
  const agentA = await prisma.voiceAgent.create({ data: { tenantId: orgA.id, kind: "CLIENT", name: "Ava", status: "active", providerAssistantId: asstA, allowedToolsJson: JSON.stringify(sanitizeToolMap({ take_message: "DRAFT", lookup_account: "READ", transfer_to_human: "EXECUTE" })), activatedById: ownerA.id } });
  const agentB = await prisma.voiceAgent.create({ data: { tenantId: orgB.id, kind: "CLIENT", name: "Bea", status: "active", providerAssistantId: asstB, allowedToolsJson: "{}", activatedById: ownerB.id } });
  // Shared in-app assistant (SIGNED_SESSION) registered to tenant A just for this test.
  await prisma.voiceAgent.create({ data: { tenantId: orgA.id, kind: "KAIVARYN_WORKSPACE", routing: "SIGNED_SESSION", name: "WS test", status: "active", providerAssistantId: asstWS } });

  console.log("--- webhook: auth + tenant routing (fail closed) ---");
  const callsBefore = await prisma.voiceCall.count();
  let r = await hook({ message: { type: "end-of-call-report", call: vapiCall(`call-nosig-${sfx}`, asstA) } }, {});
  assert(r.status === 401, "webhook without secret → 401");
  r = await hook({ message: { type: "end-of-call-report", call: vapiCall(`call-badsig-${sfx}`, asstA) } }, { "x-vapi-secret": "nope" });
  assert(r.status === 401, "webhook with wrong secret → 401");
  r = await hook({ message: { type: "end-of-call-report", call: vapiCall(`call-unknown-${sfx}`, `unknown-asst-${sfx}`) } });
  assert(r.status === 200 && r.body.ignored === "unknown_assistant", "unknown assistant id → ignored");
  r = await hook({ message: { type: "end-of-call-report", call: vapiCall(`call-noasst-${sfx}`, "") } });
  assert(r.body.ignored === "missing_assistant_id", "missing assistant id → ignored");
  assert((await prisma.voiceCall.count()) === callsBefore, "no call rows written for unauthenticated/unknown traffic");
  assert((await prisma.voiceEvent.count({ where: { providerCallId: { in: [`call-unknown-${sfx}`, `call-nosig-${sfx}`] } } })) === 0, "no voice events written to any tenant for rejected traffic");
  assert((await prisma.auditLog.count({ where: { organizationId: null, action: "voice.rejected", createdAt: { gte: new Date(Date.now() - 60_000) } } })) >= 3, "rejections logged at platform level (no tenant)");
  const toolUnknown = await hook({ message: { type: "tool-calls", call: { id: `tc-unk-${sfx}`, assistantId: `unknown-${sfx}` }, toolCallList: [{ id: "t1", name: "get_workspace_overview", parameters: {} }] } });
  assert(String((toolUnknown.body.results as Array<{ result: string }>)[0]!.result).startsWith("unavailable"), "tool call from unknown assistant gets no data");

  r = await hook({ message: { type: "end-of-call-report", call: vapiCall(`call-A1-${sfx}`, asstA) } });
  assert(r.status === 200 && r.body.stored === "created", "A's assistant → stored");
  r = await hook({ message: { type: "end-of-call-report", call: vapiCall(`call-B1-${sfx}`, asstB, { secret: `B-PRIVATE-${sfx}` }) } });
  assert(r.body.stored === "created", "B's assistant → stored");
  const a1 = await prisma.voiceCall.findUnique({ where: { providerCallId: `call-A1-${sfx}` } });
  const b1 = await prisma.voiceCall.findUnique({ where: { providerCallId: `call-B1-${sfx}` } });
  assert(a1?.tenantId === orgA.id && b1?.tenantId === orgB.id, "each call lands in its assistant's tenant only");
  r = await hook({ message: { type: "end-of-call-report", call: vapiCall(`call-A1-${sfx}`, asstB, { secret: "hijack" }) } });
  const a1after = await prisma.voiceCall.findUnique({ where: { providerCallId: `call-A1-${sfx}` } });
  assert(a1after?.tenantId === orgA.id && !a1after.transcript?.includes("hijack"), "another tenant's assistant can't overwrite or move an existing call");
  r = await hook({ message: { type: "end-of-call-report", call: vapiCall(`call-A1-${sfx}`, asstA) } });
  assert(r.body.stored === "updated" && (await prisma.voiceCall.count({ where: { providerCallId: `call-A1-${sfx}` } })) === 1, "re-delivery is idempotent");

  console.log("--- cross-tenant reads (agents, calls, transcripts, usage) ---");
  const listA = await listCallsForTenant(ctxA);
  assert(listA.some((c) => c.id === a1!.id) && !listA.some((c) => c.id === b1!.id), "A's call list excludes B's calls");
  assert((await getCallForTenant(ctxA, b1!.id)) === null, "A can't open B's call by id");
  assert((await getCallForTenant(ctxB, a1!.id)) === null, "B can't open A's call by id");
  const agentsA = await listAgentsForTenant(ctxA);
  assert(agentsA.every((a) => a.id !== agentB.id), "A's agent list excludes B's agent");
  assert(!JSON.stringify(listA).includes(`B-PRIVATE-${sfx}`), "B's transcript content never appears in A's list");
  const uA = await currentUsage(orgA.id);
  const uB = await currentUsage(orgB.id);
  assert(uA.calls === 1 && uB.calls === 1 && uA.tenantId === orgA.id, "usage is metered per tenant");
  const asViewer = await getCallForTenant(ctxAv, a1!.id);
  assert(asViewer?.transcriptHidden === true && asViewer.transcript === null && asViewer.callerNumber?.startsWith("•••"), "viewer: transcript hidden, number masked");
  const asMgr = await getCallForTenant(ctxAm, a1!.id);
  assert(asMgr?.transcript?.includes("underbilling") && asMgr.costUsd === null, "manager: transcript visible; provider cost hidden from non-owners");
  assert((await listCallsForTenant(ctxAv)).every((c) => c.costUsd === null), "viewer never sees provider cost");

  console.log("--- client agent tools ---");
  const tcall = (assistantId: string, name: string, params: Record<string, unknown>, callId = `tc-${randomBytes(3).toString("hex")}`, vv?: Record<string, unknown>) =>
    hook({ message: { type: "tool-calls", call: { id: callId, assistantId, ...(vv ? { assistantOverrides: { variableValues: vv } } : {}) }, toolCallList: [{ id: "x1", name, parameters: params }] } }).then((x) => String((x.body.results as Array<{ result: string }>)[0]!.result));
  const tasksBefore = await prisma.task.count({ where: { organizationId: orgA.id } });
  let res = await tcall(asstA, "take_message", { callerName: "Pat", callbackNumber: "704-555-0100", details: "Needs a quote" });
  assert(/Saved for the team/.test(res) && (await prisma.task.count({ where: { organizationId: orgA.id } })) === tasksBefore + 1, "take_message (DRAFT) creates a task in A");
  assert((await prisma.task.count({ where: { organizationId: orgB.id } })) === 0, "nothing written to B");
  const apprBefore = await prisma.approvalRequest.count({ where: { organizationId: orgA.id } });
  res = await tcall(asstA, "issue_refund", { details: "Refund $500" });
  assert(/approval/i.test(res) && (await prisma.approvalRequest.count({ where: { organizationId: orgA.id, type: "VOICE_REQUEST", status: "PENDING" } })) === apprBefore + 1, "refund → REQUIRE_APPROVAL → pending ApprovalRequest, nothing executed");
  res = await tcall(asstA, "lookup_account", { details: "Account 42" });
  assert(/^unavailable/.test(res), "lookup without a connected system → honest 'unavailable'");
  res = await tcall(asstB, "take_message", { details: "x" });
  assert(/^denied/.test(res), "tool not enabled for B's agent → denied");
  await prisma.voiceAgent.update({ where: { id: agentA.id }, data: { status: "paused" } });
  res = await tcall(asstA, "take_message", { details: "x" });
  assert(/not active/.test(res), "paused agent's tools are off");
  await prisma.voiceAgent.update({ where: { id: agentA.id }, data: { status: "active" } });

  console.log("--- workspace tools: signed per-call token ---");
  const sA = await issueToolSession({ tenantId: orgA.id, userId: ownerA.id, role: "OWNER" });
  const wsCall = `ws-call-${sfx}`;
  res = await tcall(asstWS, "get_workspace_overview", { organizationId: orgB.id }, wsCall, { kvToken: sA.token });
  assert(/ESTIMATED \$12,000/.test(res) && /REALIZED recovered \$3,000/.test(res) && /VERIFIED \$1,000/.test(res), "overview returns A's numbers with estimated vs realized labelled");
  assert(!res.includes("999,999"), "caller-supplied organizationId arg is ignored (no B data)");
  res = await tcall(asstWS, "get_top_opportunities", {}, wsCall, { kvToken: sA.token });
  assert(res.includes(`A visible opportunity ${sfx}`) && !res.includes("SECRET"), "top opportunities scoped to token tenant");
  res = await tcall(asstWS, "get_workspace_overview", {}, `other-call-${sfx}`, { kvToken: sA.token });
  assert(/^unavailable/.test(res), "token replayed into a different call → rejected");
  res = await tcall(asstWS, "get_workspace_overview", {}, `nocall-${sfx}`);
  assert(/^unavailable/.test(res), "no token → no workspace data");
  res = await tcall(asstWS, "get_workspace_overview", {}, `forged-${sfx}`, { kvToken: `kv1.${forged}.${s}` });
  assert(/^unavailable/.test(res), "forged token → no data");
  const unknownNonce = signSessionToken({ t: orgA.id, u: ownerA.id, r: "OWNER" });
  res = await tcall(asstWS, "get_workspace_overview", {}, `nonce-${sfx}`, { kvToken: unknownNonce.token });
  assert(/^unavailable/.test(res), "validly signed token whose nonce we never issued → rejected");
  const crossSigned = signSessionToken({ t: orgB.id, u: ownerA.id, r: "OWNER" });
  await prisma.voiceToolSession.create({ data: { tenantId: orgB.id, userId: ownerA.id, role: "OWNER", nonce: crossSigned.claims.n, expiresAt: new Date(Date.now() + 600_000) } });
  const notMember = await resolveTenant({ assistantId: asstWS, providerCallId: `nm-${sfx}`, sessionToken: crossSigned.token, requireFreshToken: true });
  assert(!notMember.ok && notMember.reason === "session_not_member", "token for a tenant the user doesn't belong to → rejected");
  const expired = signSessionToken({ t: orgA.id, u: ownerA.id, r: "OWNER", exp: Math.floor(Date.now() / 1000) - 5 });
  await prisma.voiceToolSession.create({ data: { tenantId: orgA.id, userId: ownerA.id, role: "OWNER", nonce: expired.claims.n, expiresAt: new Date(Date.now() - 5000) } });
  res = await tcall(asstWS, "get_workspace_overview", {}, `exp-${sfx}`, { kvToken: expired.token });
  assert(/^unavailable/.test(res), "expired token can't run live tools");
  const late = await resolveTenant({ assistantId: asstWS, providerCallId: `exp-${sfx}`, sessionToken: expired.token, requireFreshToken: false });
  assert(late.ok && late.tenantId === orgA.id, "expired-but-authentic token still routes the finished call record to its tenant");

  const sV = await issueToolSession({ tenantId: orgA.id, userId: viewerA.id, role: "VIEWER" });
  res = await tcall(asstWS, "request_approval", { title: "Send refund" }, `v-${sfx}`, { kvToken: sV.token });
  assert(/^denied: your role/.test(res), "viewer can't file approvals by voice");
  res = await tcall(asstWS, "list_pending_approvals", {}, `v-${sfx}`, { kvToken: sV.token });
  assert(!/^denied/.test(res), "viewer can read pending approvals");
  await prisma.membership.updateMany({ where: { organizationId: orgA.id, userId: managerA.id }, data: { role: "VIEWER" } });
  const sDown = await issueToolSession({ tenantId: orgA.id, userId: managerA.id, role: "MANAGER" });
  res = await tcall(asstWS, "request_approval", { title: "x" }, `down-${sfx}`, { kvToken: sDown.token });
  assert(/^denied/.test(res), "role downgrade after token issue takes effect immediately");
  await prisma.membership.updateMany({ where: { organizationId: orgA.id, userId: managerA.id }, data: { role: "MANAGER" } });
  const sM = await issueToolSession({ tenantId: orgA.id, userId: managerA.id, role: "MANAGER" });
  const pendingB = await prisma.approvalRequest.count({ where: { organizationId: orgB.id } });
  res = await tcall(asstWS, "request_approval", { title: "Contact customer about underbilling" }, `m-${sfx}`, { kvToken: sM.token });
  assert(/NOT been done/.test(res) && (await prisma.approvalRequest.count({ where: { organizationId: orgA.id, title: { contains: "Contact customer about underbilling" }, status: "PENDING" } })) === 1, "manager's consequential request → pending approval in A (not executed)");
  assert((await prisma.approvalRequest.count({ where: { organizationId: orgB.id } })) === pendingB, "nothing filed in B");
  res = await tcall(asstWS, "delete_everything", {}, `m-${sfx}`, { kvToken: sM.token });
  assert(/^unavailable/.test(res), "unknown workspace tool → unavailable");
  res = await tcall(asstA, "get_workspace_overview", {}, `fixed-${sfx}`);
  assert(/^denied/.test(res), "client phone agent can't call workspace tools");
  assert((await prisma.voiceEvent.count({ where: { tenantId: orgA.id, type: { in: ["tool.executed", "tool.denied"] } } })) >= 8, "every tool call is audited as a voice event");

  console.log("--- onboarding: option 1 (self-configure) ---");
  const orgC = await mkOrg("C");
  const ownerC = await mkUser(orgC.id, "OWNER", "ownerC");
  const managerC = await mkUser(orgC.id, "MANAGER", "managerC");
  const analystC = await mkUser(orgC.id, "ANALYST", "analystC");
  const cO = { tenantId: orgC.id, userId: ownerC.id, role: "OWNER" };
  const cM = { tenantId: orgC.id, userId: managerC.id, role: "MANAGER" };
  await throws(() => saveSelfConfig({ tenantId: orgC.id, userId: analystC.id, role: "ANALYST" }, { name: "X" }), /Forbidden/, "analyst can't configure the agent");
  let ag = await saveSelfConfig(cM, { name: "Viki", voice: "Elliot", greeting: "Hello", responsibilities: ["Answer FAQs"], escalationRules: ["VIP to owner"], allowedTools: { issue_refund: "EXECUTE", take_message: "EXECUTE" }, systems: ["salesforce"] });
  assert(ag.status === "draft" && ag.name !== "Viki" && ag.kind === "CLIENT" && ag.tenantId === orgC.id, "self-config saves a draft for the session tenant; 'Viki' name refused");
  const tm = JSON.parse(ag.allowedToolsJson);
  assert(tm.issue_refund === "REQUIRE_APPROVAL" && tm.take_message === "DRAFT", "self-config levels clamped (refund → approval, message → draft)");
  assert(HANDOFF_TRIGGERS.every((t) => ag.systemPrompt!.includes(t)), "self-config prompt includes handoff rules");
  await throws(() => activateAgent(cO, ag.id, { confirm: true }), /Can't activate/, "can't activate a draft");
  await throws(() => approveAgent(cO, ag.id), /Can't approve/, "can't approve before submitting");
  ag = await submitForReview(cM, ag.id);
  assert(ag.status === "in_review" && (await prisma.approvalRequest.count({ where: { organizationId: orgC.id, type: "VOICE_AGENT_ACTIVATION", status: "PENDING" } })) === 1, "submit → in_review + pending approval in the existing queue");
  await throws(() => approveAgent(cM, ag.id), /Forbidden/, "manager can't approve");
  await throws(() => approveAgent(ctxB, ag.id), /not found/i, "another tenant's owner can't approve C's agent");
  ag = await approveAgent(cO, ag.id);
  assert(ag.status === "approved" && (await prisma.approvalRequest.count({ where: { organizationId: orgC.id, type: "VOICE_AGENT_ACTIVATION", status: "APPROVED" } })) === 1, "owner approves → approved (approval request closed)");
  await throws(() => activateAgent(cO, ag.id, { confirm: false }), /explicit confirmation/, "no activation without explicit confirmation");
  await throws(() => activateAgent(cO, ag.id, { confirm: true }), /Create and test/, "no activation before a test assistant exists");
  await throws(() => activateAgent(cM, ag.id, { confirm: true }), /Forbidden/, "manager can't activate");

  console.log("--- provisioning (mocked provider; Viki is never modified) ---");
  const sent: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    const b = init?.body ? JSON.parse(String(init.body)) : {};
    sent.push({ url: String(url), method: init?.method || "GET", body: b });
    return new Response(JSON.stringify({ id: `prov-${sfx}`, name: b.name }), { status: 200 });
  }) as unknown as typeof fetch;
  const pr = await provisionClientAgent(ag.id, ownerC.id, fakeFetch);
  assert(pr.ok, "provisioning succeeds with mocked provider");
  const first = sent[0]!;
  assert(first.method === "POST" && first.url.endsWith("/assistant"), "provisioning CREATES a new assistant");
  assert(first.body.name === ag.name && !/viki/i.test(String(first.body.name)), "assistant named after the client's chosen name");
  const srv = first.body.server as { url: string; headers: Record<string, string> };
  assert(srv.url.endsWith("/api/voice/webhook") && srv.headers["X-Vapi-Secret"] === SECRET, "server URL = Kaivaryn webhook with secret header");
  assert(!("phoneNumberId" in first.body) && JSON.stringify(first.body).includes("REQUIRE_APPROVAL"), "no phone number attached; approval rules in prompt");
  ag = (await prisma.voiceAgent.findUnique({ where: { id: ag.id } }))!;
  assert(ag.providerAssistantId === `prov-${sfx}` && ag.status === "approved", "provider id stored; approved status kept");
  await provisionClientAgent(ag.id, ownerC.id, fakeFetch);
  assert(sent[1]!.method === "PATCH" && sent[1]!.url.endsWith(`/assistant/prov-${sfx}`), "re-provisioning updates only Kaivaryn's own assistant");
  const before = sent.length;
  await throws(() => updateOwnedAssistant(VIKI_ASSISTANT_ID, { name: "x" }, true, fakeFetch), /protected/, "Viki can never be modified");
  await throws(() => updateOwnedAssistant("someone-elses", { name: "x" }, false, fakeFetch), /did not create/, "assistants Kaivaryn didn't create are never modified");
  assert(sent.length === before, "no provider request was made for refused updates");
  ag = await activateAgent(cO, ag.id, { confirm: true });
  assert(ag.status === "active" && ag.activatedById === ownerC.id, "approved + provisioned + confirmed by owner → active");
  await throws(() => saveSelfConfig(cM, { name: "Edit live" }), /Pause/, "live config can't be edited without pausing");
  ag = await pauseAgent(cO, ag.id);
  ag = await saveSelfConfig(cM, { name: "Ava Two" });
  assert(ag.status === "in_review" && ag.approvedAt === null, "editing a paused agent sends it back to review (re-approval required)");

  console.log("--- onboarding: option 2 (Kaivaryn builds it) ---");
  const orgD = await mkOrg("D");
  const ownerD = await mkUser(orgD.id, "OWNER", "ownerD");
  const dO = { tenantId: orgD.id, userId: ownerD.id, role: "OWNER" };
  let gd = await generateFromQuestionnaire(dO, { agentName: "", whatCompanyDoes: "Dental clinic", whoCalls: ["patients"], whatToHandle: ["faq", "appointments"], alwaysHuman: ["emergencies"], hours: "Mon-Fri 9-5", tone: "warm_professional", canSchedule: "request_only", systems: ["google_workspace"], needsApproval: ["refunds"] });
  assert(gd.status === "generated" && gd.origin === "KAIVARYN_BUILT" && gd.name === `${orgD.name.slice(0, 30)} Assistant`, "questionnaire → generated config named for the company (not Viki)");
  assert(JSON.parse(gd.systemsJson).includes("google_workspace") && /not connected yet/.test(gd.systemPrompt!), "onboarding systems feed the tool map but are shown as not connected");
  await throws(() => activateAgent(dO, gd.id, { confirm: true }), /Can't activate/, "generated config can't be activated without approval");
  gd = await submitForReview(dO, gd.id);
  gd = await approveAgent(dO, gd.id);
  await throws(() => activateAgent(dO, gd.id, { confirm: true }), /Create and test/, "approved generated config still needs a test assistant before activation");
  assert((await prisma.voiceAgent.findUnique({ where: { id: gd.id } }))!.status === "approved", "never auto-activated");

  console.log("--- usage thresholds + alerts (DB) ---");
  await prisma.orgSettings.create({ data: { organizationId: orgD.id, settingsJson: JSON.stringify({ voiceIncludedMinutes: 10 }) } });
  const agD = await prisma.voiceAgent.create({ data: { tenantId: orgD.id, kind: "CLIENT", name: "U", providerAssistantId: `test-asst-D-${sfx}`, status: "active" } });
  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const addCall = (sec: number) => prisma.voiceCall.create({ data: { tenantId: orgD.id, voiceAgentId: agD.id, providerCallId: `u-${randomBytes(4).toString("hex")}`, startedAt: now, durationSeconds: sec } });
  const notes = () => prisma.notification.count({ where: { organizationId: orgD.id, title: { contains: "Included Voice Usage" } } });
  await addCall(7 * 60);
  let u = await recomputeUsage(orgD.id, period);
  assert(u.overageState === "OK" && (await notes()) === 0, "70% → no alert");
  await addCall(30);
  u = await recomputeUsage(orgD.id, period);
  assert(u.overageState === "NOTICE_75" && (await notes()) === 1, "75% → one alert");
  u = await recomputeUsage(orgD.id, period);
  assert((await notes()) === 1, "recompute doesn't duplicate alerts");
  await addCall(90);
  u = await recomputeUsage(orgD.id, period);
  assert(u.overageState === "WARNING_90" && (await notes()) === 2, "90% → second alert");
  await addCall(60);
  u = await recomputeUsage(orgD.id, period);
  assert(u.overageState === "AT_LIMIT" && u.remainingMinutes === 0 && (await notes()) === 3, "100% → third alert, 0 remaining");
  await addCall(60);
  u = await recomputeUsage(orgD.id, period);
  assert(u.overageState === "OVER" && (await notes()) === 3 && u.includedMinutes === 10, "over limit → state OVER, no extra alert, allowance unchanged (no auto-upgrade)");
  assert((await prisma.notification.count({ where: { organizationId: orgA.id, title: { contains: "Included Voice Usage" } } })) === 0, "usage alerts never reach other tenants");

  console.log("--- polling sync (mocked provider) ---");
  const syncFetch = (async (url: string) => {
    const q = new URL(String(url)).searchParams.get("assistantId");
    if (q === asstA) return new Response(JSON.stringify([vapiCall(`poll-A-${sfx}`, asstA), vapiCall(`poll-mismatch-${sfx}`, `stranger-${sfx}`)]), { status: 200 });
    return new Response("[]", { status: 200 });
  }) as unknown as typeof fetch;
  const sr = await syncVoiceCalls({ fetch: syncFetch, tenantId: orgA.id });
  const pA = await prisma.voiceCall.findUnique({ where: { providerCallId: `poll-A-${sfx}` } });
  assert(sr.created >= 1 && pA?.tenantId === orgA.id && pA.source === "poll", "polled call stored in the assistant's tenant");
  assert((await prisma.voiceCall.count({ where: { providerCallId: `poll-mismatch-${sfx}` } })) === 0, "a returned call for a different assistant is skipped");
  const sr2 = await syncVoiceCalls({ fetch: syncFetch, tenantId: orgA.id });
  assert(sr2.created === 0 && (await prisma.voiceCall.count({ where: { providerCallId: `poll-A-${sfx}` } })) === 1, "sync is idempotent");

  console.log("--- public web token (offline) ---");
  process.env.VAPI_ORG_ID = "org-test";
  const wt = await mintPublicWebToken({ assistantIds: ["web-asst"], origins: ["https://kaivaryn.onrender.com"] });
  const claims = JSON.parse(Buffer.from(wt.token.split(".")[1]!, "base64url").toString());
  assert(claims.token.tag === "public" && claims.token.restrictions.allowedAssistantIds[0] === "web-asst" && claims.token.restrictions.allowTransientAssistant === false && claims.exp - claims.iat <= 600, "browser token is public-scoped, pinned to one assistant, no transient assistants, ≤10 min");
  assert(!wt.token.includes(process.env.VAPI_PRIVATE_KEY!), "browser token never contains the private key");
  delete process.env.VAPI_ORG_ID;

  // cleanup
  await prisma.task.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id, orgC.id, orgD.id] } } });
  await prisma.approvalRequest.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id, orgC.id, orgD.id] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id, orgC.id, orgD.id] } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${sfx}@test.local` } } });
  console.log(`\n${passed} passed, ${failed} failed`);
  if (REAL_KEY) process.env.VAPI_PRIVATE_KEY = REAL_KEY;
  await prisma.$disconnect();
  if (failed) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
