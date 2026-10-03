"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { runImportJob } from "@/lib/imports";
import { writeAudit } from "@/lib/audit";
import { runTemplateImport } from "@/lib/integrations/ingest";
import { getTemplate, parseDelimited } from "@/lib/integrations/templates";

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
  revalidatePath("/app/automations");
  revalidatePath("/app/revenue");
  revalidatePath("/app/operations");
  redirect(`/app/imports?ok=1&msg=${encodeURIComponent("Import completed")}`);
}

/** Guided import: template + file text (uploaded or pasted from Excel/Sheets) + reviewed column mapping. */
export async function submitGuidedImport(formData: FormData) {
  let target: string;
  try {
    const ctx = await requirePermission("import");
    assertOrgId(ctx.organizationId);
    const template = getTemplate(String(formData.get("template") || ""));
    if (!template) throw new Error("Choose what you are importing.");
    const text = String(formData.get("csv") || "");
    if (!text.trim()) throw new Error("Add a file or paste rows first.");
    const { rows } = parseDelimited(text);
    if (!rows.length) throw new Error("Found a header row but no data rows.");
    let mapping: Record<string, string> = {};
    try {
      mapping = JSON.parse(String(formData.get("mapping") || "{}"));
    } catch {
      mapping = {};
    }
    const r = await runTemplateImport({
      organizationId: ctx.organizationId,
      userId: ctx.user.id,
      templateSlug: template.slug,
      rows,
      mapping,
      source: "CSV_UPLOAD",
      fileName: String(formData.get("fileName") || "") || `Pasted rows · ${template.name}`,
    });
    target = `/app/imports?job=${r.jobId}&${r.errors.length && !r.created ? "error" : "ok"}=1&msg=${encodeURIComponent(`${template.name}: ${r.created} new · ${r.duplicates} already imported · ${r.skipped} skipped · ${r.errors.length} errors`)}`;
  } catch (e) {
    target = `/app/imports?error=1&msg=${encodeURIComponent((e instanceof Error ? e.message : String(e)).slice(0, 240))}`;
  }
  revalidatePath("/app/imports");
  revalidatePath("/app/integrations");
  revalidatePath("/app/revenue");
  revalidatePath("/app/operations");
  redirect(target);
}
