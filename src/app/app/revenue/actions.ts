"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, assertOrgId } from "@/lib/tenant";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";
import { recordStatusChange } from "@/lib/status-history";
import { normalizeRevenueAmounts } from "@/lib/financial-impact";
import { scoreWorkItem } from "@/lib/scoring";
import { RR_STATUSES } from "@/lib/enums";
import { notify } from "@/lib/notifications";
import { recordLearningEvent } from "@/lib/learning";

const opportunitySchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  source: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  type: z.string().max(120).optional(),
  status: z.string().optional(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  estimatedAmount: z.coerce.number().min(0).optional(),
  potentialAmount: z.coerce.number().min(0).optional(),
  approvedAmount: z.coerce.number().min(0).optional(),
  inProgressAmount: z.coerce.number().min(0).optional(),
  recoveredAmount: z.coerce.number().min(0).optional(),
  verifiedAmount: z.coerce.number().min(0).optional(),
  assigneeId: z.string().optional().nullable(),
});

async function orgSettings(organizationId: string) {
  return prisma.orgSettings.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId },
  });
}

export async function createOpportunity(formData: FormData) {
  const ctx = await requirePermission("write");
  assertOrgId(ctx.organizationId);
  const parsed = opportunitySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    source: formData.get("source") || undefined,
    department: formData.get("department") || undefined,
    type: formData.get("type") || undefined,
    status: formData.get("status") || "IDENTIFIED",
    priority: formData.get("priority") || "MEDIUM",
    estimatedAmount: formData.get("estimatedAmount") || 0,
    potentialAmount: formData.get("potentialAmount") || formData.get("estimatedAmount") || 0,
    recoveredAmount: formData.get("recoveredAmount") || 0,
    assigneeId: formData.get("assigneeId") || null,
  });
  if (!parsed.success) return { error: "Invalid opportunity data" };
  const data = parsed.data;
  const money = normalizeRevenueAmounts(data);
  const settings = await orgSettings(ctx.organizationId);
  const scored = scoreWorkItem({
    amount: money.potential,
    ageDays: 0,
    priorityHint: data.priority,
    evidenceCount: 0,
    settings,
  });
  const status = (RR_STATUSES as readonly string[]).includes(data.status || "")
    ? (data.status as string)
    : "IDENTIFIED";
  const created = await prisma.opportunity.create({
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
      potentialAmount: money.potential,
      estimatedAmount: money.potential,
      approvedAmount: money.approved,
      inProgressAmount: money.inProgress,
      recoveredAmount: money.recovered,
      verifiedAmount: money.verified,
      assigneeId: data.assigneeId || null,
      recoveredAt: status === "RECOVERED" || status === "VERIFIED" ? new Date() : null,
    },
  });
  await recordStatusChange({
    organizationId: ctx.organizationId,
    entityType: "Opportunity",
    entityId: created.id,
    fromStatus: null,
    toStatus: status,
    actorId: ctx.user.id,
  });
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "opportunity.created",
    entityType: "Opportunity",
    entityId: created.id,
  });
  revalidatePath("/app/revenue");
  revalidatePath("/app/action-center");
  return { ok: true, id: created.id };
}

export async function updateOpportunity(id: string, formData: FormData) {
  const ctx = await requirePermission("write");
  assertOrgId(ctx.organizationId);
  const existing = await prisma.opportunity.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!existing) return { error: "Not found" };
  const parsed = opportunitySchema.partial().safeParse({
    title: formData.get("title") || undefined,
    description: formData.get("description") || undefined,
    source: formData.get("source") || undefined,
    department: formData.get("department") || undefined,
    type: formData.get("type") || undefined,
    status: formData.get("status") || undefined,
    priority: formData.get("priority") || undefined,
    estimatedAmount: formData.get("estimatedAmount") || undefined,
    potentialAmount: formData.get("potentialAmount") || undefined,
    approvedAmount: formData.get("approvedAmount") || undefined,
    inProgressAmount: formData.get("inProgressAmount") || undefined,
    recoveredAmount: formData.get("recoveredAmount") || undefined,
    verifiedAmount: formData.get("verifiedAmount") || undefined,
    assigneeId: formData.get("assigneeId") === "" ? null : formData.get("assigneeId") || undefined,
  });
  if (!parsed.success) return { error: "Invalid data" };
  const data = parsed.data;

  if (
    (data.recoveredAmount !== undefined || data.verifiedAmount !== undefined || data.approvedAmount !== undefined) &&
    !(await import("@/lib/rbac")).can(ctx.effectiveRole, "record_financial")
  ) {
    // viewers/analysts cannot set recovered/verified
    if (ctx.effectiveRole === "VIEWER" || ctx.effectiveRole === "ANALYST") {
      delete data.recoveredAmount;
      delete data.verifiedAmount;
      delete data.approvedAmount;
    }
  }

  const money = normalizeRevenueAmounts({
    potentialAmount: data.potentialAmount ?? data.estimatedAmount ?? existing.potentialAmount,
    approvedAmount: data.approvedAmount ?? existing.approvedAmount,
    inProgressAmount: data.inProgressAmount ?? existing.inProgressAmount,
    recoveredAmount: data.recoveredAmount ?? existing.recoveredAmount,
    verifiedAmount: data.verifiedAmount ?? existing.verifiedAmount,
  });
  const status = data.status ?? existing.status;
  const settings = await orgSettings(ctx.organizationId);
  const ageDays = Math.floor((Date.now() - existing.identifiedAt.getTime()) / 86400000);
  const scored = scoreWorkItem({
    amount: money.potential,
    ageDays,
    priorityHint: data.priority ?? existing.priority,
    evidenceCount: await prisma.evidence.count({ where: { opportunityId: id } }),
    settings,
  });

  await prisma.opportunity.update({
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
      potentialAmount: money.potential,
      estimatedAmount: money.potential,
      approvedAmount: money.approved,
      inProgressAmount: money.inProgress,
      recoveredAmount: money.recovered,
      verifiedAmount: money.verified,
      assigneeId: data.assigneeId === undefined ? existing.assigneeId : data.assigneeId,
      recoveredAt:
        status === "RECOVERED" || status === "VERIFIED" || status === "PARTIALLY_RECOVERED"
          ? existing.recoveredAt ?? new Date()
          : null,
      verifiedAt: status === "VERIFIED" ? existing.verifiedAt ?? new Date() : status !== "VERIFIED" ? null : existing.verifiedAt,
    },
  });
  if (status !== existing.status) {
    await recordStatusChange({
      organizationId: ctx.organizationId,
      entityType: "Opportunity",
      entityId: id,
      fromStatus: existing.status,
      toStatus: status,
      actorId: ctx.user.id,
      note: String(formData.get("statusNote") || "") || null,
    });
    if (["VERIFIED", "RECOVERED", "PARTIALLY_RECOVERED", "DISMISSED"].includes(status)) {
      await recordLearningEvent({
        organizationId: ctx.organizationId,
        actorId: ctx.user.id,
        product: "REVENUE_RECOVERY",
        entityType: "Opportunity",
        entityId: id,
        outcome: status === "DISMISSED" ? "NEGATIVE" : status === "PARTIALLY_RECOVERED" ? "NEUTRAL" : "POSITIVE",
        features: { source: data.source ?? existing.source, type: data.type ?? existing.type, department: data.department ?? existing.department, priority: data.priority ?? existing.priority },
        note: `Outcome recorded as ${status}`,
      });
    }
  }
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "opportunity.updated",
    entityType: "Opportunity",
    entityId: id,
  });
  revalidatePath("/app/revenue");
  revalidatePath(`/app/revenue/${id}`);
  revalidatePath("/app/action-center");
  return { ok: true };
}

export async function addOpportunityNote(opportunityId: string, formData: FormData) {
  const ctx = await requirePermission("comment");
  assertOrgId(ctx.organizationId);
  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Note required" };
  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId: ctx.organizationId },
  });
  if (!opp) return { error: "Not found" };
  await prisma.opportunityNote.create({
    data: { opportunityId, authorId: ctx.user.id, body },
  });
  revalidatePath(`/app/revenue/${opportunityId}`);
  return { ok: true };
}

export async function assignOpportunity(opportunityId: string, formData: FormData) {
  const ctx = await requirePermission("assign");
  assertOrgId(ctx.organizationId);
  const assigneeId = String(formData.get("assigneeId") || "") || null;
  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId: ctx.organizationId },
  });
  if (!opp) return { error: "Not found" };
  if (assigneeId) {
    const m = await prisma.membership.findFirst({
      where: { organizationId: ctx.organizationId, userId: assigneeId },
    });
    if (!m) return { error: "Assignee not in organization" };
  }
  await prisma.opportunity.update({ where: { id: opportunityId }, data: { assigneeId } });
  if (assigneeId) {
    await notify({
      organizationId: ctx.organizationId,
      userId: assigneeId,
      title: `Assigned: ${opp.title}`,
      body: "You were assigned a revenue recovery opportunity.",
      href: `/app/revenue/${opportunityId}`,
    });
  }
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "opportunity.assigned",
    entityType: "Opportunity",
    entityId: opportunityId,
    metadata: { assigneeId },
  });
  revalidatePath(`/app/revenue/${opportunityId}`);
  return { ok: true };
}

export async function recordRecovery(opportunityId: string, formData: FormData) {
  const ctx = await requirePermission("record_financial");
  assertOrgId(ctx.organizationId);
  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId: ctx.organizationId },
  });
  if (!opp) return { error: "Not found" };
  const recovered = Number(formData.get("recoveredAmount") || 0);
  const verified = formData.get("verified") === "on" || formData.get("verified") === "true";
  if (!Number.isFinite(recovered) || recovered < 0) return { error: "Invalid amount" };
  const money = normalizeRevenueAmounts({
    potentialAmount: opp.potentialAmount,
    approvedAmount: opp.approvedAmount,
    inProgressAmount: opp.inProgressAmount,
    recoveredAmount: recovered,
    verifiedAmount: verified ? recovered : opp.verifiedAmount,
  });
  const toStatus = verified ? "VERIFIED" : recovered > 0 && recovered < money.potential ? "PARTIALLY_RECOVERED" : "RECOVERED";
  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      recoveredAmount: money.recovered,
      verifiedAmount: money.verified,
      inProgressAmount: money.inProgress,
      status: toStatus,
      recoveredAt: new Date(),
      verifiedAt: verified ? new Date() : null,
    },
  });
  await recordStatusChange({
    organizationId: ctx.organizationId,
    entityType: "Opportunity",
    entityId: opportunityId,
    fromStatus: opp.status,
    toStatus,
    actorId: ctx.user.id,
    note: `Recorded recovery ${recovered}`,
  });
  await recordLearningEvent({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    product: "REVENUE_RECOVERY",
    entityType: "Opportunity",
    entityId: opportunityId,
    outcome: verified ? "POSITIVE" : recovered > 0 ? "NEUTRAL" : "NEGATIVE",
    features: { source: opp.source, type: opp.type, department: opp.department, priority: opp.priority },
    note: verified ? `Verified recovery ${recovered}` : `Recorded recovery ${recovered}`,
  });
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "opportunity.recovery_recorded",
    entityType: "Opportunity",
    entityId: opportunityId,
    metadata: { recovered, verified },
  });
  revalidatePath(`/app/revenue/${opportunityId}`);
  revalidatePath("/app/action-center");
  return { ok: true };
}

export async function draftOpportunityEmail(opportunityId: string, formData: FormData) {
  const ctx = await requirePermission("write");
  assertOrgId(ctx.organizationId);
  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId: ctx.organizationId },
  });
  if (!opp) return { error: "Not found" };
  const subject = String(formData.get("subject") || `Regarding: ${opp.title}`).slice(0, 300);
  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Body required" };
  const draft = await prisma.emailDraft.create({
    data: {
      organizationId: ctx.organizationId,
      entityType: "Opportunity",
      entityId: opportunityId,
      toAddress: String(formData.get("to") || "") || null,
      subject,
      body,
      status: "DRAFT",
      createdById: ctx.user.id,
    },
  });
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "email_draft.created",
    entityType: "EmailDraft",
    entityId: draft.id,
    metadata: { note: "Draft only — no send" },
  });
  revalidatePath(`/app/revenue/${opportunityId}`);
  return { ok: true, id: draft.id, message: "Draft saved. No email was sent." };
}

export async function createOpportunityTask(opportunityId: string, formData: FormData) {
  const ctx = await requirePermission("write");
  assertOrgId(ctx.organizationId);
  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId: ctx.organizationId },
  });
  if (!opp) return { error: "Not found" };
  const title = String(formData.get("title") || "").trim();
  if (!title) return { error: "Title required" };
  const dueRaw = String(formData.get("dueAt") || "");
  const task = await prisma.task.create({
    data: {
      organizationId: ctx.organizationId,
      title,
      body: String(formData.get("body") || "") || null,
      entityType: "Opportunity",
      entityId: opportunityId,
      assigneeId: String(formData.get("assigneeId") || "") || ctx.user.id,
      createdById: ctx.user.id,
      dueAt: dueRaw ? new Date(dueRaw) : null,
    },
  });
  revalidatePath(`/app/revenue/${opportunityId}`);
  return { ok: true, id: task.id };
}

/** External action → approval queue; never fake success. */
export async function requestExternalAction(opportunityId: string, formData: FormData) {
  const ctx = await requirePermission("write");
  assertOrgId(ctx.organizationId);
  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId: ctx.organizationId },
  });
  if (!opp) return { error: "Not found" };
  const provider = String(formData.get("provider") || "billing_system");
  const integration = await prisma.integrationConnection.findUnique({
    where: { organizationId_provider: { organizationId: ctx.organizationId, provider } },
  });
  const connected = integration?.status === "CONNECTED";
  const needsIntegration = connected ? null : provider;
  const approval = await prisma.approvalRequest.create({
    data: {
      organizationId: ctx.organizationId,
      type: "EXTERNAL_ACTION",
      title: `External action on ${opp.title}`,
      description: connected
        ? "Queued for approval. Will not execute until approved AND credentials present."
        : `Needs integration: ${provider}. Credentials not connected — cannot execute.`,
      status: "PENDING",
      needsIntegration,
      payloadJson: JSON.stringify({
        opportunityId,
        provider,
        executesExternally: false,
        action: String(formData.get("action") || "sync_claim"),
      }),
      requestedById: ctx.user.id,
    },
  });
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "external_action.requested",
    entityType: "ApprovalRequest",
    entityId: approval.id,
    metadata: { needsIntegration, connected },
  });
  revalidatePath("/app/approvals");
  revalidatePath("/app/action-center");
  return {
    ok: true,
    id: approval.id,
    message: needsIntegration
      ? `Queued for approval. Needs integration: ${needsIntegration}`
      : "Queued for approval. No external execution until approved.",
  };
}
