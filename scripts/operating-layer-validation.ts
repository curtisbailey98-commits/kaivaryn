/**
 * Operating layer (renovated 720 SI) validation — tenant isolation, RBAC, routing,
 * human-in-the-loop approval gates, standing orders, briefings, health.
 * Run: npm run test:operate   (needs a seeded database)
 */
import { PrismaClient } from "@prisma/client";
import {
  routeCommand,
  inferProduct,
  executeCommand,
  listCommandHistory,
  runPlaybook,
  getRun,
  listPlaybooks,
  savePlaybook,
  createStandingOrder,
  setStandingOrderEnabled,
  runDueStandingOrders,
  tickAllOrganizations,
  createInitiative,
  linkToInitiative,
  getInitiativeDetail,
  getInbox,
  buildDigest,
  buildRecall,
  runHealthCheck,
  onApprovalDecided,
  parseCadence,
  stepsFromDirective,
  type OpCtx,
} from "../src/lib/operate";

const prisma = new PrismaClient();
let failed = 0;
let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed++;
    console.error("FAIL:", msg);
  } else {
    passed++;
    console.log("OK:", msg);
  }
}
async function expectThrow(fn: () => Promise<unknown>, code: string, msg: string) {
  try {
    await fn();
    assert(false, `${msg} (expected ${code}, no error)`);
  } catch (e) {
    const c = (e as { code?: string }).code;
    assert(c === code, `${msg} (got ${c ?? (e as Error).message})`);
  }
}

async function main() {
  console.log("=== Kaivaryn operating layer validation ===");

  // ——— 1. Router (pure, deterministic) ———
  const cases: Array<[string, string]> = [
    ["Analyze revenue leakage in billing", "ANALYZE"],
    ["observe continuity", "ANALYZE"],
    ["something vague", "ANALYZE"],
    ["How much revenue have we recovered?", "ANSWER"],
    ["status", "STATUS"],
    ["health check", "STATUS"],
    ["Build a recovery plan for unbilled change orders", "BUILD"],
    ["plan a fix for approval delays", "BUILD"],
    ["digest", "DIGEST"],
    ["brief me on what changed", "DIGEST"],
    ["recall", "RECALL"],
    ["What did Kaivaryn learn?", "RECALL"],
    ["every day digest", "STANDING"],
    ["run playbook revenue-leakage-sweep", "PLAYBOOK"],
    ["save playbook Billing check :: detect then analyze billing then digest", "PLAYBOOK"],
    ["request: confirm invoice export", "REQUEST"],
    ["find northwind", "SEARCH"],
    ["initiative create Q4 cleanup", "INITIATIVE"],
    ["help", "HELP"],
  ];
  for (const [text, route] of cases) assert(routeCommand(text).route === route, `route “${text}” → ${route} (got ${routeCommand(text).route})`);
  assert(inferProduct("churn and failed payments") === "REVENUE_RECOVERY", "inferProduct RR");
  assert(inferProduct("manual handoffs and bottlenecks") === "OPERATIONS_EFFICIENCY", "inferProduct OE");
  assert(inferProduct("quarterly review") === "BOTH", "inferProduct BOTH");
  assert(parseCadence("every week sweep") === "WEEKLY" && parseCadence("hourly status") === "HOURLY" && parseCadence("no cadence") === null, "parseCadence");
  assert(stepsFromDirective("detect then analyze billing then digest").map((s) => s.kind).join(",") === "DETECT,ANALYZE,BRIEF", "stepsFromDirective");

  // ——— Fixtures ———
  const acme = await prisma.organization.findUnique({ where: { slug: "acme-demo" } });
  const other = await prisma.organization.findUnique({ where: { slug: "other-co" } });
  const demo = await prisma.user.findUnique({ where: { email: "demo@kaivaryn.com" } });
  const owner = await prisma.user.findUnique({ where: { email: "owner@acme-demo.kaivaryn.com" } });
  const viewer = await prisma.user.findUnique({ where: { email: "viewer@acme-demo.kaivaryn.com" } });
  const otherUser = await prisma.user.findUnique({ where: { email: "analyst@other-co.test" } });
  if (!acme || !other || !demo || !owner || !viewer || !otherUser) {
    console.error("Seed fixtures missing — run the seed first");
    process.exit(1);
  }
  const A: OpCtx = { organizationId: acme.id, userId: demo.id, role: "ANALYST" };
  const AO: OpCtx = { organizationId: acme.id, userId: owner.id, role: "OWNER" };
  const AV: OpCtx = { organizationId: acme.id, userId: viewer.id, role: "VIEWER" };
  const B: OpCtx = { organizationId: other.id, userId: otherUser.id, role: "ANALYST" };
  const tag = `t${Date.now().toString(36)}`;

  // ——— 2. Command routes execute + record ———
  const ans = await executeCommand(A, "How much revenue have we recovered?");
  assert(ans.status === "OK" && ans.route === "ANSWER", "ANSWER executes");
  const stat = await executeCommand(A, "status");
  assert(stat.status === "OK" && /Health (OK|DEGRADED)/.test(stat.message), "STATUS executes with measured health");
  const an = await executeCommand(A, "Analyze revenue leakage in billing");
  assert(an.status === "OK" && /R1–R9 complete/.test(an.message), `ANALYZE runs nine-return cycle (${an.message.slice(0, 80)})`);
  const dg = await executeCommand(A, "digest");
  assert(dg.status === "OK" && dg.route === "DIGEST", "DIGEST executes");
  const rc = await executeCommand(A, "recall");
  assert(rc.status === "OK" && /continuity state/.test(rc.message), "RECALL returns continuity after cycles");
  const sr = await executeCommand(A, "find Northwind");
  assert(sr.status === "OK" && sr.route === "SEARCH", "SEARCH executes");
  const hp = await executeCommand(A, "help");
  assert(hp.status === "OK" && Array.isArray((hp.data as { help?: unknown[] })?.help), "HELP returns route reference");
  const rows = await prisma.opCommand.findMany({ where: { id: { in: [ans.id, stat.id, an.id] } } });
  assert(rows.length === 3 && rows.every((r) => r.organizationId === acme.id), "commands persisted with organizationId");

  // Idempotency
  const k = `${tag}:idem`;
  const i1 = await executeCommand(A, "status", { idempotencyKey: k });
  const i2 = await executeCommand(A, "status", { idempotencyKey: k });
  assert(i2.replay === true && i2.id === i1.id, "idempotent replay returns prior command");
  const bSameKey = await executeCommand(B, "status", { idempotencyKey: k });
  assert(bSameKey.id !== i1.id && !bSameKey.replay, "idempotency keys are tenant-scoped");

  // ——— 3. RBAC ———
  const vAnalyze = await executeCommand(AV, "Analyze churn");
  assert(vAnalyze.status === "DENIED", "VIEWER cannot run analysis");
  const vBuild = await executeCommand(AV, "Build a plan for billing");
  assert(vBuild.status === "DENIED", "VIEWER cannot create plans");
  const vAns = await executeCommand(AV, "Top opportunities");
  assert(vAns.status === "OK", "VIEWER can ask questions");
  await expectThrow(() => createStandingOrder(AV, { directive: "every day digest" }), "forbidden", "VIEWER cannot create standing orders");
  await expectThrow(() => savePlaybook(AV, { name: "nope", directive: "digest" }), "forbidden", "VIEWER cannot save playbooks");
  await expectThrow(() => runPlaybook(AV, "platform-health-check"), "forbidden", "VIEWER cannot run playbooks");

  // ——— 4. Human-in-the-loop approval gate ———
  const build = await executeCommand(A, `Plan a fix for unbilled change orders ${tag}`);
  const runId = (build.data as { runId?: string })?.runId;
  assert(build.status === "OK" && !!runId, "BUILD creates an action plan run");
  const paused = runId ? await getRun(A, runId) : null;
  assert(paused?.status === "WAITING_APPROVAL" && !!paused.approvalId, "plan pauses at approval gate");
  const appr = paused?.approvalId ? await prisma.approvalRequest.findUnique({ where: { id: paused.approvalId } }) : null;
  assert(appr?.type === "OPERATING_PLAN" && appr.organizationId === acme.id && appr.status === "PENDING", "OPERATING_PLAN approval recorded in same org");
  const task = runId ? await prisma.task.findFirst({ where: { entityType: "OpRun", entityId: runId } }) : null;
  assert(task?.organizationId === acme.id, "plan created an owned task in same org");
  // cross-tenant resume attempt must do nothing
  const crossResume = paused?.approvalId ? await onApprovalDecided(B, paused.approvalId, "APPROVED") : "skip";
  assert(crossResume === null, "other tenant cannot resume this run");
  if (paused?.approvalId) {
    await prisma.approvalRequest.update({ where: { id: paused.approvalId }, data: { status: "APPROVED", decidedById: owner.id, decidedAt: new Date() } });
    const resumed = await onApprovalDecided(AO, paused.approvalId, "APPROVED");
    assert(resumed?.status === "SUCCEEDED", `approved plan resumes to SUCCEEDED (got ${resumed?.status})`);
  }
  const build2 = await executeCommand(A, `Plan a rollout for invoice checks ${tag}`);
  const run2 = await getRun(A, (build2.data as { runId: string }).runId);
  if (run2?.approvalId) {
    const rej = await onApprovalDecided(AO, run2.approvalId, "REJECTED");
    assert(rej?.status === "CANCELLED", "rejected plan is cancelled");
  }

  // ——— 5. Playbooks + tenant isolation ———
  const acmeBooks = await listPlaybooks(A);
  assert(acmeBooks.filter((p) => p.isSystem).length >= 6, "system playbooks present for tenant");
  const sweep = acmeBooks.find((p) => p.slug === "revenue-leakage-sweep")!;
  await expectThrow(() => runPlaybook(B, sweep.id), "not_found", "other tenant cannot run acme playbook by id");
  const { run: pbRun } = await runPlaybook(A, "platform-health-check");
  assert(pbRun.status === "SUCCEEDED", "playbook run succeeds with evidence");
  assert((await getRun(B, pbRun.id)) === null, "other tenant cannot read acme run");
  const saved = await savePlaybook(A, { name: `Billing check ${tag}`, directive: "detect then analyze billing then digest" });
  assert(saved.organizationId === acme.id && JSON.parse(saved.stepsJson).length === 3, "saved playbook is tenant-owned with parsed steps");
  await expectThrow(() => savePlaybook(A, { name: "Revenue leakage sweep", directive: "digest" }), "conflict", "cannot overwrite system playbook");

  // ——— 6. Standing orders ———
  const so = await createStandingOrder(A, { directive: `every hour status ${tag}` });
  assert(so.kind === "STATUS" && so.cadence === "HOURLY" && so.organizationId === acme.id, "standing order parsed (STATUS/HOURLY)");
  await expectThrow(() => setStandingOrderEnabled(B, so.id, false), "not_found", "other tenant cannot toggle acme standing order");
  await expectThrow(() => createStandingOrder(A, { directive: "digest sometime" }), "cadence_unparsed", "standing order requires cadence");
  await prisma.opStandingOrder.update({ where: { id: so.id }, data: { nextRunAt: new Date(Date.now() - 60_000) } });
  const bDue = await runDueStandingOrders(B);
  assert(!bDue.some((r) => r.id === so.id), "other tenant run-due does not execute acme orders");
  const ran = await runDueStandingOrders(A);
  const after = ran.find((r) => r.id === so.id);
  assert(after?.lastStatus === "SUCCEEDED" && after.runCount === 1 && after.nextRunAt! > new Date(), "due standing order executed and rescheduled");
  await prisma.opStandingOrder.update({ where: { id: so.id }, data: { nextRunAt: new Date(Date.now() - 60_000) } });
  const tick = await tickAllOrganizations();
  assert(tick.some((t) => t.organizationId === acme.id && t.ran >= 1), "platform tick processes due orders per tenant");
  await prisma.opStandingOrder.delete({ where: { id: so.id } });

  // ——— 7. Initiatives ———
  const ini = await createInitiative(A, { name: `Initiative ${tag}`, product: "REVENUE_RECOVERY" });
  const opp = await prisma.opportunity.findFirst({ where: { organizationId: acme.id } });
  const otherOpp = await prisma.opportunity.findFirst({ where: { organizationId: other.id } });
  if (opp) await linkToInitiative(A, ini.id, "OPPORTUNITY", opp.id);
  if (otherOpp) await expectThrow(() => linkToInitiative(A, ini.id, "OPPORTUNITY", otherOpp.id), "not_found", "cannot link another tenant's opportunity");
  await expectThrow(() => linkToInitiative(B, ini.id, "RUN", pbRun.id), "not_found", "other tenant cannot link into acme initiative");
  const det = await getInitiativeDetail(A, ini.id);
  assert(det?.opps.length === 1 && typeof det.totals.pipelinePotential === "number", "initiative detail resolves links with separated money totals");
  assert((await getInitiativeDetail(B, ini.id)) === null, "other tenant cannot read acme initiative");

  // ——— 8. Briefings honesty + inbox isolation ———
  const { body: digest } = await buildDigest(A, "MANUAL");
  assert(digest.money.some((m) => m.nature === "ESTIMATE") && digest.money.some((m) => m.nature === "RECORDED"), "digest separates estimates from recorded outcomes");
  assert(!digest.money.some((m) => /total/i.test(m.label)), "digest never sums estimates and outcomes");
  const { body: bRecall } = await buildRecall(B, "MANUAL");
  assert(bRecall.continuity.every(() => true) && bRecall.notes.length >= 1, "recall returns honest notes");
  const inboxA = await getInbox(A);
  const inboxB = await getInbox(B);
  const aIds = new Set(inboxA.items.map((i) => i.id));
  assert(inboxA.counts.approvals >= 0 && !inboxB.items.some((i) => aIds.has(i.id)), "inboxes do not leak across tenants");
  const histB = await listCommandHistory(B, 200);
  assert(histB.every((c) => c.organizationId === other.id), "command history is tenant-scoped");

  // ——— 9. Health ———
  const h = await runHealthCheck(A, "MANUAL");
  assert(h.components.some((c) => c.key === "database" && c.status === "OK"), "health reports database OK");
  assert(h.components.some((c) => c.key === "integrations" && c.status === "INFO"), "missing integrations labeled INFO, not faked");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
