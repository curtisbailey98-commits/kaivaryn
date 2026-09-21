"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, assertOrgId } from "@/lib/tenant";
import { enqueueIntelligenceRun } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

export async function runIntelligence(formData?: FormData) {
  void formData;
  const ctx = await requirePermission("run_intelligence");
  assertOrgId(ctx.organizationId);
  const run = await enqueueIntelligenceRun(ctx.organizationId, ctx.user.id);
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "intelligence.enqueued",
    entityType: "IntelligenceRun",
    entityId: run.id,
  });
  revalidatePath("/app/jobs");
  revalidatePath("/app/action-center");
  revalidatePath("/app/findings");
}

export async function markNotificationRead(id: string, formData?: FormData) {
  void formData;
  const ctx = await requirePermission("read");
  assertOrgId(ctx.organizationId);
  await prisma.notification.updateMany({
    where: { id, userId: ctx.user.id, organizationId: ctx.organizationId },
    data: { readAt: new Date() },
  });
  revalidatePath("/app/notifications");
}

export async function markAllNotificationsRead(formData?: FormData) {
  void formData;
  const ctx = await requirePermission("read");
  assertOrgId(ctx.organizationId);
  await prisma.notification.updateMany({
    where: { userId: ctx.user.id, organizationId: ctx.organizationId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/app/notifications");
}
