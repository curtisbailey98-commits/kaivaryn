/**
 * Standing orders — renovated from 720 SI standing_orders (cron-like owner directives).
 * Free-plan honesty: no always-on worker. Due orders run on "Run due now" or an authenticated tick.
 */
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import type { OpCtx } from "./context";
import { OpError, requireOpPermission } from "./context";
import { createRun, executeRun, type RunStep } from "./runs";
import { inferProduct } from "./router";
import { runPlaybook, findPlaybook } from "./playbooks";

export type Cadence = "HOURLY" | "DAILY" | "WEEKLY";
export type StandingKind = "ANALYZE" | "STATUS" | "DIGEST" | "PLAYBOOK";

export const CADENCE_LABEL: Record<Cadence, string> = { HOURLY: "Every hour", DAILY: "Every day", WEEKLY: "Every week" };

export function parseCadence(text: string): Cadence | null {
  const t = text.toLowerCase();
  if (/\bevery\s+hour\b|\bhourly\b|\beach hour\b/.test(t)) return "HOURLY";
  if (/\bevery\s+week\b|\bweekly\b|\beach week\b|\bevery\s+(monday|tuesday|wednesday|thursday|friday)\b/.test(t)) return "WEEKLY";
  if (/\bevery\s+(day|morning|evening)\b|\bdaily\b|\beach (day|morning)\b/.test(t)) return "DAILY";
  return null;
}

export function stripCadence(text: string): string {
  return (
    text
      .replace(/^(standing( order)?|schedule)\s*:?\s*/i, "")
      .replace(/\b(every|each)\s+(hour|day|morning|evening|week|monday|tuesday|wednesday|thursday|friday)\b/gi, "")
      .replace(/\b(hourly|daily|weekly)\b/gi, "")
      .replace(/^\s*(,|:|-)\s*/, "")
      .replace(/\s+/g, " ")
      .trim() || "status"
  );
}

export function inferStandingKind(directive: string): { kind: StandingKind; playbookSlug?: string } {
  const t = directive.toLowerCase();
  const pb = t.match(/\b(?:run\s+)?playbook\s+([a-z0-9-]+)/);
  if (pb) return { kind: "PLAYBOOK", playbookSlug: pb[1] };
  if (/\bdigest\b|\bbrief\b|\bsummar/.test(t)) return { kind: "DIGEST" };
  if (/\bstatus\b|\bhealth\b/.test(t)) return { kind: "STATUS" };
  return { kind: "ANALYZE" };
}

export function computeNextRunAt(cadence: Cadence, from: Date = new Date()): Date {
  const ms = from.getTime();
  const h = 60 * 60 * 1000;
  return new Date(ms + (cadence === "HOURLY" ? h : cadence === "DAILY" ? 24 * h : 7 * 24 * h));
}

export function stepsForKind(kind: StandingKind, directive: string): RunStep[] {
  if (kind === "DIGEST") return [{ kind: "BRIEF" }];
  if (kind === "STATUS") return [{ kind: "STATUS" }];
  return [{ kind: "ANALYZE", product: inferProduct(directive), intent: directive }];
}

export async function createStandingOrder(
  ctx: OpCtx,
  input: { directive: string; cadence?: Cadence | string | null; title?: string; kind?: StandingKind; playbookId?: string | null },
) {
  requireOpPermission(ctx, "write");
  const cadence = (["HOURLY", "DAILY", "WEEKLY"].includes(String(input.cadence)) ? input.cadence : parseCadence(input.directive)) as Cadence | null;
  if (!cadence) throw new OpError("cadence_unparsed", "Standing order needs a cadence: every hour, every day, or every week.");
  const directive = stripCadence(input.directive).slice(0, 300);
  const inferred = inferStandingKind(directive);
  const kind = input.kind ?? inferred.kind;
  let playbookId = input.playbookId ?? null;
  if (kind === "PLAYBOOK") {
    const pb = await findPlaybook(ctx, playbookId || inferred.playbookSlug || "");
    if (!pb) throw new OpError("not_found", "Playbook for standing order not found in this organization", 404);
    playbookId = pb.id;
  } else {
    playbookId = null;
  }
  const row = await prisma.opStandingOrder.create({
    data: {
      organizationId: ctx.organizationId,
      title: (input.title || `${CADENCE_LABEL[cadence]} · ${directive}`).slice(0, 160),
      directive,
      kind,
      cadence,
      playbookId,
      nextRunAt: computeNextRunAt(cadence),
      createdById: ctx.userId,
    },
  });
  await writeAudit({ organizationId: ctx.organizationId, actorId: ctx.userId, action: "standing_order.created", entityType: "OpStandingOrder", entityId: row.id, metadata: { kind, cadence } });
  return row;
}

export async function listStandingOrders(ctx: OpCtx) {
  return prisma.opStandingOrder.findMany({ where: { organizationId: ctx.organizationId }, orderBy: [{ enabled: "desc" }, { createdAt: "desc" }] });
}

export async function setStandingOrderEnabled(ctx: OpCtx, id: string, enabled: boolean) {
  requireOpPermission(ctx, "write");
  const row = await prisma.opStandingOrder.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!row) throw new OpError("not_found", "Standing order not found in this organization", 404);
  return prisma.opStandingOrder.update({
    where: { id: row.id },
    data: { enabled, nextRunAt: enabled ? computeNextRunAt(row.cadence as Cadence) : row.nextRunAt },
  });
}

export async function deleteStandingOrder(ctx: OpCtx, id: string) {
  requireOpPermission(ctx, "write");
  const res = await prisma.opStandingOrder.deleteMany({ where: { id, organizationId: ctx.organizationId } });
  return res.count;
}

/** Execute one standing order now (permission checked by caller or skipped for authenticated tick). */
export async function runStandingOrder(ctx: OpCtx, id: string, opts?: { skipPermission?: boolean }) {
  if (!opts?.skipPermission) requireOpPermission(ctx, "run_intelligence");
  const order = await prisma.opStandingOrder.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!order) throw new OpError("not_found", "Standing order not found in this organization", 404);
  const runCtx: OpCtx = { ...ctx, userId: ctx.userId ?? order.createdById };
  let status: "SUCCEEDED" | "FAILED" = "FAILED";
  let runId: string | null = null;
  let error: string | null = null;
  try {
    if (order.kind === "PLAYBOOK" && order.playbookId) {
      const { run } = await runPlaybook(runCtx, order.playbookId, { source: "STANDING_ORDER", sourceId: order.id, skipPermission: true });
      runId = run.id;
      status = run.status === "FAILED" || run.status === "CANCELLED" ? "FAILED" : "SUCCEEDED";
      error = run.error;
    } else {
      const run = await createRun(runCtx, { title: order.title, steps: stepsForKind(order.kind as StandingKind, order.directive), source: "STANDING_ORDER", sourceId: order.id });
      const done = await executeRun(runCtx, run.id);
      runId = done.id;
      status = done.status === "SUCCEEDED" || done.status === "WAITING_APPROVAL" ? "SUCCEEDED" : "FAILED";
      error = done.error;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const now = new Date();
  return prisma.opStandingOrder.update({
    where: { id: order.id },
    data: {
      lastRunAt: now,
      nextRunAt: computeNextRunAt(order.cadence as Cadence, now),
      lastStatus: status,
      lastResultJson: JSON.stringify({ ok: status === "SUCCEEDED", runId, error }),
      runCount: { increment: 1 },
      ...(status === "FAILED" ? { failureCount: { increment: 1 } } : {}),
    },
  });
}

/** Run every due standing order for one organization. */
export async function runDueStandingOrders(ctx: OpCtx, opts?: { skipPermission?: boolean; limit?: number }) {
  if (!opts?.skipPermission) requireOpPermission(ctx, "run_intelligence");
  const due = await prisma.opStandingOrder.findMany({
    where: { organizationId: ctx.organizationId, enabled: true, nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: "asc" },
    take: opts?.limit ?? 10,
  });
  const results = [];
  for (const o of due) results.push(await runStandingOrder(ctx, o.id, { skipPermission: true }));
  return results;
}

/** Platform tick (token-authenticated route): iterate orgs with due orders. Each org is processed in its own context. */
export async function tickAllOrganizations(limitOrgs = 25) {
  const due = await prisma.opStandingOrder.findMany({
    where: { enabled: true, nextRunAt: { lte: new Date() } },
    select: { organizationId: true },
    distinct: ["organizationId"],
    take: limitOrgs,
  });
  const out: Array<{ organizationId: string; ran: number }> = [];
  for (const { organizationId } of due) {
    const ctx: OpCtx = { organizationId, userId: null, role: "SYSTEM" };
    const r = await runDueStandingOrders(ctx, { skipPermission: true, limit: 5 });
    out.push({ organizationId, ran: r.length });
  }
  return out;
}
