"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, assertOrgId } from "@/lib/tenant";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";
import { validateApprovalDecision } from "@/lib/si-approvals";
import { recordStatusChange } from "@/lib/status-history";
import { normalizeOpsAmounts } from "@/lib/financial-impact";
import { scoreWorkItem } from "@/lib/scoring";
import { OE_STATUSES } from "@/lib/enums";
import { can } from "@/lib/rbac";
import { notify } from "@/lib/notifications";
import { recordLearningEvent } from "@/lib/learning";

const schema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  source: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  type: z.string().max(120).optional(),
  status: z.string().optional(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  estimatedWasteAnnual: z.coerce.number().min(0).optional(),
  projectedSavings: z.coerce.number().min(0).optional(),
  realizedSavings: z.coerce.number().min(0).optional(),
  recoveredAnnual: z.coerce.number().min(0).optional(),
  hoursWastedWeekly: z.coerce.number().min(0).optional().nullable(),
  projectedHoursWeekly: z.coerce.number().min(0).optional().nullable(),
  realizedHoursWeekly: z.coerce.number().min(0).optional().nullable(),
  automationCandidate: z.coerce.boolean().optional(),
  assigneeId: z.string().optional().nullable(),
});

async function orgSettings(organizationId: string) {
  return prisma.orgSettings.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId },
  });
}

export async function createInefficiency(formData: FormData) {
  const ctx = await requirePermission("write");
  assertOrgId(ctx.organizationId);
  const parsed = schema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    source: formData.get("source") || undefined,
    department: formData.get("department") || undefined,
    type: formData.get("type") || undefined,
    status: formData.get("status") || "IDENTIFIED",
    priority: formData.get("priority") || "MEDIUM",
    estimatedWasteAnnual: formData.get("estimatedWasteAnnual") || 0,
    projectedSavings: formData.get("projectedSavings") || formData.get("estimatedWasteAnnual") || 0,
    recoveredAnnual: formData.get("recoveredAnnual") || 0,
    hoursWastedWeekly: formData.get("hoursWastedWeekly") || null,
    automationCandidate: formData.get("automationCandidate") === "on" || formData.get("automationCandidate") === "true",
    assigneeId: formData.get("assigneeId") || null,
  });
  if (!parsed.success) return { error: "Invalid data" };
  const data = parsed.data;
  const money = normalizeOpsAmounts(data);
  const settings = await orgSettings(ctx.organizationId);
  const scored = scoreWorkItem({
    amount: money.projectedSavings,
    ageDays: 0,
    priorityHint: data.priority,
    settings,
  });
  const status = (OE_STATUSES as readonly string[]).includes(data.status || "")
    ? (data.status as string)
    : "IDENTIFIED";
  const created = await prisma.inefficiency.create({
    data: {
      organizationId: ctx.organizationId,
      title: data.title,
      description: data.description,
      source: data.source,
      department: data.department,
      type: data.type,
      status,
      priority: data.priority ?? scored.priority,
      score: scored.score,
      scoreFactorsJson: JSON.stringify(scored.factors),
      estimatedWasteAnnual: money.projectedSavings,
      projectedSavings: money.projectedSavings,
      recoveredAnnual: money.realizedSavings,
      realizedSavings: money.realizedSavings,
      hoursWastedWeekly: money.projectedHoursWeekly,
      projectedHoursWeekly: money.projectedHoursWeekly,
      realizedHoursWeekly: money.realizedHoursWeekly,
      automationCandidate: data.automationCandidate ?? false,
      assigneeId: data.assigneeId || null,
      resolvedAt: status === "REALIZED" || status === "VERIFIED" || status === "RESOLVED" ? new Date() : null,
    },
  });
  await recordStatusChange({
    organizationId: ctx.organizationId,
    entityType: "Inefficiency",
    entityId: created.id,
    fromStatus: null,
    toStatus: status,
    actorId: ctx.user.id,
  });
  if (created.automationCandidate) {
    await prisma.approvalRequest.create({
      data: {
        organizationId: ctx.organizationId,
        type: "AUTOMATION_CANDIDATE",
        title: `Automation candidate: ${created.title}`,
        description: "Recorded only. No external automation will run without explicit approval (SI pattern).",
        status: "PENDING",
        payloadJson: JSON.stringify({ inefficiencyId: created.id, executesExternally: false }),
        requestedById: ctx.user.id,
      },
    });
  }
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "inefficiency.created",
    entityType: "Inefficiency",
    entityId: created.id,
  });
  revalidatePath("/app/operations");
  revalidatePath("/app/action-center");
  return { ok: true, id: created.id };
}

export async function updateInefficiency(id: string, formData: FormData) {
  const ctx = await requirePermission("write");
  assertOrgId(ctx.organizationId);
  const existing = await prisma.inefficiency.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!existing) return { error: "Not found" };
  const parsed = schema.partial().safeParse({
    title: formData.get("title") || undefined,
    description: formData.get("description") || undefined,
    source: formData.get("source") || undefined,
    department: formData.get("department") || undefined,
    type: formData.get("type") || undefined,
    status: formData.get("status") || undefined,
    priority: formData.get("priority") || undefined,
    estimatedWasteAnnual: formData.get("estimatedWasteAnnual") || undefined,
    projectedSavings: formData.get("projectedSavings") || undefined,
    realizedSavings: formData.get("realizedSavings") || undefined,
    recoveredAnnual: formData.get("recoveredAnnual") || undefined,
    hoursWastedWeekly: formData.get("hoursWastedWeekly") || undefined,
    automationCandidate:
      formData.get("automationCandidate") === "on" ||
      formData.get("automationCandidate") === "true" ||
      (formData.get("automationCandidate") === "false" ? false : undefined),
    assigneeId: formData.get("assigneeId") === "" ? null : formData.get("assigneeId") || undefined,
  });
  if (!parsed.success) return { error: "Invalid" };
  const data = parsed.data;
  if (
    (data.realizedSavings !== undefined || data.recoveredAnnual !== undefined) &&
    !can(ctx.effectiveRole, "record_financial")
  ) {
    delete data.realizedSavings;
    delete data.recoveredAnnual;
  }
  const money = normalizeOpsAmounts({
    estimatedWasteAnnual: data.estimatedWasteAnnual ?? existing.estimatedWasteAnnual,
    projectedSavings: data.projectedSavings ?? existing.projectedSavings,
    realizedSavings: data.realizedSavings ?? data.recoveredAnnual ?? existing.realizedSavings,
    hoursWastedWeekly: data.hoursWastedWeekly ?? existing.hoursWastedWeekly,
    projectedHoursWeekly: data.projectedHoursWeekly ?? existing.projectedHoursWeekly,
    realizedHoursWeekly: data.realizedHoursWeekly ?? existing.realizedHoursWeekly,
  });
  const status = data.status ?? existing.status;
  const settings = await orgSettings(ctx.organizationId);
  const ageDays = Math.floor((Date.now() - existing.identifiedAt.getTime()) / 86400000);
  const scored = scoreWorkItem({
    amount: money.projectedSavings,
    ageDays,
    priorityHint: data.priority ?? existing.priority,
    evidenceCount: await prisma.evidence.count({ where: { inefficiencyId: id } }),
    settings,
  });
  await prisma.inefficiency.update({
    where: { id },
    data: {
      title: data.title ?? existing.title,
      description: data.description ?? existing.description,
      source: data.source ?? existing.source,
      department: data.department ?? existing.department,
      type: data.type ?? existing.type,
      status,
      priority: data.priority ?? scored.priority,
      score: scored.score,
      scoreFactorsJson: JSON.stringify(scored.factors),
      estimatedWasteAnnual: money.projectedSavings,
      projectedSavings: money.projectedSavings,
      recoveredAnnual: money.realizedSavings,
      realizedSavings: money.realizedSavings,
      hoursWastedWeekly: money.projectedHoursWeekly,
      projectedHoursWeekly: money.projectedHoursWeekly,
      realizedHoursWeekly: money.realizedHoursWeekly,
      automationCandidate: data.automationCandidate ?? existing.automationCandidate,
      assigneeId: data.assigneeId === undefined ? existing.assigneeId : data.assigneeId,
      resolvedAt:
        status === "REALIZED" || status === "VERIFIED" || status === "RESOLVED"
          ? existing.resolvedAt ?? new Date()
          : null,
      verifiedAt: status === "VERIFIED" ? existing.verifiedAt ?? new Date() : null,
    },
  });
  if (status !== existing.status) {
    await recordStatusChange({
      organizationId: ctx.organizationId,
      entityType: "Inefficiency",
      entityId: id,
      fromStatus: existing.status,
      toStatus: status,
      actorId: ctx.user.id,
      note: String(formData.get("statusNote") || "") || null,
    });
    if (["VERIFIED", "REALIZED", "RESOLVED", "DISMISSED"].includes(status)) {
      await recordLearningEvent({
        organizationId: ctx.organizationId,
        actorId: ctx.user.id,
        product: "OPERATIONS_EFFICIENCY",
        entityType: "Inefficiency",
        entityId: id,
        outcome: status === "DISMISSED" ? "NEGATIVE" : status === "REALIZED" ? "NEUTRAL" : "POSITIVE",
        features: { source: data.source ?? existing.source, type: data.type ?? existing.type, department: data.department ?? existing.department, priority: data.priority ?? existing.priority },
        note: `Outcome recorded as ${status}`,
      });
    }
  }
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "inefficiency.updated",
    entityType: "Inefficiency",
    entityId: id,
  });
  revalidatePath("/app/operations");
  revalidatePath(`/app/operations/${id}`);
  revalidatePath("/app/action-center");
  return { ok: true };
}

export async function addInefficiencyNote(inefficiencyId: string, formData: FormData) {
  const ctx = await requirePermission("comment");
  assertOrgId(ctx.organizationId);
  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Note required" };
  const row = await prisma.inefficiency.findFirst({
    where: { id: inefficiencyId, organizationId: ctx.organizationId },
  });
  if (!row) return { error: "Not found" };
  await prisma.inefficiencyNote.create({
    data: { inefficiencyId, authorId: ctx.user.id, body },
  });
  revalidatePath(`/app/operations/${inefficiencyId}`);
  return { ok: true };
}

export async function recordSavings(inefficiencyId: string, formData: FormData) {
  const ctx = await requirePermission("record_financial");
  assertOrgId(ctx.organizationId);
  const row = await prisma.inefficiency.findFirst({
    where: { id: inefficiencyId, organizationId: ctx.organizationId },
  });
  if (!row) return { error: "Not found" };
  const realized = Number(formData.get("realizedSavings") || 0);
  const verified = formData.get("verified") === "on" || formData.get("verified") === "true";
  if (!Number.isFinite(realized) || realized < 0) return { error: "Invalid amount" };
  const toStatus = verified ? "VERIFIED" : "REALIZED";
  await prisma.inefficiency.update({
    where: { id: inefficiencyId },
    data: {
      realizedSavings: realized,
      recoveredAnnual: realized,
      status: toStatus,
      resolvedAt: new Date(),
      verifiedAt: verified ? new Date() : null,
    },
  });
  await recordStatusChange({
    organizationId: ctx.organizationId,
    entityType: "Inefficiency",
    entityId: inefficiencyId,
    fromStatus: row.status,
    toStatus,
    actorId: ctx.user.id,
    note: `Recorded savings ${realized}`,
  });
  await recordLearningEvent({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    product: "OPERATIONS_EFFICIENCY",
    entityType: "Inefficiency",
    entityId: inefficiencyId,
    outcome: verified ? "POSITIVE" : "NEUTRAL",
    features: { source: row.source, type: row.type, department: row.department, priority: row.priority },
    note: verified ? `Verified realized savings ${realized}` : `Realized savings ${realized}`,
  });
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "inefficiency.savings_recorded",
    entityType: "Inefficiency",
    entityId: inefficiencyId,
    metadata: { realized, verified },
  });
  revalidatePath(`/app/operations/${inefficiencyId}`);
  return { ok: true };
}

export async function decideApproval(id: string, formData: FormData) {
  const ctx = await requirePermission("approve");
  assertOrgId(ctx.organizationId);
  const decision = String(formData.get("decision")) === "REJECTED" ? "REJECTED" : "APPROVED";
  const confirmStepUp = formData.get("confirmStepUp") === "on" || formData.get("confirmStepUp") === "true";
  const req = await prisma.approvalRequest.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!req || req.status !== "PENDING") return { error: "Not found or not pending" };
  const check = validateApprovalDecision({ type: req.type, decision, confirmStepUp });
  if (!check.ok) return { error: check.message };

  let executionNote = "Decision recorded only — no external execution";
  if (decision === "APPROVED" && req.needsIntegration) {
    executionNote = `Approved but blocked: needs integration ${req.needsIntegration}. Not executed.`;
  } else if (decision === "APPROVED" && req.type === "EXTERNAL_ACTION") {
    const payload = req.payloadJson ? JSON.parse(req.payloadJson) : {};
    const provider = payload.provider as string | undefined;
    if (provider) {
      const integ = await prisma.integrationConnection.findUnique({
        where: { organizationId_provider: { organizationId: ctx.organizationId, provider } },
      });
      if (integ?.status !== "CONNECTED") {
        executionNote = `Approved but needs integration ${provider}. Not executed.`;
        await prisma.approvalRequest.update({
          where: { id },
          data: { needsIntegration: provider },
        });
      }
    }
  }

  await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: decision,
      decidedById: ctx.user.id,
      decidedAt: new Date(),
      decisionNote: String(formData.get("note") || "") || executionNote,
    },
  });
  await recordStatusChange({
    organizationId: ctx.organizationId,
    entityType: "ApprovalRequest",
    entityId: id,
    fromStatus: "PENDING",
    toStatus: decision,
    actorId: ctx.user.id,
    note: executionNote,
  });
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: `approval.${decision.toLowerCase()}`,
    entityType: "ApprovalRequest",
    entityId: id,
    metadata: { note: executionNote },
  });
  await notify({
    organizationId: ctx.organizationId,
    userId: req.requestedById,
    title: `Approval ${decision}`,
    body: executionNote,
    href: "/app/approvals",
  });
  revalidatePath("/app/approvals");
  revalidatePath("/app/action-center");
  return { ok: true, message: executionNote };
}
