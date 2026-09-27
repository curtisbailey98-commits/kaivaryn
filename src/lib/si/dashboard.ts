/**
 * Premium client intelligence metrics — real DB only, never fabricated.
 */
import { prisma } from "@/lib/prisma";
import type { SiProduct } from "./stages";
import { getMetaProgress } from "./meta";
import { listMethods } from "./methods";
import { COGNITION_STAGES } from "./stages";

export async function getProductIntelligenceDashboard(organizationId: string, product: SiProduct) {
  const [
    cycles,
    canonical,
    invariants,
    predictions,
    lessons,
    errors,
    memories,
    methods,
    metaProgress,
    learning,
  ] = await Promise.all([
    prisma.siCognitionCycle.findMany({
      where: { organizationId, product },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { stageOutputs: { select: { stage: true, returnIndex: true } } },
    }),
    prisma.siZeroState.findFirst({
      where: { organizationId, product, isCanonical: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.siCycleInvariant.findMany({
      where: { organizationId, product },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.siPrediction.groupBy({
      by: ["status"],
      where: { organizationId, product },
      _count: { _all: true },
    }),
    prisma.siLesson.count({ where: { organizationId, product } }),
    prisma.siErrorRecord.count({ where: { organizationId, product } }),
    prisma.siMemoryItem.count({ where: { organizationId, product } }),
    listMethods(organizationId, product),
    getMetaProgress(organizationId, product),
    prisma.learningProfile.findUnique({
      where: { organizationId_product: { organizationId, product } },
    }),
  ]);

  const succeeded = cycles.filter((c) => c.status === "succeeded");
  const lastSucceeded = succeeded[0] ?? null;
  const stageCoverage =
    lastSucceeded && lastSucceeded.stageOutputs.length
      ? lastSucceeded.stageOutputs.map((s) => s.stage)
      : [];

  return {
    product,
    protocol: "720SI-Kaivaryn-RR-OE-v1",
    honesty: "metrics_from_tenant_db_only",
    kpis: {
      cycles_total: await prisma.siCognitionCycle.count({ where: { organizationId, product } }),
      cycles_succeeded: await prisma.siCognitionCycle.count({
        where: { organizationId, product, status: "succeeded" },
      }),
      cycles_failed: await prisma.siCognitionCycle.count({
        where: { organizationId, product, status: "failed" },
      }),
      canonical_zero_state: canonical
        ? { id: canonical.id, hash: canonical.contentHash, writtenBy: canonical.writtenByStage, at: canonical.createdAt }
        : null,
      invariants: invariants.length,
      lessons,
      errors,
      memories,
      predictions_by_status: Object.fromEntries(predictions.map((p) => [p.status, p._count._all])),
      learning_confidence: learning?.confidence ?? "NONE",
      learning_samples: learning?.sampleSize ?? 0,
    },
    meta: metaProgress,
    methods: methods.map((m) => ({
      methodKey: m.methodKey,
      role: m.role,
      status: m.status,
      version: m.version,
      empirical: JSON.parse(m.empiricalJson || "{}"),
      promotedAt: m.promotedAt,
    })),
    recent_cycles: cycles.map((c) => ({
      id: c.id,
      status: c.status,
      currentStage: c.currentStage,
      returnIndex: c.returnIndex,
      methodKey: c.methodKey,
      methodRole: c.methodRole,
      stagesDone: c.stageOutputs.length,
      stagesExpected: COGNITION_STAGES.length,
      completedAt: c.completedAt,
      createdAt: c.createdAt,
      invariantId: c.invariantId,
      zeroStateId: c.zeroStateId,
    })),
    last_cycle_stage_coverage: stageCoverage,
    invariants: invariants.map((i) => ({
      id: i.id,
      kind: i.kind,
      statement: i.statement,
      contentHash: i.contentHash,
      createdAt: i.createdAt,
    })),
  };
}

export async function getExecutiveSiSummary() {
  const [cycleCounts, metaCounts, methodCounts, canonicalHeads] = await Promise.all([
    prisma.siCognitionCycle.groupBy({
      by: ["product", "status"],
      _count: { _all: true },
    }),
    prisma.siMetaReturn.groupBy({
      by: ["product", "status"],
      _count: { _all: true },
    }),
    prisma.siMethodRegistry.groupBy({
      by: ["product", "role", "status"],
      _count: { _all: true },
    }),
    prisma.siZeroState.count({ where: { isCanonical: true } }),
  ]);
  return {
    cycleCounts,
    metaCounts,
    methodCounts,
    canonicalHeads,
    chiefIntegration: {
      note: "CHIEF Foundry remains at /executive/chief — SI cycles feed CEO visibility; CHIEF manufactures agents, not Zero cycles.",
      href: "/executive/chief",
    },
  };
}
