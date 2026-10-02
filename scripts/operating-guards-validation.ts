/**
 * Operating-layer guard tests — the write paths behind the server actions in
 * src/app/app/operate-actions.ts (cancel, delete, toggle, link, status, mark-read)
 * plus the in-app return-path guard. Complements test:operate (routing, runs, gates).
 * Run: npm run test:operate:guards   (needs a seeded database)
 */
import { PrismaClient } from "@prisma/client";
import {
  savePlaybook,
  deletePlaybook,
  listPlaybooks,
  runPlaybook,
  cancelRun,
  createStandingOrder,
  setStandingOrderEnabled,
  deleteStandingOrder,
  runStandingOrder,
  createInitiative,
  linkToInitiative,
  setInitiativeStatus,
  buildDigest,
  markBriefingRead,
  getBriefing,
  executeCommand,
  type OpCtx,
} from "../src/lib/operate";
import { safeReturnPath } from "../src/lib/operate/paths";

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
async function expectCode(fn: () => Promise<unknown>, code: string, msg: string) {
  try {
    await fn();
    assert(false, `${msg} (expected ${code}, no error)`);
  } catch (e) {
    const c = (e as { code?: string }).code;
    assert(c === code, `${msg} (got ${c ?? (e as Error).message})`);
  }
}

async function main() {
  console.log("=== Kaivaryn operating-layer guard validation ===");

  // ——— Return-path guard (pure) ———
  const ok: Array<[unknown, string]> = [
    ["/app/command", "/app/command"],
    ["/app/action-center", "/app/action-center"],
    ["/app/automations?run=abc123", "/app/automations?run=abc123"],
    ["/app/automations#runs", "/app/automations#runs"],
  ];
  for (const [input, want] of ok) assert(safeReturnPath(input, "/fallback") === want, `safeReturnPath keeps ${String(input)}`);
  const bad: unknown[] = ["https://evil.example", "//evil.example/app", "/\\evil", "/admin", "/app/../admin", "javascript:alert(1)", "", null, 42, "/apps-evil", "/app/x y"];
  for (const input of bad) assert(safeReturnPath(input, "/fallback") === "/fallback", `safeReturnPath rejects ${JSON.stringify(input)}`);

  // ——— Fixtures ———
  const acme = await prisma.organization.findUnique({ where: { slug: "acme-demo" } });
  const other = await prisma.organization.findUnique({ where: { slug: "other-co" } });
  const demo = await prisma.user.findUnique({ where: { email: "demo@kaivaryn.com" } });
  const viewer = await prisma.user.findUnique({ where: { email: "viewer@acme-demo.kaivaryn.com" } });
  const otherUser = await prisma.user.findUnique({ where: { email: "analyst@other-co.test" } });
  if (!acme || !other || !demo || !viewer || !otherUser) {
    console.error("Seed fixtures missing — run the seed first");
    process.exit(1);
  }
  const A: OpCtx = { organizationId: acme.id, userId: demo.id, role: "ANALYST" };
  const AV: OpCtx = { organizationId: acme.id, userId: viewer.id, role: "VIEWER" };
  const B: OpCtx = { organizationId: other.id, userId: otherUser.id, role: "ANALYST" };
  const tag = `guard-${Date.now().toString(36)}`;
  const cleanup: Array<() => Promise<unknown>> = [];

  try {
    // ——— Playbooks: system protected, tenant-owned deletes only ———
    const sys = (await listPlaybooks(A)).find((p) => p.isSystem);
    assert(!!sys, "acme has a system playbook");
    if (sys) assert((await deletePlaybook(A, sys.id)) === 0, "system playbook cannot be deleted");
    const pb = await savePlaybook(A, { name: `Guard ${tag}`, directive: "detect then digest", product: "BOTH" });
    cleanup.push(() => prisma.opPlaybook.deleteMany({ where: { id: pb.id } }));
    await expectCode(() => savePlaybook(AV, { name: `Viewer ${tag}`, directive: "digest", product: "BOTH" }), "forbidden", "VIEWER cannot save a playbook");
    await expectCode(() => deletePlaybook(AV, pb.id), "forbidden", "VIEWER cannot delete a playbook");
    assert((await deletePlaybook(B, pb.id)) === 0, "other tenant cannot delete acme playbook");
    assert(!!(await prisma.opPlaybook.findUnique({ where: { id: pb.id } })), "acme playbook survives cross-tenant delete");
    await expectCode(() => runPlaybook(B, pb.id), "not_found", "other tenant cannot run acme playbook");

    // ——— Runs: cancel is RBAC + tenant guarded ———
    const queued = await prisma.opRun.create({
      data: { organizationId: acme.id, title: `Guard run ${tag}`, source: "MANUAL", status: "QUEUED", stepsJson: "[]" },
    });
    cleanup.push(() => prisma.opRun.deleteMany({ where: { id: queued.id } }));
    await expectCode(() => cancelRun(AV, queued.id), "forbidden", "VIEWER cannot cancel a run");
    assert((await cancelRun(B, queued.id)) === 0, "other tenant cannot cancel acme run");
    assert((await prisma.opRun.findUnique({ where: { id: queued.id } }))?.status === "QUEUED", "acme run untouched by cross-tenant cancel");
    assert((await cancelRun(A, queued.id)) === 1, "analyst cancels own-tenant queued run");
    assert((await cancelRun(A, queued.id)) === 0, "cancelling a finished run is a no-op");

    // ——— Standing orders ———
    const so = await createStandingOrder(A, { directive: `every week digest ${tag}` });
    cleanup.push(() => prisma.opStandingOrder.deleteMany({ where: { id: so.id } }));
    assert(so.organizationId === acme.id && so.cadence === "WEEKLY", "standing order created in acting tenant");
    await expectCode(() => createStandingOrder(AV, { directive: "every day digest" }), "forbidden", "VIEWER cannot create a standing order");
    await expectCode(() => setStandingOrderEnabled(B, so.id, false), "not_found", "other tenant cannot pause acme standing order");
    await expectCode(() => runStandingOrder(B, so.id), "not_found", "other tenant cannot run acme standing order");
    await expectCode(() => runStandingOrder(AV, so.id), "forbidden", "VIEWER cannot run a standing order");
    assert((await deleteStandingOrder(B, so.id)) === 0, "other tenant cannot delete acme standing order");
    const paused = await setStandingOrderEnabled(A, so.id, false);
    assert(paused.enabled === false, "owner tenant can pause its standing order");
    assert((await deleteStandingOrder(A, so.id)) === 1, "owner tenant can delete its standing order");

    // ——— Initiatives: link targets must belong to the same tenant ———
    const ini = await createInitiative(A, { name: `Guard initiative ${tag}`, product: "BOTH" });
    cleanup.push(() => prisma.opInitiativeLink.deleteMany({ where: { initiativeId: ini.id } }));
    cleanup.push(() => prisma.opInitiative.deleteMany({ where: { id: ini.id } }));
    const otherOpp = await prisma.opportunity.findFirst({ where: { organizationId: other.id }, select: { id: true } });
    const acmeOpp = await prisma.opportunity.findFirst({ where: { organizationId: acme.id }, select: { id: true } });
    if (otherOpp) await expectCode(() => linkToInitiative(A, ini.id, "OPPORTUNITY", otherOpp.id), "not_found", "cannot link another tenant's opportunity");
    else assert(true, "(skip) other tenant has no opportunity to attempt linking");
    if (acmeOpp) {
      await expectCode(() => linkToInitiative(B, ini.id, "OPPORTUNITY", acmeOpp.id), "not_found", "other tenant cannot link into acme initiative");
      const link = await linkToInitiative(A, ini.id, "OPPORTUNITY", acmeOpp.id);
      assert(link.organizationId === acme.id, "same-tenant link recorded with organizationId");
    }
    await expectCode(() => linkToInitiative(A, ini.id, "NOT_A_TYPE" as never, "x"), "invalid", "unsupported link type rejected");
    await expectCode(() => setInitiativeStatus(B, ini.id, "COMPLETED"), "not_found", "other tenant cannot change acme initiative status");
    await expectCode(() => setInitiativeStatus(AV, ini.id, "PAUSED"), "forbidden", "VIEWER cannot change initiative status");
    assert((await setInitiativeStatus(A, ini.id, "PAUSED")) === 1, "owner tenant can pause initiative");

    // ——— Briefings: mark-read is tenant-scoped ———
    const { briefing } = await buildDigest(A, "MANUAL");
    cleanup.push(() => prisma.opBriefing.deleteMany({ where: { id: briefing.id } }));
    assert((await markBriefingRead(B, briefing.id)) === 0, "other tenant cannot mark acme briefing read");
    assert((await getBriefing(B, briefing.id)) === null, "other tenant cannot read acme briefing");
    assert((await getBriefing(A, briefing.id))?.readAt == null, "acme briefing still unread after cross-tenant attempt");
    assert((await markBriefingRead(A, briefing.id)) === 1, "owner tenant marks briefing read");

    // ——— Command: viewer-safe routes still work, writes denied, record tenant-scoped ———
    const vStanding = await executeCommand(AV, "every day send me a digest");
    assert(vStanding.status === "DENIED", "VIEWER cannot schedule standing orders via Command");
    const vStatus = await executeCommand(AV, "status");
    assert(vStatus.status === "OK", "VIEWER can run status via Command");
    const cmdRow = await prisma.opCommand.findUnique({ where: { id: vStatus.id } });
    assert(cmdRow?.organizationId === acme.id, "viewer command recorded in viewer's tenant");
    cleanup.push(() => prisma.opCommand.deleteMany({ where: { id: { in: [vStanding.id, vStatus.id] } } }));
  } finally {
    for (const fn of cleanup.reverse()) await fn().catch(() => undefined);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  if (failed) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
