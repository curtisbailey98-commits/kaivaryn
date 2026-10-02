/**
 * Briefings — renovated from 720 SI `digest` + `recall`.
 * Digest = executive snapshot. Recall = what completed cycles actually recorded.
 * Estimates and recorded outcomes are kept in separate fields (money glossary).
 */
import { prisma } from "@/lib/prisma";
import { MONEY, RR_CLOSED_STATUSES, OE_CLOSED_STATUSES } from "@/lib/money-glossary";
import { getLearningSummary } from "@/lib/learning";
import type { OpCtx } from "./context";
import { safeJson } from "./context";

export type BriefingSource = "COMMAND" | "STANDING_ORDER" | "PLAYBOOK" | "MANUAL";

export type MoneyLine = { label: string; value: number; nature: "ESTIMATE" | "RECORDED"; definition: string };

export type DigestBody = {
  generatedAt: string;
  since: string | null;
  money: MoneyLine[];
  work: { pendingApprovals: number; openTasks: number; unassigned: number; critical: number };
  changes: { newOpportunities: number; newInefficiencies: number; approvalsDecided: number; cyclesCompleted: number };
  priorities: Array<{ kind: "Revenue" | "Operations"; title: string; priority: string; href: string; estimate: number }>;
  intelligence: Array<{ product: string; lastCycle: string | null; status: string | null; witness: string | null }>;
  operate: { lastHealth: string | null; standingActive: number; failedRuns24h: number; waitingApproval: number };
  notes: string[];
};

export type RecallBody = {
  generatedAt: string;
  continuity: Array<{ product: string; version: number; hash: string; summary: string; witness: string; hints: string[]; at: string }>;
  lessons: Array<{ product: string; lesson: string; at: string }>;
  memory: Array<{ product: string; kind: string; summary: string; at: string }>;
  learning: Array<{ product: string; sampleSize: number; confidence: string }>;
  empty: boolean;
  notes: string[];
};

export async function buildDigest(ctx: OpCtx, source: BriefingSource = "COMMAND") {
  const orgId = ctx.organizationId;
  const previous = await prisma.opBriefing.findFirst({
    where: { organizationId: orgId, kind: "DIGEST" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const since = previous?.createdAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rrClosed = [...RR_CLOSED_STATUSES];
  const oeClosed = [...OE_CLOSED_STATUSES];

  const [rr, oe, pendingApprovals, openTasks, unassignedOpp, unassignedIneff, criticalOpp, criticalIneff, newOpp, newIneff, decided, cyclesDone, topOpp, topIneff, lastHealth, standingActive, failedRuns, waiting, lastRr, lastOe] =
    await Promise.all([
      prisma.opportunity.aggregate({ where: { organizationId: orgId }, _sum: { potentialAmount: true, recoveredAmount: true, verifiedAmount: true } }),
      prisma.inefficiency.aggregate({ where: { organizationId: orgId }, _sum: { projectedSavings: true, realizedSavings: true } }),
      prisma.approvalRequest.count({ where: { organizationId: orgId, status: "PENDING" } }),
      prisma.task.count({ where: { organizationId: orgId, status: "OPEN" } }),
      prisma.opportunity.count({ where: { organizationId: orgId, assigneeId: null, status: { notIn: rrClosed } } }),
      prisma.inefficiency.count({ where: { organizationId: orgId, assigneeId: null, status: { notIn: oeClosed } } }),
      prisma.opportunity.count({ where: { organizationId: orgId, priority: "CRITICAL", status: { notIn: rrClosed } } }),
      prisma.inefficiency.count({ where: { organizationId: orgId, priority: "CRITICAL", status: { notIn: oeClosed } } }),
      prisma.opportunity.count({ where: { organizationId: orgId, createdAt: { gte: since } } }),
      prisma.inefficiency.count({ where: { organizationId: orgId, createdAt: { gte: since } } }),
      prisma.approvalRequest.count({ where: { organizationId: orgId, decidedAt: { gte: since } } }),
      prisma.siCognitionCycle.count({ where: { organizationId: orgId, status: "succeeded", completedAt: { gte: since } } }),
      prisma.opportunity.findMany({ where: { organizationId: orgId, status: { notIn: rrClosed } }, orderBy: [{ priority: "asc" }, { score: "desc" }], take: 3, select: { id: true, title: true, priority: true, potentialAmount: true } }),
      prisma.inefficiency.findMany({ where: { organizationId: orgId, status: { notIn: oeClosed } }, orderBy: [{ priority: "asc" }, { score: "desc" }], take: 3, select: { id: true, title: true, priority: true, projectedSavings: true } }),
      prisma.opHealthCheck.findFirst({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, select: { status: true, createdAt: true } }),
      prisma.opStandingOrder.count({ where: { organizationId: orgId, enabled: true } }),
      prisma.opRun.count({ where: { organizationId: orgId, status: "FAILED", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      prisma.opRun.count({ where: { organizationId: orgId, status: "WAITING_APPROVAL" } }),
      prisma.siCognitionCycle.findFirst({ where: { organizationId: orgId, product: "REVENUE_RECOVERY" }, orderBy: { createdAt: "desc" }, select: { status: true, completedAt: true, zeroStateId: true } }),
      prisma.siCognitionCycle.findFirst({ where: { organizationId: orgId, product: "OPERATIONS_EFFICIENCY" }, orderBy: { createdAt: "desc" }, select: { status: true, completedAt: true, zeroStateId: true } }),
    ]);

  const witnessFor = async (zeroStateId: string | null | undefined) => {
    if (!zeroStateId) return null;
    const z = await prisma.siZeroState.findFirst({ where: { id: zeroStateId, organizationId: orgId }, select: { payloadJson: true } });
    const p = safeJson<{ witness_decision?: string }>(z?.payloadJson, {});
    return p.witness_decision ?? null;
  };

  const priorityRank = (p: string) => ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[p] ?? 4);
  const priorities = [
    ...topOpp.map((o) => ({ kind: "Revenue" as const, title: o.title, priority: o.priority, href: `/app/revenue/${o.id}`, estimate: o.potentialAmount ?? 0 })),
    ...topIneff.map((i) => ({ kind: "Operations" as const, title: i.title, priority: i.priority, href: `/app/operations/${i.id}`, estimate: i.projectedSavings ?? 0 })),
  ]
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.estimate - a.estimate)
    .slice(0, 5);

  const body: DigestBody = {
    generatedAt: new Date().toISOString(),
    since: previous ? previous.createdAt.toISOString() : null,
    money: [
      { label: MONEY.pipelinePotential.label, value: rr._sum.potentialAmount ?? 0, nature: "ESTIMATE", definition: MONEY.pipelinePotential.definition },
      { label: MONEY.cashRecovered.label, value: rr._sum.recoveredAmount ?? 0, nature: "RECORDED", definition: MONEY.cashRecovered.definition },
      { label: MONEY.verifiedRecovered.label, value: rr._sum.verifiedAmount ?? 0, nature: "RECORDED", definition: MONEY.verifiedRecovered.definition },
      { label: MONEY.projectedSavings.label, value: oe._sum.projectedSavings ?? 0, nature: "ESTIMATE", definition: MONEY.projectedSavings.definition },
      { label: MONEY.realizedSavings.label, value: oe._sum.realizedSavings ?? 0, nature: "RECORDED", definition: MONEY.realizedSavings.definition },
    ],
    work: { pendingApprovals, openTasks, unassigned: unassignedOpp + unassignedIneff, critical: criticalOpp + criticalIneff },
    changes: { newOpportunities: newOpp, newInefficiencies: newIneff, approvalsDecided: decided, cyclesCompleted: cyclesDone },
    priorities,
    intelligence: [
      { product: "Revenue Recovery", lastCycle: lastRr?.completedAt?.toISOString() ?? null, status: lastRr?.status ?? null, witness: await witnessFor(lastRr?.zeroStateId) },
      { product: "Operations Efficiency", lastCycle: lastOe?.completedAt?.toISOString() ?? null, status: lastOe?.status ?? null, witness: await witnessFor(lastOe?.zeroStateId) },
    ],
    operate: { lastHealth: lastHealth ? `${lastHealth.status} · ${lastHealth.createdAt.toISOString()}` : null, standingActive, failedRuns24h: failedRuns, waitingApproval: waiting },
    notes: [
      "Estimates (Pipeline / Potential, Projected savings) are modeled. Cash recovered and Realized savings are recorded outcomes. They are never added together.",
      previous ? "Changes are counted since your previous digest." : "First digest — changes are counted over the last 7 days.",
    ],
  };

  const row = await prisma.opBriefing.create({
    data: {
      organizationId: orgId,
      kind: "DIGEST",
      title: `Executive digest · ${new Date().toISOString().slice(0, 10)}`,
      bodyJson: JSON.stringify(body),
      source,
      createdById: ctx.userId,
    },
  });
  return { briefing: row, body };
}

export async function buildRecall(ctx: OpCtx, source: BriefingSource = "COMMAND") {
  const orgId = ctx.organizationId;
  const [zeroStates, lessons, memory, learning] = await Promise.all([
    prisma.siZeroState.findMany({ where: { organizationId: orgId, isCanonical: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.siLesson.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.siMemoryItem.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 6 }),
    getLearningSummary(orgId),
  ]);
  // keep newest canonical per product
  const seen = new Set<string>();
  const continuity = zeroStates
    .filter((z) => (seen.has(z.product) ? false : (seen.add(z.product), true)))
    .map((z) => {
      const p = safeJson<{ reality_summary?: string; witness_decision?: string; next_cycle_hints?: string[] }>(z.payloadJson, {});
      return {
        product: z.product,
        version: z.version,
        hash: z.contentHash.slice(0, 12),
        summary: p.reality_summary ?? "",
        witness: p.witness_decision ?? "",
        hints: (p.next_cycle_hints ?? []).slice(0, 3),
        at: z.createdAt.toISOString(),
      };
    });
  const body: RecallBody = {
    generatedAt: new Date().toISOString(),
    continuity,
    lessons: lessons.map((l) => ({ product: l.product, lesson: l.lesson, at: l.createdAt.toISOString() })),
    memory: memory.map((m) => ({ product: m.product, kind: m.kind, summary: m.summary, at: m.createdAt.toISOString() })),
    learning: learning.map((l) => ({ product: l.product, sampleSize: l.sampleSize, confidence: l.confidence })),
    empty: continuity.length === 0 && lessons.length === 0 && memory.length === 0,
    notes: [
      "Recall only returns what completed cycles and recorded outcomes actually wrote. Nothing is inferred or invented.",
    ],
  };
  if (body.empty) body.notes.push("No completed intelligence cycles yet — run Analyze to create the first continuity state.");

  const row = await prisma.opBriefing.create({
    data: {
      organizationId: orgId,
      kind: "RECALL",
      title: `Recall · ${new Date().toISOString().slice(0, 10)}`,
      bodyJson: JSON.stringify(body),
      source,
      createdById: ctx.userId,
    },
  });
  return { briefing: row, body };
}

export async function listBriefings(ctx: OpCtx, take = 20) {
  return prisma.opBriefing.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" }, take });
}

export async function getBriefing(ctx: OpCtx, id: string) {
  return prisma.opBriefing.findFirst({ where: { id, organizationId: ctx.organizationId } });
}

export async function markBriefingRead(ctx: OpCtx, id: string) {
  const res = await prisma.opBriefing.updateMany({ where: { id, organizationId: ctx.organizationId, readAt: null }, data: { readAt: new Date() } });
  return res.count;
}
