"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const opportunitySchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  source: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  type: z.string().max(120).optional(),
  status: z.enum(["NEW","IN_PROGRESS","RECOVERED","DISMISSED"]).optional(),
  priority: z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).optional(),
  estimatedAmount: z.coerce.number().min(0).optional(),
  recoveredAmount: z.coerce.number().min(0).optional(),
  assigneeId: z.string().optional().nullable(),
});

export async function createOpportunity(formData: FormData) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const parsed = opportunitySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    source: formData.get("source") || undefined,
    department: formData.get("department") || undefined,
    type: formData.get("type") || undefined,
    status: formData.get("status") || "NEW",
    priority: formData.get("priority") || "MEDIUM",
    estimatedAmount: formData.get("estimatedAmount") || 0,
    recoveredAmount: formData.get("recoveredAmount") || 0,
    assigneeId: formData.get("assigneeId") || null,
  });
  if (!parsed.success) return { error: "Invalid opportunity data" };
  const data = parsed.data;
  const created = await prisma.opportunity.create({
    data: {
      organizationId: ctx.organizationId,
      title: data.title,
      description: data.description,
      source: data.source,
      department: data.department,
      type: data.type,
      status: data.status ?? "NEW",
      priority: data.priority ?? "MEDIUM",
      estimatedAmount: data.estimatedAmount ?? 0,
      recoveredAmount: data.recoveredAmount ?? 0,
      assigneeId: data.assigneeId || null,
      recoveredAt: data.status === "RECOVERED" ? new Date() : null,
    },
  });
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "opportunity.created",
    entityType: "Opportunity",
    entityId: created.id,
  });
  revalidatePath("/app/revenue");
  return { ok: true, id: created.id };
}

export async function updateOpportunity(id: string, formData: FormData) {
  const ctx = await requireOrgAccess();
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
    recoveredAmount: formData.get("recoveredAmount") || undefined,
    assigneeId: formData.get("assigneeId") === "" ? null : formData.get("assigneeId") || undefined,
  });
  if (!parsed.success) return { error: "Invalid data" };
  const data = parsed.data;
  const status = data.status ?? existing.status;
  await prisma.opportunity.update({
    where: { id },
    data: {
      ...data,
      assigneeId: data.assigneeId === undefined ? existing.assigneeId : data.assigneeId,
      recoveredAt:
        status === "RECOVERED"
          ? existing.recoveredAt ?? new Date()
          : status !== "RECOVERED"
            ? null
            : existing.recoveredAt,
    },
  });
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "opportunity.updated",
    entityType: "Opportunity",
    entityId: id,
  });
  revalidatePath("/app/revenue");
  revalidatePath(`/app/revenue/${id}`);
  return { ok: true };
}

export async function addOpportunityNote(opportunityId: string, formData: FormData) {
  const ctx = await requireOrgAccess();
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
