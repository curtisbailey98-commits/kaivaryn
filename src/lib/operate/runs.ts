/**
 * Runs — renovated from 720 SI jobs/runbooks (chained cycle → build with evidence).
 * A run is an ordered list of steps with recorded evidence per step and honest failure.
 * Human-in-the-loop: an APPROVAL step pauses the run (WAITING_APPROVAL) until a person decides.
 * Nothing in a run touches an external system.
 */
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { createOrResumeCycle, runCycleToCompletion } from "@/lib/si/cycles";
import type { SiProduct } from "@/lib/si/stages";
import { runIntelligenceJob } from "@/lib/jobs";
import { interpretExecutiveQuery } from "@/lib/nl-query";
import { notifyOrgManagers } from "@/lib/notifications";
import type { OpCtx } from "./context";
import { OpError, requireOpPermission, safeJson } from "./context";
import type { ProductScope } from "./router";
import { runHealthCheck } from "./health";
import { buildDigest, buildRecall } from "./briefing";

export type RunStep =
  | { kind: "ANALYZE"; product: ProductScope; intent?: string }
  | { kind: "DETECT" }
  | { kind: "BRIEF" }
  | { kind: "RECALL" }
  | { kind: "STATUS" }
  | { kind: "ANSWER"; question: string }
  | { kind: "TASK"; title: string; body?: string }
  | { kind: "APPROVAL"; title: string; description?: string; needsIntegration?: string };

export type StepEvidence = {
  index: number;
  kind: RunStep["kind"];
  ok: boolean;
  summary: string;
  refs?: Array<{ label: string; href: string }>;
  at: string;
};

export type RunSource = "COMMAND" | "STANDING_ORDER" | "PLAYBOOK" | "MANUAL";

export const STEP_LABEL: Record<RunStep["kind"], string> = {
  ANALYZE: "Nine-return analysis",
  DETECT: "Detection engines",
  BRIEF: "Executive digest",
  RECALL: "Recall",
  STATUS: "Health check",
  ANSWER: "Executive answer",
  TASK: "Owned task",
  APPROVAL: "Approval gate",
};

export function describeStep(step: RunStep): string {
  switch (step.kind) {
    case "ANALYZE":
      return `${STEP_LABEL.ANALYZE} · ${step.product === "BOTH" ? "Revenue + Operations" : step.product === "REVENUE_RECOVERY" ? "Revenue Recovery" : "Operations Efficiency"}`;
    case "ANSWER":
      return `${STEP_LABEL.ANSWER} · “${step.question}”`;
    case "TASK":
      return `${STEP_LABEL.TASK} · ${step.title}`;
    case "APPROVAL":
      return `${STEP_LABEL.APPROVAL} · ${step.title}`;
    default:
      return STEP_LABEL[step.kind];
  }
}

const VALID_KINDS = new Set(Object.keys(STEP_LABEL));

export function normalizeSteps(raw: unknown): RunStep[] {
  if (!Array.isArray(raw)) return [];
  const out: RunStep[] = [];
  for (const s of raw.slice(0, 12)) {
    const o = (s ?? {}) as Record<string, unknown>;
    const kind = String(o.kind || "").toUpperCase();
    if (!VALID_KINDS.has(kind)) continue;
    if (kind === "ANALYZE") {
      const p = String(o.product || "BOTH");
      out.push({ kind, product: p === "REVENUE_RECOVERY" || p === "OPERATIONS_EFFICIENCY" ? p : "BOTH", intent: o.intent ? String(o.intent).slice(0, 300) : undefined });
    } else if (kind === "ANSWER") {
      out.push({ kind, question: String(o.question || "Top opportunities").slice(0, 300) });
    } else if (kind === "TASK") {
      out.push({ kind, title: String(o.title || "Follow-up").slice(0, 200), body: o.body ? String(o.body).slice(0, 1000) : undefined });
    } else if (kind === "APPROVAL") {
      out.push({ kind, title: String(o.title || "Approve plan").slice(0, 200), description: o.description ? String(o.description).slice(0, 1000) : undefined, needsIntegration: o.needsIntegration ? String(o.needsIntegration).slice(0, 60) : undefined });
    } else {
      out.push({ kind } as RunStep);
    }
  }
  return out;
}

/** Tasks/approvals need a human actor id; system runs fall back to the org owner. */
export async function resolveActorId(ctx: OpCtx, preferred?: string | null): Promise<string | null> {
  if (preferred) return preferred;
  if (ctx.userId) return ctx.userId;
  const m = await prisma.membership.findFirst({
    where: { organizationId: ctx.organizationId, role: { in: ["OWNER", "ADMIN", "MANAGER"] } },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  return m?.userId ?? null;
}

export async function createRun(
  ctx: OpCtx,
  input: { title: string; steps: RunStep[]; source: RunSource; sourceId?: string | null; initiativeId?: string | null },
) {
  const steps = input.steps.length ? input.steps : [{ kind: "STATUS" } as RunStep];
  if (input.initiativeId) {
    const ini = await prisma.opInitiative.findFirst({ where: { id: input.initiativeId, organizationId: ctx.organizationId }, select: { id: true } });
    if (!ini) throw new OpError("not_found", "Initiative not found in this organization", 404);
  }
  const run = await prisma.opRun.create({
    data: {
      organizationId: ctx.organizationId,
      title: input.title.slice(0, 200) || "Run",
      source: input.source,
      sourceId: input.sourceId ?? null,
      initiativeId: input.initiativeId ?? null,
      status: "QUEUED",
      stepsJson: JSON.stringify(steps),
      createdById: ctx.userId,
    },
  });
  if (input.initiativeId) {
    await prisma.opInitiativeLink.upsert({
      where: { initiativeId_entityType_entityId: { initiativeId: input.initiativeId, entityType: "RUN", entityId: run.id } },
      update: {},
      create: { organizationId: ctx.organizationId, initiativeId: input.initiativeId, entityType: "RUN", entityId: run.id },
    });
  }
  return run;
}

async function entitledProducts(organizationId: string): Promise<SiProduct[]> {
  const rows = await prisma.entitlement.findMany({ where: { organizationId, active: true }, select: { product: true } });
  return rows.map((r) => r.product).filter((p): p is SiProduct => p === "REVENUE_RECOVERY" || p === "OPERATIONS_EFFICIENCY");
}

async function executeStep(ctx: OpCtx, run: { id: string; title: string; createdById: string | null }, step: RunStep, index: number): Promise<StepEvidence & { pause?: { approvalId: string } }> {
  const at = new Date().toISOString();
  const base = { index, kind: step.kind, at };
  switch (step.kind) {
    case "ANALYZE": {
      const entitled = await entitledProducts(ctx.organizationId);
      const wanted: SiProduct[] = step.product === "BOTH" ? entitled : entitled.filter((p) => p === step.product);
      if (!wanted.length) {
        return { ...base, ok: false, summary: step.product === "BOTH" ? "No Revenue Recovery or Operations Efficiency entitlement on this organization." : `${step.product} is not in this organization's plan.` };
      }
      const parts: string[] = [];
      const refs: StepEvidence["refs"] = [];
      let allOk = true;
      for (const product of wanted) {
        const { cycle } = await createOrResumeCycle({
          organizationId: ctx.organizationId,
          product,
          intent: (step.intent || run.title).slice(0, 300),
          idempotencyKey: `oprun:${run.id}:${index}:${product}`,
          createdById: ctx.userId,
          methodRole: "champion",
        });
        const res = await runCycleToCompletion(cycle.id);
        const ok = res.cycle?.status === "succeeded";
        allOk = allOk && ok;
        const label = product === "REVENUE_RECOVERY" ? "Revenue Recovery" : "Operations Efficiency";
        parts.push(`${label}: ${ok ? `nine-step analysis complete (${res.stages.length} steps recorded)` : `cycle ${res.cycle?.status ?? "unknown"}${res.cycle?.failureCode ? ` · ${res.cycle.failureCode}` : ""}`}`);
        refs.push({ label: `${label} cycle`, href: "/app/intelligence" });
      }
      return { ...base, ok: allOk, summary: parts.join(" · "), refs };
    }
    case "DETECT": {
      const ir = await prisma.intelligenceRun.create({ data: { organizationId: ctx.organizationId, createdById: ctx.userId, status: "QUEUED" } });
      await runIntelligenceJob(ir.id);
      const done = await prisma.intelligenceRun.findFirst({ where: { id: ir.id, organizationId: ctx.organizationId } });
      const result = safeJson<{ detection?: { createdOpportunities?: number; createdInefficiencies?: number; rulesFired?: string[]; insufficient?: string[] }; error?: string }>(done?.resultJson, {});
      if (done?.status !== "SUCCEEDED") {
        return { ...base, ok: false, summary: `Detection failed: ${result.error ?? done?.status ?? "unknown"}` };
      }
      const d = result.detection ?? {};
      return {
        ...base,
        ok: true,
        summary: `Detection complete: ${d.createdOpportunities ?? 0} new revenue items, ${d.createdInefficiencies ?? 0} new operations items · ${done.findingCount} open findings${d.insufficient?.length ? ` · ${d.insufficient.length} rules had insufficient data` : ""}`,
        refs: [{ label: "Findings", href: "/app/findings" }],
      };
    }
    case "BRIEF": {
      const { briefing, body } = await buildDigest(ctx, "PLAYBOOK");
      return { ...base, ok: true, summary: `Digest saved · ${body.work.pendingApprovals} approvals pending · ${body.priorities.length} priorities`, refs: [{ label: "Open briefing", href: `/app/inbox?briefing=${briefing.id}` }] };
    }
    case "RECALL": {
      const { briefing, body } = await buildRecall(ctx, "PLAYBOOK");
      return { ...base, ok: true, summary: body.empty ? "Recall: nothing recorded yet (honest empty)" : `Recall: ${body.continuity.length} analysis summaries · ${body.lessons.length} lessons`, refs: [{ label: "Open recall", href: `/app/inbox?briefing=${briefing.id}` }] };
    }
    case "STATUS": {
      const h = await runHealthCheck(ctx, "TICK");
      return { ...base, ok: h.status !== "DOWN", summary: `Health ${h.status} · ${h.components.filter((c) => c.status === "DEGRADED").length} degraded components`, refs: [{ label: "Operate", href: "/app/operate" }] };
    }
    case "ANSWER": {
      const a = await interpretExecutiveQuery(ctx.organizationId, step.question);
      return { ...base, ok: true, summary: `${a.interpretedAs}: ${a.summary}`.slice(0, 600), refs: a.links?.slice(0, 2).map((l) => ({ label: l.label, href: l.href })) };
    }
    case "TASK": {
      const actor = await resolveActorId(ctx, run.createdById);
      if (!actor) return { ...base, ok: false, summary: "No owner/admin user available to own the task." };
      const task = await prisma.task.create({
        data: { organizationId: ctx.organizationId, title: step.title, body: step.body ?? `Created by run “${run.title}”.`, entityType: "OpRun", entityId: run.id, createdById: actor, status: "OPEN" },
      });
      return { ...base, ok: true, summary: `Task created: ${task.title}`, refs: [{ label: "Action Center", href: "/app/action-center" }] };
    }
    case "APPROVAL": {
      const actor = await resolveActorId(ctx, run.createdById);
      if (!actor) return { ...base, ok: false, summary: "No owner/admin user available to request approval." };
      const appr = await prisma.approvalRequest.create({
        data: {
          organizationId: ctx.organizationId,
          type: "OPERATING_PLAN",
          title: step.title,
          description: step.description ?? `Run “${run.title}” is paused at this gate. Approving resumes the remaining internal steps; it does not execute anything outside Kaivaryn.`,
          status: "PENDING",
          payloadJson: JSON.stringify({ opRunId: run.id, stepIndex: index, executesExternally: false }),
          needsIntegration: step.needsIntegration ?? null,
          requestedById: actor,
        },
      });
      await notifyOrgManagers({ organizationId: ctx.organizationId, title: `Approval needed: ${step.title}`, body: `Run “${run.title}” is waiting on a decision.`, href: "/app/approvals" }).catch(() => undefined);
      return { ...base, ok: true, summary: `Paused for human approval: ${step.title}${step.needsIntegration ? ` · blocked on ${step.needsIntegration} (not connected)` : ""}`, refs: [{ label: "Approvals", href: "/app/approvals" }], pause: { approvalId: appr.id } };
    }
  }
}

/** Execute (or resume) a run from currentStep. Returns the final run row. */
export async function executeRun(ctx: OpCtx, runId: string) {
  const run = await prisma.opRun.findFirst({ where: { id: runId, organizationId: ctx.organizationId } });
  if (!run) throw new OpError("not_found", "Run not found in this organization", 404);
  if (run.status === "SUCCEEDED" || run.status === "CANCELLED" || run.status === "FAILED") return run;

  const steps = normalizeSteps(safeJson(run.stepsJson, []));
  const evidence = safeJson<StepEvidence[]>(run.evidenceJson, []);
  await prisma.opRun.update({ where: { id: run.id }, data: { status: "RUNNING", startedAt: run.startedAt ?? new Date() } });

  let i = run.currentStep;
  for (; i < steps.length; i++) {
    let ev: Awaited<ReturnType<typeof executeStep>>;
    try {
      ev = await executeStep(ctx, run, steps[i]!, i);
    } catch (e) {
      ev = { index: i, kind: steps[i]!.kind, ok: false, summary: `Step error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500), at: new Date().toISOString() };
    }
    const { pause, ...record } = ev;
    evidence.push(record);
    if (!ev.ok) {
      const failed = await prisma.opRun.update({
        where: { id: run.id },
        data: { status: "FAILED", currentStep: i, evidenceJson: JSON.stringify(evidence), error: ev.summary, finishedAt: new Date() },
      });
      await writeAudit({ organizationId: ctx.organizationId, actorId: ctx.userId, action: "oprun.failed", entityType: "OpRun", entityId: run.id, metadata: { step: i, kind: ev.kind } });
      return failed;
    }
    if (pause) {
      return prisma.opRun.update({
        where: { id: run.id },
        data: { status: "WAITING_APPROVAL", currentStep: i + 1, approvalId: pause.approvalId, evidenceJson: JSON.stringify(evidence) },
      });
    }
    await prisma.opRun.update({ where: { id: run.id }, data: { currentStep: i + 1, evidenceJson: JSON.stringify(evidence) } });
  }
  const done = await prisma.opRun.update({
    where: { id: run.id },
    data: { status: "SUCCEEDED", currentStep: steps.length, evidenceJson: JSON.stringify(evidence), finishedAt: new Date() },
  });
  await writeAudit({ organizationId: ctx.organizationId, actorId: ctx.userId, action: "oprun.succeeded", entityType: "OpRun", entityId: run.id, metadata: { steps: steps.length, source: run.source } });
  return done;
}

/** Called after an approval decision. Resumes or cancels the paused run (tenant-scoped). */
export async function onApprovalDecided(ctx: OpCtx, approvalId: string, decision: "APPROVED" | "REJECTED") {
  const run = await prisma.opRun.findFirst({ where: { organizationId: ctx.organizationId, approvalId, status: "WAITING_APPROVAL" } });
  if (!run) return null;
  if (decision === "REJECTED") {
    const evidence = safeJson<StepEvidence[]>(run.evidenceJson, []);
    evidence.push({ index: run.currentStep, kind: "APPROVAL", ok: false, summary: "Approval rejected — remaining steps cancelled", at: new Date().toISOString() });
    return prisma.opRun.update({ where: { id: run.id }, data: { status: "CANCELLED", evidenceJson: JSON.stringify(evidence), finishedAt: new Date() } });
  }
  await prisma.opRun.update({ where: { id: run.id }, data: { status: "QUEUED" } });
  return executeRun(ctx, run.id);
}

export async function listRuns(ctx: OpCtx, opts?: { take?: number; status?: string; initiativeId?: string }) {
  return prisma.opRun.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.initiativeId ? { initiativeId: opts.initiativeId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(opts?.take ?? 30, 1), 100),
  });
}

export async function getRun(ctx: OpCtx, id: string) {
  return prisma.opRun.findFirst({ where: { id, organizationId: ctx.organizationId } });
}

export async function cancelRun(ctx: OpCtx, id: string) {
  requireOpPermission(ctx, "write");
  const res = await prisma.opRun.updateMany({
    where: { id, organizationId: ctx.organizationId, status: { in: ["QUEUED", "WAITING_APPROVAL", "RUNNING"] } },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
  return res.count;
}
