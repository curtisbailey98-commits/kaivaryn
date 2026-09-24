"use server";

import { revalidatePath } from "next/cache";
import { DemoRequestStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/tenant";
import { writeAudit } from "@/lib/audit";
import { markDemoCompleted, syncDemoToAcquisition } from "@/lib/acquisition";

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
  const zoomRaw = String(formData.get("zoomLink") || "").trim();
  if (zoomRaw && !/^https?:\/\//i.test(zoomRaw)) {
    return { error: "Zoom link must be an http(s) URL" };
  }
  const demo = await prisma.demoRequest.update({
    where: { id },
    data: {
      status,
      notes: String(formData.get("notes") || "") || undefined,
      zoomLink: zoomRaw || null,
    },
  });
  let acquisition = await prisma.acquisitionAccount.findFirst({ where: { demoRequestId: id } });
  if (!acquisition) acquisition = await syncDemoToAcquisition(demo.id);
  if (status === "SCHEDULED") {
    await prisma.acquisitionAccount.update({ where: { id: acquisition.id }, data: { stage: "DEMO_BOOKED" } });
  }
  if (status === "DEMO_COMPLETED") {
    await markDemoCompleted(acquisition.id);
  }
  if (status === "CLOSED_LOST") {
    await prisma.acquisitionAccount.update({ where: { id: acquisition.id }, data: { stage: "CLOSED_LOST" } });
  }
  await writeAudit({
    actorId: ctx.user.id,
    action: "demo_request.status_updated",
    entityType: "DemoRequest",
    entityId: id,
    metadata: { status, hasZoomLink: Boolean(zoomRaw) },
  });
  revalidatePath("/admin/demos");
  return { ok: true };
}
