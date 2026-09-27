/**
 * META_RETURN_81 + Meta-Invariant. Bounded 9→81→729 track.
 * Never fabricates completion — pending_evidence when history < 81.
 */
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import {
  COGNITION_STAGES,
  EXPECTED_STAGE_HISTORY,
  MAX_META_WINDOWS,
  META_WINDOW,
  REQUIRED_META_ANALYSIS_KEYS,
  type SiProduct,
} from "./stages";
import { contentHash } from "./hash";
import { tryPromoteChallenger } from "./methods";

export async function listMetaEligibleCycleIds(
  organizationId: string,
  product: SiProduct,
  limit = META_WINDOW,
): Promise<string[]> {
  const rows = await prisma.siCognitionCycle.findMany({
    where: { organizationId, product, status: "succeeded", nestLevel: 0 },
    orderBy: { completedAt: "asc" },
    take: 500,
    select: { id: true },
  });
  return rows.map((r) => r.id).slice(-limit);
}

export async function computeMetaReturn81(input: {
  organizationId: string;
  product: SiProduct;
  idempotencyKey: string;
  actor?: string;
  cycleIds?: string[];
}) {
  const existing = await prisma.siMetaReturn.findUnique({
    where: {
      organizationId_product_idempotencyKey: {
        organizationId: input.organizationId,
        product: input.product,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });
  if (existing) return { meta: existing, created: false as const };

  let windowIds = input.cycleIds?.length
    ? input.cycleIds
    : await listMetaEligibleCycleIds(input.organizationId, input.product, META_WINDOW);

  if (windowIds.length < META_WINDOW) {
    throw Object.assign(new Error("insufficient_window"), {
      code: "insufficient_window",
      status: 409,
      message: `Need ${META_WINDOW} completed I-level cycles; have ${windowIds.length}`,
      have: windowIds.length,
    });
  }
  windowIds = windowIds.slice(-META_WINDOW);

  // Bound toward 729: count prior accepted/computed meta windows
  const priorWindows = await prisma.siMetaReturn.count({
    where: {
      organizationId: input.organizationId,
      product: input.product,
      status: { in: ["computed", "accepted"] },
    },
  });
  if (priorWindows >= MAX_META_WINDOWS) {
    throw Object.assign(new Error("meta_window_cap"), {
      code: "meta_window_cap",
      status: 409,
      message: `MAX_META_WINDOWS=${MAX_META_WINDOWS} reached (729 track). Rollback or archive before new META.`,
    });
  }

  const stageHistoryCount = await prisma.siStageOutput.count({
    where: {
      organizationId: input.organizationId,
      cycleId: { in: windowIds },
      stage: { in: [...COGNITION_STAGES] },
    },
  });

  const [critics, metas, calibs, methods, contradictions] = await Promise.all([
    prisma.siStageOutput.findMany({ where: { cycleId: { in: windowIds }, stage: "CRITIC" } }),
    prisma.siStageOutput.findMany({ where: { cycleId: { in: windowIds }, stage: "META" } }),
    prisma.siStageOutput.findMany({ where: { cycleId: { in: windowIds }, stage: "CALIBRATION" } }),
    prisma.siMethodRegistry.findMany({ where: { organizationId: input.organizationId, product: input.product } }),
    prisma.siMemoryItem.findMany({
      where: { organizationId: input.organizationId, product: input.product, kind: "contradiction" },
      take: 50,
    }),
  ]);

  const recurring_errors: string[] = [];
  for (const row of critics) {
    const findings = (JSON.parse(row.outputJson) as { critic_findings?: unknown[] }).critic_findings;
    if (Array.isArray(findings)) {
      for (const f of findings) {
        const s = typeof f === "string" ? f : JSON.stringify(f);
        if (s && !recurring_errors.includes(s)) recurring_errors.push(s);
      }
    }
  }
  const recurring_strengths: string[] = [];
  for (const row of metas) {
    const pats = (JSON.parse(row.outputJson) as { meta_patterns?: unknown[] }).meta_patterns;
    if (Array.isArray(pats)) {
      for (const p of pats) {
        const s = typeof p === "string" ? p : JSON.stringify(p);
        if (s && !recurring_strengths.includes(s)) recurring_strengths.push(s);
      }
    }
  }

  const analysis: Record<string, unknown> = {
    recurring_errors: recurring_errors.slice(0, 20),
    recurring_strengths: recurring_strengths.slice(0, 20),
    cross_cycle_patterns: [
      `window_size=${windowIds.length}`,
      `stage_history_count=${stageHistoryCount}`,
      `expected=${EXPECTED_STAGE_HISTORY}`,
      `window_index=${priorWindows}`,
      `toward_729=${(priorWindows + 1) * EXPECTED_STAGE_HISTORY}`,
    ],
    generalized_methods: methods.filter((m) => m.status === "active" || m.status === "proposed").map((m) => m.methodKey),
    failed_methods: methods.filter((m) => m.status === "deprecated" || m.status === "retired").map((m) => m.methodKey),
    calibration_deltas: {
      samples: calibs.length,
      notes: calibs.map((r) => (JSON.parse(r.outputJson) as { calibration_notes?: string }).calibration_notes).filter(Boolean),
    },
    self_model_evolution: {
      window_cycles: windowIds.length,
      note: "Derived from SELF/WITNESS stage presence across window",
    },
    method_performance: Object.fromEntries(methods.map((m) => [m.methodKey, JSON.parse(m.empiricalJson || "{}")])),
    contradictions: contradictions.map((c) => ({ id: c.id, summary: c.summary })),
    transferable_discoveries: [
      "Witness-only ZERO_STATE_NEXT",
      "CYCLE_INVARIANT per completed cycle",
      "Champion/challenger measured promotion gate",
      "META_RETURN_81 pending_evidence honesty",
    ],
  };

  for (const k of REQUIRED_META_ANALYSIS_KEYS) {
    if (!(k in analysis)) throw new Error(`analysis missing required key ${k}`);
  }

  const cycles = await prisma.siCognitionCycle.findMany({
    where: { id: { in: windowIds } },
    select: { tokensUsed: true, computeMsUsed: true },
  });
  const investment = {
    compute_ms: cycles.reduce((a, c) => a + c.computeMsUsed, 0),
    tokens: cycles.reduce((a, c) => a + c.tokensUsed, 0),
    human_minutes: 0,
    money_usd: 0,
  };

  const fullHistory = stageHistoryCount >= EXPECTED_STAGE_HISTORY;
  const status = fullHistory ? "computed" : "pending_evidence";
  const evidencePackUri = `evidence://meta81/${input.organizationId}/${input.product}/${input.idempotencyKey}`;

  const meta = await prisma.siMetaReturn.create({
    data: {
      organizationId: input.organizationId,
      product: input.product,
      protocolVersion: "81",
      windowCycleIdsJson: JSON.stringify(windowIds),
      stageHistoryCount,
      expectedStageCount: EXPECTED_STAGE_HISTORY,
      analysisJson: JSON.stringify(analysis),
      investmentJson: JSON.stringify(investment),
      returnObservedJson: JSON.stringify({}),
      status,
      baselineRef: `baseline:window:${windowIds[0]}`,
      evidencePackUri,
      windowIndex: priorWindows,
      idempotencyKey: input.idempotencyKey,
      judgedBy: input.actor || "system",
    },
  });

  await writeAudit({
    organizationId: input.organizationId,
    action: "si.meta81.computed",
    entityType: "SiMetaReturn",
    entityId: meta.id,
    metadata: { status, stageHistoryCount, windowIndex: priorWindows, product: input.product },
  });

  return { meta, created: true as const, analysis, fullHistory };
}

/**
 * Accept META only with measured return_observed + return_ratio.
 * Writes META_INVARIANT on the last cycle in the window.
 */
export async function acceptMetaReturn81(input: {
  organizationId: string;
  metaId: string;
  returnObserved: Record<string, unknown>;
  returnRatio: number;
  actor?: string;
}) {
  const meta = await prisma.siMetaReturn.findFirst({
    where: { id: input.metaId, organizationId: input.organizationId },
  });
  if (!meta) throw Object.assign(new Error("meta_not_found"), { code: "meta_not_found", status: 404 });
  if (meta.status === "pending_evidence") {
    throw Object.assign(new Error("pending_evidence"), {
      code: "pending_evidence",
      status: 409,
      message: "Cannot accept META_RETURN_81 while stage history is incomplete",
    });
  }
  if (typeof input.returnRatio !== "number" || Number.isNaN(input.returnRatio)) {
    throw Object.assign(new Error("return_ratio_required"), {
      code: "return_ratio_required",
      status: 400,
      message: "META accept requires measured return_observed + return_ratio",
    });
  }

  const windowIds = JSON.parse(meta.windowCycleIdsJson) as string[];
  const lastCycleId = windowIds[windowIds.length - 1]!;
  const invEvidence = {
    meta_id: meta.id,
    window_cycle_ids: windowIds,
    stage_history_count: meta.stageHistoryCount,
    return_ratio: input.returnRatio,
    return_observed: input.returnObserved,
    window_index: meta.windowIndex,
  };
  const invHash = contentHash(invEvidence);

  const invariant = await prisma.siCycleInvariant.create({
    data: {
      organizationId: input.organizationId,
      product: meta.product,
      cycleId: lastCycleId,
      kind: "META_INVARIANT",
      statement: `META_INVARIANT: META_RETURN_81 accepted ratio=${input.returnRatio} window=${meta.windowIndex}`,
      evidenceJson: JSON.stringify(invEvidence),
      contentHash: invHash,
      metaReturnId: meta.id,
    },
  });

  const updated = await prisma.siMetaReturn.update({
    where: { id: meta.id },
    data: {
      status: "accepted",
      returnObservedJson: JSON.stringify(input.returnObserved),
      returnRatio: input.returnRatio,
      metaInvariantId: invariant.id,
      acceptedAt: new Date(),
      judgedBy: input.actor || meta.judgedBy,
    },
  });

  // Attempt challenger promotion only after measured meta accept
  const promotion = await tryPromoteChallenger(input.organizationId, meta.product as SiProduct);

  await writeAudit({
    organizationId: input.organizationId,
    action: "si.meta81.accepted",
    entityType: "SiMetaReturn",
    entityId: meta.id,
    metadata: { returnRatio: input.returnRatio, META_INVARIANT: invariant.id, promotion },
  });

  return { meta: updated, invariant, promotion };
}

export async function getMetaProgress(organizationId: string, product: SiProduct) {
  const succeeded = await prisma.siCognitionCycle.count({
    where: { organizationId, product, status: "succeeded", nestLevel: 0 },
  });
  const metas = await prisma.siMetaReturn.findMany({
    where: { organizationId, product },
    orderBy: { windowIndex: "asc" },
  });
  const toward81 = Math.min(succeeded, META_WINDOW);
  const windowsDone = metas.filter((m) => m.status === "accepted" || m.status === "computed").length;
  return {
    product,
    succeeded_cycles: succeeded,
    toward_meta81: toward81,
    meta81_ready: succeeded >= META_WINDOW,
    meta_windows_done: windowsDone,
    max_meta_windows: MAX_META_WINDOWS,
    toward_729_stages: windowsDone * EXPECTED_STAGE_HISTORY,
    cap_729_stages: MAX_META_WINDOWS * EXPECTED_STAGE_HISTORY,
    metas: metas.map((m) => ({
      id: m.id,
      status: m.status,
      windowIndex: m.windowIndex,
      stageHistoryCount: m.stageHistoryCount,
      returnRatio: m.returnRatio,
      createdAt: m.createdAt,
    })),
  };
}
