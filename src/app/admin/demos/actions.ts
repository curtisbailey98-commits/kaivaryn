"use server";

import { revalidatePath } from "next/cache";
import { DemoRequestStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/tenant";
import { writeAudit } from "@/lib/audit";

const PIPELINE: DemoRequestStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "SCHEDULED",
  "DEMO_COMPLETED",
  "PAYMENT_PENDING",
  "CLOSED_WON",
  "CLOSED_LOST",
];

export async function updateDemoStatus(id: string, formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx?.isSuperAdmin) return { error: "forbidden" };
  const status = String(formData.get("status")) as DemoRequestStatus;
  if (!PIPELINE.includes(status)) return { error: "invalid status" };
  await prisma.demoRequest.update({
    where: { id },
    data: { status, notes: String(formData.get("notes") || "") || undefined },
  });
  await writeAudit({
    actorId: ctx.user.id,
    action: "demo_request.status_updated",
    entityType: "DemoRequest",
    entityId: id,
    metadata: { status },
  });
  revalidatePath("/admin/demos");
  return { ok: true };
}

