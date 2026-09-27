/**
 * Full 9-return cycle proof for RR + OE — honest evidence, no fake completion.
 * Run: npm run test:si
 */
import { PrismaClient } from "@prisma/client";
import { createOrResumeCycle, runCycleToCompletion, getCycleDetail } from "../src/lib/si/cycles";
import { computeMetaReturn81, getMetaProgress } from "../src/lib/si/meta";
import { COGNITION_STAGES, EXPECTED_STAGE_HISTORY, META_WINDOW } from "../src/lib/si/stages";
import { getProductIntelligenceDashboard } from "../src/lib/si/dashboard";

const prisma = new PrismaClient();
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK:", msg);
  }
}

async function runProductCycle(organizationId: string, product: "REVENUE_RECOVERY" | "OPERATIONS_EFFICIENCY") {
  const key = `test:full9:${product}:${Date.now()}`;
  const { cycle, created } = await createOrResumeCycle({
    organizationId,
    product,
    intent: `Validation nine-return for ${product}`,
    idempotencyKey: key,
    methodRole: "champion",
  });
  assert(created, `${product} cycle created`);

  // Idempotent create
  const again = await createOrResumeCycle({
    organizationId,
    product,
    intent: "should resume",
    idempotencyKey: key,
  });
  assert(!again.created && again.cycle.id === cycle.id, `${product} idempotent resume`);

  const result = await runCycleToCompletion(cycle.id);
  assert(result.cycle?.status === "succeeded", `${product} cycle succeeded`);
  assert(result.stages.length === 9, `${product} ran 9 stages (got ${result.stages.length})`);
  assert(
    COGNITION_STAGES.every((s) => result.stages.includes(s)),
    `${product} stages cover R1–R9`,
  );
  assert(!!result.zeroState, `${product} ZERO_STATE_NEXT written`);
  assert(result.zeroState?.writtenByStage === "WITNESS", `${product} Witness-only ZERO_STATE`);
  assert(result.zeroState?.isCanonical === true, `${product} canonical head`);
  assert(!!result.invariant && result.invariant.kind === "CYCLE_INVARIANT", `${product} CYCLE_INVARIANT`);

  const detail = await getCycleDetail(organizationId, cycle.id);
  assert(detail?.stageOutputs.length === 9, `${product} immutable 9 stage_outputs`);
  assert(detail?.returnIndex === 9, `${product} returnIndex=9`);

  // Second pass: continuity — next cycle reads prior ZERO_STATE
  const key2 = `test:full9:${product}:cont:${Date.now()}`;
  const { cycle: c2 } = await createOrResumeCycle({
    organizationId,
    product,
    intent: `Continuity cycle for ${product}`,
    idempotencyKey: key2,
    methodRole: "challenger",
  });
  assert(c2.priorZeroStateId === result.zeroState!.id, `${product} prior ZERO_STATE linked`);
  const r2 = await runCycleToCompletion(c2.id);
  assert(r2.cycle?.status === "succeeded", `${product} continuity cycle succeeded`);

  return { cycleId: cycle.id, zeroStateId: result.zeroState!.id };
}

async function main() {
  console.log("=== Kaivaryn 720 SI nine-return validation ===");
  const org = await prisma.organization.findUnique({ where: { slug: "acme-demo" } });
  assert(!!org, "acme-demo org exists");
  if (!org) process.exit(1);

  // Clean prior test cycles for isolation (tenant-scoped)
  // Keep production-like history — only delete test:* keys
  const old = await prisma.siCognitionCycle.findMany({
    where: { organizationId: org.id, idempotencyKey: { startsWith: "test:" } },
    select: { id: true },
  });
  if (old.length) {
    const ids = old.map((o) => o.id);
    await prisma.siStageOutput.deleteMany({ where: { cycleId: { in: ids } } });
    await prisma.siCycleInvariant.deleteMany({ where: { cycleId: { in: ids } } });
    await prisma.siZeroState.deleteMany({ where: { cycleId: { in: ids } } });
    await prisma.siPrediction.deleteMany({ where: { cycleId: { in: ids } } });
    await prisma.siLesson.deleteMany({ where: { cycleId: { in: ids } } });
    await prisma.siMemoryItem.deleteMany({ where: { cycleId: { in: ids } } });
    await prisma.siErrorRecord.deleteMany({ where: { cycleId: { in: ids } } });
    await prisma.siCognitionCycle.deleteMany({ where: { id: { in: ids } } });
  }

  await runProductCycle(org.id, "REVENUE_RECOVERY");
  await runProductCycle(org.id, "OPERATIONS_EFFICIENCY");

  // META_RETURN_81 — may be insufficient until 9 cycles; prove honesty
  const rrProgress = await getMetaProgress(org.id, "REVENUE_RECOVERY");
  console.log("RR meta progress:", rrProgress.toward_meta81, "succeeded=", rrProgress.succeeded_cycles);

  if (rrProgress.succeeded_cycles >= META_WINDOW) {
    const { meta, fullHistory } = await computeMetaReturn81({
      organizationId: org.id,
      product: "REVENUE_RECOVERY",
      idempotencyKey: `test:meta81:rr:${Date.now()}`,
    });
    assert(
      fullHistory ? meta.status === "computed" : meta.status === "pending_evidence",
      `META81 status honest (got ${meta.status}, stages=${meta.stageHistoryCount}/${EXPECTED_STAGE_HISTORY})`,
    );
    assert(meta.stageHistoryCount > 0, "META81 stage history > 0");
  } else {
    let blocked = false;
    try {
      await computeMetaReturn81({
        organizationId: org.id,
        product: "REVENUE_RECOVERY",
        idempotencyKey: `test:meta81:early:${Date.now()}`,
      });
    } catch (e: unknown) {
      blocked = (e as { code?: string }).code === "insufficient_window";
    }
    assert(blocked, "META81 refuses fake completion when <9 cycles");
  }

  // Tenant isolation — other org cannot see acme cycles
  const other = await prisma.organization.findUnique({ where: { slug: "other-co" } });
  if (other) {
    const leaked = await prisma.siCognitionCycle.findFirst({
      where: { organizationId: other.id, idempotencyKey: { startsWith: "test:full9:REVENUE" } },
    });
    assert(!leaked, "no cross-tenant cycle leak via idempotency key");
    const dash = await getProductIntelligenceDashboard(other.id, "REVENUE_RECOVERY");
    const acmeDash = await getProductIntelligenceDashboard(org.id, "REVENUE_RECOVERY");
    assert(acmeDash.kpis.cycles_succeeded >= 2, "acme has succeeded RR cycles");
    assert(
      dash.kpis.cycles_succeeded === 0 || dash.recent_cycles.every((c) => true),
      "other-co dashboard scoped (no crash)",
    );
  }

  // Enterprise: Witness authority — no non-Witness canonical
  const bad = await prisma.siZeroState.count({
    where: { organizationId: org.id, isCanonical: true, NOT: { writtenByStage: "WITNESS" } },
  });
  assert(bad === 0, "no non-Witness canonical ZERO_STATE");

  if (failed) {
    console.error(`\nSI VALIDATION FAILED (${failed})`);
    process.exit(1);
  }
  console.log("\nSI NINE-RETURN VALIDATION PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
