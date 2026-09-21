"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { runImportJob } from "@/lib/imports";
import { writeAudit } from "@/lib/audit";

export async function submitImport(formData: FormData) {
  const ctx = await requirePermission("import");
  assertOrgId(ctx.organizationId);
  const kind = String(formData.get("kind") || "opportunities");
  if (!["opportunities", "customers", "processes", "inefficiencies"].includes(kind)) {
    throw new Error("Invalid kind");
  }
  const file = formData.get("file");
  if (!file || typeof file === "string") throw new Error("CSV file required");
  const text = await (file as File).text();
  if (!text.trim()) throw new Error("Empty file");

  const mapping: Record<string, string> = {};
  for (const [k, v] of Array.from(formData.entries())) {
    if (k.startsWith("map_") && typeof v === "string" && v) {
      mapping[k.slice(4)] = v;
    }
  }

  const job = await prisma.importJob.create({
    data: {
      organizationId: ctx.organizationId,
      kind,
      status: "QUEUED",
      fileName: (file as File).name || "upload.csv",
      mappingJson: JSON.stringify(mapping),
      createdById: ctx.user.id,
    },
  });
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    action: "import.queued",
    entityType: "ImportJob",
    entityId: job.id,
  });
  await runImportJob(job.id, text);
  revalidatePath("/app/imports");
  revalidatePath("/app/jobs");
  revalidatePath("/app/revenue");
  revalidatePath("/app/operations");
  
}
