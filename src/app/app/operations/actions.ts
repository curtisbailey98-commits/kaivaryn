"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";
import { validateApprovalDecision } from "@/lib/si-approvals";

const schema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  source: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  type: z.string().max(120).optional(),
  status: z.enum(["NEW","IN_PROGRESS","RESOLVED","DISMISSED"]).optional(),
  priority: z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).optional(),
  estimatedWasteAnnual: z.coerce.number().min(0).optional(),
  recoveredAnnual: z.coerce.number().min(0).optional(),
  hoursWastedWeekly: z.coerce.number().min(0).optional().nullable(),
  automationCandidate: z.coerce.boolean().optional(),
  assigneeId: z.string().optional().nullable(),
});

export async function createInefficiency(formData: FormData) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const parsed = schema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    source: formData.get("source") || undefined,
    department: formData.get("department") || undefined,
    type: formData.get("type") || undefined,
    status: formData.get("status") || "NEW",
    priority: formData.get("priority") || "MEDIUM",
    estimatedWasteAnnual: formData.get("estimatedWasteAnnual") || 0,
    recoveredAnnual: formData.get("recoveredAnnual") || 0,
    hoursWastedWeekly: formData.get("hoursWastedWeekly") || null,
    automationCandidate: formData.get("automationCandidate") === "on" || formData.get("automationCandidate") === "true",
    assigneeId: formData.get("assigneeId") || null,
  });
  if (!parsed.success) return { error: "Invalid data" };
  const data = parsed.data;
  const created = await prisma.inefficiency.create({
    data: {
      organizationId: ctx.organizationId,
      title: data.title,
      description: data.description,
      source: data.source,
      department: data.department,
      type: data.type,
      status: data.status ?? "NEW",
      priority: data.priority ?? "MEDIUM",
      estimatedWasteAnnual: data.estimatedWasteAnnual ?? 0,
      recoveredAnnual: data.recoveredAnnual ?? 0,
      hoursWastedWeekly: data.hoursWastedWeekly,
      automationCandidate: data.automationCandidate ?? false,
      assigneeId: data.assigneeId || null,
      resolvedAt: data.status === "RESOLVED" ? new Date() : null,
    },
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
  return { ok: true, id: created.id };
}

export async function updateInefficiency(id: string, formData: FormData) {
  const ctx = await requireOrgAccess();
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
  const status = data.status ?? existing.status;
  await prisma.inefficiency.update({
    where: { id },
    data: {
      ...data,
      resolvedAt: status === "RESOLVED" ? existing.resolvedAt ?? new Date() : status !== "RESOLVED" ? null : existing.resolvedAt,
    },
  });
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "inefficiency.updated",
    entityType: "Inefficiency",
    entityId: id,
  });
  revalidatePath("/app/operations");
  revalidatePath(`/app/operations/${id}`);
  return { ok: true };
}

export async function decideApproval(id: string, formData: FormData) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const decision = String(formData.get("decision")) === "REJECTED" ? "REJECTED" : "APPROVED";
  const confirmStepUp = formData.get("confirmStepUp") === "on" || formData.get("confirmStepUp") === "true";
  const req = await prisma.approvalRequest.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!req || req.status !== "PENDING") return { error: "Not found or not pending" };
  const check = validateApprovalDecision({ type: req.type, decision, confirmStepUp });
  if (!check.ok) return { error: check.message };
  await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: decision,
      decidedById: ctx.user.id,
      decidedAt: new Date(),
      decisionNote: String(formData.get("note") || "") || null,
    },
  });
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: `approval.${decision.toLowerCase()}`,
    entityType: "ApprovalRequest",
    entityId: id,
    metadata: { note: "Decision recorded only — no external execution" },
  });
  revalidatePath("/app/approvals");
  revalidatePath("/app/action-center");
  return { ok: true };
}
