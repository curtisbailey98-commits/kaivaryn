"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, assertOrgId } from "@/lib/tenant";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  stalledLeadDays: z.coerce.number().int().min(1).max(365),
  dormantCustomerDays: z.coerce.number().int().min(1).max(730),
  failedPaymentLookbackDays: z.coerce.number().int().min(1).max(365),
  missedAppointmentDays: z.coerce.number().int().min(1).max(90),
  pipelineStallDays: z.coerce.number().int().min(1).max(365),
  churnRiskInactiveDays: z.coerce.number().int().min(1).max(730),
  unansweredInquiryHours: z.coerce.number().int().min(1).max(720),
  approvalDelayDays: z.coerce.number().int().min(1).max(90),
  duplicateWorkWindowDays: z.coerce.number().int().min(1).max(365),
  scoreWeightAmount: z.coerce.number().min(0).max(1),
  scoreWeightAge: z.coerce.number().min(0).max(1),
  scoreWeightPriority: z.coerce.number().min(0).max(1),
  scoreWeightEvidence: z.coerce.number().min(0).max(1),
  highValueThreshold: z.coerce.number().min(0),
  managerApprovalLimit: z.coerce.number().min(0),
  adminApprovalLimit: z.coerce.number().min(0),
  requireApprovalAbove: z.coerce.number().min(0),
  notifyAssign: z.coerce.boolean(),
  notifyStatusChange: z.coerce.boolean(),
  notifyRecovery: z.coerce.boolean(),
  notifyHighValue: z.coerce.boolean(),
  notifyWeeklyBrief: z.coerce.boolean(),
  notifyEmailEnabled: z.coerce.boolean(),
  displayName: z.string().min(1).max(120).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export async function updateOrgSettings(formData: FormData) {
  const ctx = await requirePermission("manage_settings");
  assertOrgId(ctx.organizationId);

  const parsed = schema.safeParse({
    stalledLeadDays: formData.get("stalledLeadDays"),
    dormantCustomerDays: formData.get("dormantCustomerDays"),
    failedPaymentLookbackDays: formData.get("failedPaymentLookbackDays"),
    missedAppointmentDays: formData.get("missedAppointmentDays"),
    pipelineStallDays: formData.get("pipelineStallDays"),
    churnRiskInactiveDays: formData.get("churnRiskInactiveDays"),
    unansweredInquiryHours: formData.get("unansweredInquiryHours"),
    approvalDelayDays: formData.get("approvalDelayDays"),
    duplicateWorkWindowDays: formData.get("duplicateWorkWindowDays"),
    scoreWeightAmount: formData.get("scoreWeightAmount"),
    scoreWeightAge: formData.get("scoreWeightAge"),
    scoreWeightPriority: formData.get("scoreWeightPriority"),
    scoreWeightEvidence: formData.get("scoreWeightEvidence"),
    highValueThreshold: formData.get("highValueThreshold"),
    managerApprovalLimit: formData.get("managerApprovalLimit"),
    adminApprovalLimit: formData.get("adminApprovalLimit"),
    requireApprovalAbove: formData.get("requireApprovalAbove"),
    notifyAssign: bool(formData, "notifyAssign"),
    notifyStatusChange: bool(formData, "notifyStatusChange"),
    notifyRecovery: bool(formData, "notifyRecovery"),
    notifyHighValue: bool(formData, "notifyHighValue"),
    notifyWeeklyBrief: bool(formData, "notifyWeeklyBrief"),
    notifyEmailEnabled: bool(formData, "notifyEmailEnabled"),
    displayName: String(formData.get("displayName") || "").trim() || undefined,
    timezone: String(formData.get("timezone") || "").trim() || undefined,
  });

  if (!parsed.success) {
    redirect(`/app/settings?error=1&msg=${encodeURIComponent("Invalid settings")}`);
  }

  const data = parsed.data;
  if (data.managerApprovalLimit > data.adminApprovalLimit) {
    redirect(
      `/app/settings?error=1&msg=${encodeURIComponent("Manager limit must be ≤ admin limit")}`
    );
  }

  const { displayName, timezone, ...settingsData } = data;
  let settingsJson: string | undefined;
  if (timezone) {
    let prev: Record<string, unknown> = {};
    const existing = await prisma.orgSettings.findUnique({ where: { organizationId: ctx.organizationId } });
    if (existing?.settingsJson) {
      try { prev = JSON.parse(existing.settingsJson); } catch { prev = {}; }
    }
    prev.timezone = timezone;
    settingsJson = JSON.stringify(prev);
  }

  await prisma.orgSettings.upsert({
    where: { organizationId: ctx.organizationId },
    update: { ...settingsData, ...(settingsJson ? { settingsJson } : {}) },
    create: { organizationId: ctx.organizationId, ...settingsData, ...(settingsJson ? { settingsJson } : {}) },
  });

  if (displayName) {
    await prisma.organization.update({
      where: { id: ctx.organizationId },
      data: { name: displayName },
    });
  }

  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "org_settings.updated",
    entityType: "OrgSettings",
    entityId: ctx.organizationId,
    metadata: {
      highValueThreshold: data.highValueThreshold,
      requireApprovalAbove: data.requireApprovalAbove,
      timezone: data.timezone,
      displayName: data.displayName,
    },
  });

  revalidatePath("/app/settings");
  revalidatePath("/app/action-center");
  redirect(`/app/settings?ok=1&msg=${encodeURIComponent("Settings saved")}`);
}
