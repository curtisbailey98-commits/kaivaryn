/**
 * Bounded resumable nine-return cycles for RR + OE.
 * Idempotent recovery; immutable stage history; Witness-only ZERO_STATE_NEXT.
 */
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import {
  COGNITION_STAGES,
  RETURN_INDEX,
  SI_PROTOCOL,
  continuityKey,
  nextCognitionStage,
  type CognitionStage,
  type SiProduct,
  type ZeroStatePayload,
} from "./stages";
import { contentHash } from "./hash";
import { perceiveProductReality, loadLearningSignals } from "./perception";
import { getChampion, getChallenger, recordMethodOutcome } from "./methods";

export type CreateCycleInput = {
  organizationId: string;
  product: SiProduct;
  intent: string;
  idempotencyKey: string;
  createdById?: string | null;
  methodRole?: "champion" | "challenger";
};

async function loadCanonicalZeroState(organizationId: string, product: SiProduct) {
  return prisma.siZeroState.findFirst({
    where: { organizationId, product, isCanonical: true, continuityKey: continuityKey(organizationId, product) },
    orderBy: { createdAt: "desc" },
  });
}

export async function createOrResumeCycle(input: CreateCycleInput) {
  const existing = await prisma.siCognitionCycle.findUnique({
    where: {
      organizationId_product_idempotencyKey: {
        organizationId: input.organizationId,
        product: input.product,
        idempotencyKey: input.idempotencyKey,
      },
    },
    include: { stageOutputs: true },
  });
  if (existing) {
    return { cycle: existing, created: false as const };
  }

  const method =
    input.methodRole === "challenger"
      ? await getChallenger(input.organizationId, input.product)
      : await getChampion(input.organizationId, input.product);
  const prior = await loadCanonicalZeroState(input.organizationId, input.product);

  const cycle = await prisma.siCognitionCycle.create({
    data: {
      organizationId: input.organizationId,
      product: input.product,
      intent: input.intent.trim() || `${input.product} nine-return cycle`,
      status: "queued",
      currentStage: "REALITY",
      stageStatus: "stage_pending",
      idempotencyKey: input.idempotencyKey,
      priorZeroStateId: prior?.id ?? null,
      methodKey: method?.methodKey ?? null,
      methodRole: method?.role ?? null,
      createdById: input.createdById ?? null,
      evidencePackUri: `evidence://si/${input.organizationId}/${input.product}`,
    },
    include: { stageOutputs: true },
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.createdById,
    action: "si.cycle.created",
    entityType: "SiCognitionCycle",
    entityId: cycle.id,
    metadata: { product: input.product, idempotencyKey: input.idempotencyKey, methodKey: method?.methodKey },
  });

  return { cycle, created: true as const };
}

async function buildStageOutput(args: {
  cycle: {
    id: string;
    organizationId: string;
    product: string;
    intent: string;
    methodKey: string | null;
    methodRole: string | null;
    priorZeroStateId: string | null;
    tokensUsed: number;
    computeMsUsed: number;
  };
  stage: CognitionStage;
  priorOutputs: Record<string, unknown>;
  priorZero: { id: string; contentHash: string; payloadJson: string } | null;
}) {
  const product = args.cycle.product as SiProduct;
  const t0 = Date.now();
  const reality = await perceiveProductReality(args.cycle.organizationId, product);
  const learning = await loadLearningSignals(args.cycle.organizationId, product);
  const priorPayload = args.priorZero ? (JSON.parse(args.priorZero.payloadJson) as ZeroStatePayload) : null;
  const computeMs = Math.max(1, Date.now() - t0);

  const base = {
    stage: args.stage,
    return_index: RETURN_INDEX[args.stage],
    cycle_id: args.cycle.id,
    intent: args.cycle.intent,
    protocol: SI_PROTOCOL,
    product,
    method_key: args.cycle.methodKey,
    method_role: args.cycle.methodRole,
    prior_zero_state_id: args.priorZero?.id ?? null,
    prior_zero_state_hash: args.priorZero?.contentHash ?? null,
    model: "kaivaryn-deterministic-si-v1",
  };

  switch (args.stage) {
    case "REALITY":
      return {
        output: {
          ...base,
          observations: reality.observations,
          evidence_available: reality.evidence_available,
          reality_summary: reality.reality_summary,
          metrics: reality.metrics,
          sample_ids: reality.sample_ids,
          insufficient_reason: reality.insufficient_reason ?? null,
          prior_hints: priorPayload?.next_cycle_hints ?? [],
        },
        tokensUsed: 40,
        computeMs,
        reality,
      };
    case "MEMORY": {
      const memories = await prisma.siMemoryItem.findMany({
        where: { organizationId: args.cycle.organizationId, product },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      const memory_refs = [
        ...(args.priorZero ? [args.priorZero.id] : []),
        ...memories.map((m) => m.id),
        ...(learning.lessons.map((l) => l.id) as string[]),
      ];
      return {
        output: {
          ...base,
          retrieved: {
            prior_zero_state: priorPayload
              ? {
                  id: args.priorZero?.id,
                  hash: args.priorZero?.contentHash,
                  witness_decision: priorPayload.witness_decision,
                  reality_summary: priorPayload.reality_summary,
                }
              : null,
            episodic: memories.filter((m) => m.kind === "episodic").slice(0, 10),
            semantic: memories.filter((m) => m.kind === "semantic").slice(0, 10),
            lessons: learning.lessons.slice(0, 10),
            learning_profile: learning.profile
              ? {
                  sampleSize: learning.profile.sampleSize,
                  confidence: learning.profile.confidence,
                  positiveCount: learning.profile.positiveCount,
                  negativeCount: learning.profile.negativeCount,
                }
              : null,
            open_predictions: await prisma.siPrediction.findMany({
              where: { organizationId: args.cycle.organizationId, product, status: "open" },
              take: 10,
            }),
          },
          memory_refs,
          lessons: learning.lessons.map((l) => ({ id: l.id, lesson: l.lesson })),
        },
        tokensUsed: 60,
        computeMs,
        reality,
      };
    }
    case "PREDICTION": {
      const metrics = (args.priorOutputs.REALITY as { metrics?: Record<string, number> })?.metrics ?? reality.metrics;
      const rateKey = product === "REVENUE_RECOVERY" ? "recovery_rate" : "realization_rate";
      const rate = Number(metrics[rateKey] ?? 0);
      const prediction = {
        statement:
          product === "REVENUE_RECOVERY"
            ? `Next recovery actions under ${args.cycle.methodKey ?? "champion"} will improve recovered/potential vs baseline ${rate.toFixed(3)}`
            : `Next OE actions under ${args.cycle.methodKey ?? "champion"} will improve realized/projected vs baseline ${rate.toFixed(3)}`,
        confidence: reality.evidence_available ? Math.min(0.85, 0.4 + rate) : 0.2,
        predicted_value: { baseline_rate: rate, direction: "improve", method: args.cycle.methodKey },
        horizon_hours: 168,
      };
      return {
        output: { ...base, predictions: [prediction], metrics_snapshot: metrics },
        tokensUsed: 50,
        computeMs,
        reality,
        prediction,
      };
    }
    case "COUNTERFACTUAL":
      return {
        output: {
          ...base,
          counterfactuals: [
            { alt: "Abort mid-cycle", consequence: "No new canonical ZERO_STATE_NEXT; prior head remains" },
            { alt: "Promote challenger without samples", consequence: "Rejected — validation gate" },
            {
              alt: product === "REVENUE_RECOVERY" ? "Treat estimates as recovered" : "Treat projected as realized",
              consequence: "Financial honesty violation — blocked",
            },
          ],
        },
        tokensUsed: 30,
        computeMs,
        reality,
      };
    case "CRITIC": {
      const findings: { attack: string; severity: string }[] = [];
      if (!reality.evidence_available) {
        findings.push({ attack: "Insufficient tenant evidence for product cycle", severity: "high" });
      }
      const rate =
        product === "REVENUE_RECOVERY"
          ? Number(reality.metrics.recovery_rate ?? 0)
          : Number(reality.metrics.realization_rate ?? 0);
      if (rate < 0.15 && reality.evidence_available) {
        findings.push({ attack: "Conversion rate below 15% — method may be mis-prioritized", severity: "medium" });
      }
      if ((learning.profile?.confidence ?? "LOW") === "LOW") {
        findings.push({ attack: "Learning profile LOW confidence — avoid aggressive promotion", severity: "medium" });
      }
      findings.push({ attack: "Deterministic SI stub is structured, not world-grounded LLM", severity: "low" });
      return {
        output: { ...base, critic_findings: findings },
        tokensUsed: 45,
        computeMs,
        reality,
      };
    }
    case "SELF":
      return {
        output: {
          ...base,
          self_model: {
            capabilities: [
              "nine_return_persist",
              "witness_only_zero_state",
              "tenant_isolated_memory",
              "champion_challenger_methods",
              product === "REVENUE_RECOVERY" ? "rr_outcome_learning" : "oe_outcome_learning",
            ],
            limitations: ["no_redis_queue", "deterministic_stage_adapter", "no_autonomous_architecture_rewrite"],
            uncertainty: ["external_integration_freshness", "future_outcome_realization"],
            layer_ceiling: "V5-bounded",
            method_key: args.cycle.methodKey,
            method_role: args.cycle.methodRole,
          },
        },
        tokensUsed: 35,
        computeMs,
        reality,
      };
    case "CALIBRATION": {
      const openPreds = await prisma.siPrediction.count({
        where: { organizationId: args.cycle.organizationId, product, status: "open" },
      });
      const resolved = await prisma.siPrediction.groupBy({
        by: ["status"],
        where: { organizationId: args.cycle.organizationId, product },
        _count: { _all: true },
      });
      return {
        output: {
          ...base,
          calibration_notes:
            "Confidence clipped to evidence: rates from DB only; estimates ≠ recovered/realized; LOW learning confidence blocks promotion.",
          open_predictions: openPreds,
          prediction_resolution: resolved,
        },
        tokensUsed: 35,
        computeMs,
        reality,
      };
    }
    case "META": {
      const methods = await prisma.siMethodRegistry.findMany({
        where: { organizationId: args.cycle.organizationId, product },
      });
      const recentCycles = await prisma.siCognitionCycle.findMany({
        where: { organizationId: args.cycle.organizationId, product, status: "succeeded" },
        orderBy: { completedAt: "desc" },
        take: 9,
        select: { id: true, methodKey: true, completedAt: true },
      });
      const meta_patterns = [
        `succeeded_cycles_in_window_sample=${recentCycles.length}`,
        `active_methods=${methods.filter((m) => m.status === "active").length}`,
        `champion=${methods.find((m) => m.role === "champion" && m.status === "active")?.methodKey ?? "none"}`,
        `challenger=${methods.find((m) => m.role === "challenger")?.methodKey ?? "none"}`,
      ];
      return {
        output: {
          ...base,
          meta_patterns,
          methods: methods.map((m) => ({
            methodKey: m.methodKey,
            role: m.role,
            status: m.status,
            empirical: JSON.parse(m.empiricalJson || "{}"),
          })),
          recent_cycle_ids: recentCycles.map((c) => c.id),
        },
        tokensUsed: 55,
        computeMs,
        reality,
      };
    }
    case "WITNESS": {
      const critic = (args.priorOutputs.CRITIC as { critic_findings?: { severity: string }[] })?.critic_findings ?? [];
      const high = critic.some((c) => c.severity === "high");
      const decision = !reality.evidence_available
        ? "hold_insufficient_evidence"
        : high
          ? "accept_with_warnings"
          : "accept";
      return {
        output: {
          ...base,
          witness_decision: decision,
          next_cycle_hints: [
            reality.evidence_available
              ? `Continue ${product} with method ${args.cycle.methodKey ?? "champion"}`
              : "Import or detect product evidence before next cycle",
            "Resolve open predictions against verified outcomes",
            "Do not promote challenger without measured superiority",
          ],
          zero_state_authority: "WITNESS_ONLY",
        },
        tokensUsed: 40,
        computeMs,
        reality,
        witnessDecision: decision,
      };
    }
    default:
      throw new Error(`unknown_stage:${args.stage}`);
  }
}

async function commitWitness(args: {
  cycle: {
    id: string;
    organizationId: string;
    product: string;
    intent: string;
    methodKey: string | null;
    methodRole: string | null;
    tokensUsed: number;
    computeMsUsed: number;
  };
  witnessOutput: Record<string, unknown>;
  priorOutputs: Record<string, unknown>;
  priorZero: { id: string; contentHash: string } | null;
  evidenceUri: string;
}) {
  const product = args.cycle.product as SiProduct;
  const key = continuityKey(args.cycle.organizationId, product);
  const reality = args.priorOutputs.REALITY as {
    reality_summary?: string;
    metrics?: Record<string, number>;
  };
  const memory = args.priorOutputs.MEMORY as { memory_refs?: string[]; lessons?: { id: string }[] };
  const prediction = args.priorOutputs.PREDICTION as { predictions?: unknown[]; prediction_ids?: string[] };
  const counter = args.priorOutputs.COUNTERFACTUAL as { counterfactuals?: unknown[] };
  const critic = args.priorOutputs.CRITIC as { critic_findings?: unknown[] };
  const self = args.priorOutputs.SELF as { self_model?: Record<string, unknown> };
  const calib = args.priorOutputs.CALIBRATION as { calibration_notes?: string };
  const meta = args.priorOutputs.META as { meta_patterns?: unknown[] };

  const payload: ZeroStatePayload = {
    protocol: SI_PROTOCOL,
    product,
    reality_summary: String(reality?.reality_summary ?? args.cycle.intent),
    memory_refs: memory?.memory_refs ?? [],
    predictions_open: prediction?.predictions ?? [],
    counterfactuals: counter?.counterfactuals ?? [],
    critic_findings: critic?.critic_findings ?? [],
    self_model_snapshot: self?.self_model ?? {},
    calibration_notes: String(calib?.calibration_notes ?? ""),
    meta_patterns: meta?.meta_patterns ?? [],
    witness_decision: String(args.witnessOutput.witness_decision ?? "accept"),
    next_cycle_hints: (args.witnessOutput.next_cycle_hints as string[]) ?? [],
    contradiction_ids: [],
    nest_context: { nest_label: "I", nest_level: 0 },
    resource_spend_so_far: {
      tokens_used: args.cycle.tokensUsed,
      compute_ms_used: args.cycle.computeMsUsed,
    },
    stage_outputs: {
      ...(args.priorOutputs as Partial<Record<CognitionStage, unknown>>),
      WITNESS: args.witnessOutput,
    },
    prior_zero_state_hash: args.priorZero?.contentHash ?? null,
    prior_zero_state_id: args.priorZero?.id ?? null,
    lesson_ids: (memory?.lessons ?? []).map((l) => l.id),
    open_prediction_ids: prediction?.prediction_ids ?? [],
    method_key: args.cycle.methodKey,
    method_role: args.cycle.methodRole,
    outcome_metrics: (reality?.metrics ?? {}) as Record<string, number | string | null>,
  };

  const hash = contentHash(payload);

  const zs = await prisma.$transaction(async (tx) => {
    await tx.siZeroState.updateMany({
      where: { organizationId: args.cycle.organizationId, product, continuityKey: key, isCanonical: true },
      data: { isCanonical: false },
    });
    const created = await tx.siZeroState.create({
      data: {
        organizationId: args.cycle.organizationId,
        product,
        cycleId: args.cycle.id,
        continuityKey: key,
        writtenByStage: "WITNESS",
        isCanonical: true,
        version: 1,
        payloadJson: JSON.stringify(payload),
        contentHash: hash,
        priorHash: args.priorZero?.contentHash ?? null,
        evidencePackUri: args.evidenceUri,
      },
    });

    const invariantEvidence = {
      stages_completed: COGNITION_STAGES.length,
      zero_state_hash: hash,
      prior_hash: args.priorZero?.contentHash ?? null,
      witness_decision: payload.witness_decision,
      method_key: args.cycle.methodKey,
    };
    const invHash = contentHash(invariantEvidence);
    const invariant = await tx.siCycleInvariant.create({
      data: {
        organizationId: args.cycle.organizationId,
        product,
        cycleId: args.cycle.id,
        kind: "CYCLE_INVARIANT",
        statement: `CYCLE_INVARIANT: Witness committed ZERO_STATE_NEXT hash=${hash.slice(0, 12)} for ${product}`,
        evidenceJson: JSON.stringify(invariantEvidence),
        contentHash: invHash,
      },
    });

    await tx.siStageOutput.create({
      data: {
        cycleId: args.cycle.id,
        organizationId: args.cycle.organizationId,
        stage: "WITNESS",
        returnIndex: 9,
        outputJson: JSON.stringify(args.witnessOutput),
        evidencePackUri: args.evidenceUri,
        contentHash: contentHash(args.witnessOutput),
      },
    });

    await tx.siCognitionCycle.update({
      where: { id: args.cycle.id },
      data: {
        status: "succeeded",
        currentStage: "WITNESS",
        stageStatus: "stage_done",
        returnIndex: 9,
        zeroStateId: created.id,
        invariantId: invariant.id,
        completedAt: new Date(),
        evidencePackUri: args.evidenceUri,
      },
    });

    return { zeroState: created, invariant };
  });

  await writeAudit({
    organizationId: args.cycle.organizationId,
    action: "si.cycle.witness_committed",
    entityType: "SiZeroState",
    entityId: zs.zeroState.id,
    metadata: { cycleId: args.cycle.id, contentHash: hash, CYCLE_INVARIANT: zs.invariant.id },
  });

  return zs;
}

/** Run a single stage idempotently; advances to next when done. */
export async function runNextStage(cycleId: string) {
  const cycle = await prisma.siCognitionCycle.findUnique({
    where: { id: cycleId },
    include: { stageOutputs: true },
  });
  if (!cycle) throw Object.assign(new Error("cycle_not_found"), { code: "cycle_not_found", status: 404 });
  if (["succeeded", "failed", "aborted"].includes(cycle.status)) {
    return { cycle, advanced: false as const, reason: "terminal" as const };
  }
  if (cycle.status === "paused") {
    return { cycle, advanced: false as const, reason: "paused" as const };
  }

  const doneStages = new Set(cycle.stageOutputs.map((s) => s.stage));
  let stage = (cycle.currentStage as CognitionStage) || "REALITY";
  // Skip already-written stages (idempotent recovery)
  while (doneStages.has(stage)) {
    const nxt = nextCognitionStage(stage);
    if (!nxt) {
      return { cycle, advanced: false as const, reason: "complete" as const };
    }
    stage = nxt;
  }

  if (cycle.tokensUsed >= cycle.tokensLimit || cycle.computeMsUsed >= cycle.computeMsLimit) {
    await prisma.siCognitionCycle.update({
      where: { id: cycleId },
      data: { status: "failed", failureCode: "budget_exhausted", failureDetail: "Resource budget exhausted", completedAt: new Date() },
    });
    await prisma.siErrorRecord.create({
      data: {
        organizationId: cycle.organizationId,
        product: cycle.product,
        cycleId,
        stage,
        code: "budget_exhausted",
        detail: "Fail closed on budget",
      },
    });
    throw Object.assign(new Error("budget_exhausted"), { code: "budget_exhausted", status: 409 });
  }

  await prisma.siCognitionCycle.update({
    where: { id: cycleId },
    data: {
      status: "running",
      currentStage: stage,
      stageStatus: "stage_running",
      startedAt: cycle.startedAt ?? new Date(),
    },
  });

  const priorZero = cycle.priorZeroStateId
    ? await prisma.siZeroState.findUnique({ where: { id: cycle.priorZeroStateId } })
    : await loadCanonicalZeroState(cycle.organizationId, cycle.product as SiProduct);

  const priorOutputs: Record<string, unknown> = {};
  for (const row of cycle.stageOutputs) {
    priorOutputs[row.stage] = JSON.parse(row.outputJson);
  }

  const built = await buildStageOutput({
    cycle,
    stage,
    priorOutputs,
    priorZero: priorZero
      ? { id: priorZero.id, contentHash: priorZero.contentHash, payloadJson: priorZero.payloadJson }
      : null,
  });

  const evidenceUri = `evidence://si/cycles/${cycleId}/stages/${stage}`;

  if (stage === "WITNESS") {
    const refreshed = await prisma.siCognitionCycle.findUniqueOrThrow({ where: { id: cycleId } });
    const spend = {
      ...refreshed,
      tokensUsed: refreshed.tokensUsed + built.tokensUsed,
      computeMsUsed: refreshed.computeMsUsed + built.computeMs,
    };
    await prisma.siCognitionCycle.update({
      where: { id: cycleId },
      data: { tokensUsed: spend.tokensUsed, computeMsUsed: spend.computeMsUsed },
    });

    // Persist prediction rows from PREDICTION stage before witness close
    // (already persisted when that stage ran)

    const zs = await commitWitness({
      cycle: spend,
      witnessOutput: built.output,
      priorOutputs: { ...priorOutputs, WITNESS: built.output },
      priorZero: priorZero ? { id: priorZero.id, contentHash: priorZero.contentHash } : null,
      evidenceUri,
    });

    // Episodic memory + method outcome signal from measured metrics delta vs prior
    const metrics = (built.reality?.metrics ?? {}) as Record<string, number>;
    const priorMetrics = priorZero
      ? ((JSON.parse(priorZero.payloadJson) as ZeroStatePayload).outcome_metrics as Record<string, number>)
      : {};
    const rateKey =
      cycle.product === "REVENUE_RECOVERY" ? "recovery_rate" : "realization_rate";
    const delta = Number(metrics[rateKey] ?? 0) - Number(priorMetrics[rateKey] ?? 0);
    if (cycle.methodKey) {
      await recordMethodOutcome({
        organizationId: cycle.organizationId,
        product: cycle.product as SiProduct,
        methodKey: cycle.methodKey,
        positive: delta >= 0 && built.reality?.evidence_available === true,
        delta,
      });
    }
    const witnessDecision = String((built.output as { witness_decision?: string }).witness_decision ?? "accept");
    await prisma.siMemoryItem.create({
      data: {
        organizationId: cycle.organizationId,
        product: cycle.product,
        cycleId,
        kind: "episodic",
        summary: `Cycle ${cycleId.slice(0, 8)} ${stage} decision=${witnessDecision}`,
        detailJson: JSON.stringify({ metrics, delta, zeroStateId: zs.zeroState.id }),
        refsJson: JSON.stringify([zs.zeroState.id, zs.invariant.id]),
      },
    });

    const final = await prisma.siCognitionCycle.findUniqueOrThrow({
      where: { id: cycleId },
      include: { stageOutputs: true },
    });
    return { cycle: final, advanced: true as const, stage, zeroState: zs.zeroState, invariant: zs.invariant };
  }

  // Non-witness stages — immutable insert (unique cycleId+stage)
  try {
    await prisma.siStageOutput.create({
      data: {
        cycleId,
        organizationId: cycle.organizationId,
        stage,
        returnIndex: RETURN_INDEX[stage],
        outputJson: JSON.stringify(built.output),
        evidencePackUri: evidenceUri,
        contentHash: contentHash(built.output),
        tokensUsed: built.tokensUsed,
        computeMs: built.computeMs,
      },
    });
  } catch (e: unknown) {
    // Unique conflict = already written — treat as idempotent success
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("Unique constraint")) throw e;
  }

  if (stage === "REALITY" && built.reality) {
    await prisma.siMemoryItem.create({
      data: {
        organizationId: cycle.organizationId,
        product: cycle.product,
        cycleId,
        kind: "temporal",
        summary: built.reality.reality_summary,
        detailJson: JSON.stringify({ metrics: built.reality.metrics, sample_ids: built.reality.sample_ids }),
      },
    });
  }

  if (stage === "PREDICTION" && "prediction" in built && built.prediction) {
    const pred = await prisma.siPrediction.create({
      data: {
        organizationId: cycle.organizationId,
        product: cycle.product,
        cycleId,
        statement: built.prediction.statement,
        confidence: built.prediction.confidence,
        predictedJson: JSON.stringify(built.prediction.predicted_value),
        status: "open",
      },
    });
    await prisma.siStageOutput.update({
      where: { cycleId_stage: { cycleId, stage: "PREDICTION" } },
      data: {
        outputJson: JSON.stringify({ ...built.output, prediction_ids: [pred.id] }),
      },
    });
  }

  if (stage === "CRITIC") {
    const findings = ((built.output as { critic_findings?: { attack: string; severity: string }[] }).critic_findings) ?? [];
    for (const f of findings.filter((x) => x.severity === "high" || x.severity === "medium")) {
      await prisma.siErrorRecord.create({
        data: {
          organizationId: cycle.organizationId,
          product: cycle.product,
          cycleId,
          stage,
          code: `critic_${f.severity}`,
          detail: f.attack,
        },
      });
    }
    // Lessons from critic
    if (findings.length) {
      await prisma.siLesson.create({
        data: {
          organizationId: cycle.organizationId,
          product: cycle.product,
          cycleId,
          lesson: findings.map((f) => f.attack).join("; "),
          methodKey: cycle.methodKey,
          evidenceJson: JSON.stringify(findings),
        },
      });
    }
  }

  const next = nextCognitionStage(stage);
  const updated = await prisma.siCognitionCycle.update({
    where: { id: cycleId },
    data: {
      stageStatus: "stage_done",
      returnIndex: RETURN_INDEX[stage],
      tokensUsed: { increment: built.tokensUsed },
      computeMsUsed: { increment: built.computeMs },
      currentStage: next ?? stage,
      status: next ? "running" : "running",
    },
    include: { stageOutputs: true },
  });

  await writeAudit({
    organizationId: cycle.organizationId,
    action: "si.cycle.stage_exited",
    entityType: "SiCognitionCycle",
    entityId: cycleId,
    metadata: { stage, returnIndex: RETURN_INDEX[stage], next },
  });

  return { cycle: updated, advanced: true as const, stage, next };
}

/** Run all remaining stages to Witness (or until pause/fail). */
export async function runCycleToCompletion(cycleId: string, maxSteps = 12) {
  const stages: string[] = [];
  let last: Awaited<ReturnType<typeof runNextStage>> | null = null;
  for (let i = 0; i < maxSteps; i++) {
    last = await runNextStage(cycleId);
    if (last.advanced && "stage" in last && last.stage) stages.push(last.stage);
    if (!last.advanced) break;
    if (last.cycle.status === "succeeded") break;
    if (last.cycle.status === "failed" || last.cycle.status === "aborted") break;
  }
  return { cycle: last?.cycle, stages, zeroState: last && "zeroState" in last ? last.zeroState : null, invariant: last && "invariant" in last ? last.invariant : null };
}

export async function listCycles(organizationId: string, product?: SiProduct, take = 20) {
  return prisma.siCognitionCycle.findMany({
    where: { organizationId, ...(product ? { product } : {}) },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      stageOutputs: { select: { stage: true, returnIndex: true, contentHash: true, createdAt: true } },
    },
  });
}

export async function getCycleDetail(organizationId: string, cycleId: string) {
  const cycle = await prisma.siCognitionCycle.findFirst({
    where: { id: cycleId, organizationId },
    include: {
      stageOutputs: { orderBy: { returnIndex: "asc" } },
      zeroStates: true,
      invariants: true,
      predictions: true,
      lessons: true,
      errors: true,
    },
  });
  return cycle;
}
