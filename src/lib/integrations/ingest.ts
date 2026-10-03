/**
 * Template ingest — one path for guided file import, Google Sheets sync, and the inbound API.
 * Tenant identity is always passed in by the caller (session or verified inbound token), never
 * read from the payload. Re-sending the same rows is safe: records with the same source + id
 * (or identical content) are skipped as duplicates.
 */
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { writeImportRecord } from "@/lib/imports";
import { autoMap, getTemplate, pickFields, type ImportKind } from "./templates";

export type IngestSource = "CSV_UPLOAD" | "GOOGLE_SHEETS" | "WEBHOOK";

export const MAX_INGEST_ROWS = 5000;

const SOURCE_PROVIDER: Record<IngestSource, string> = { CSV_UPLOAD: "csv_upload", GOOGLE_SHEETS: "google_sheets", WEBHOOK: "inbound_api" };

export type IngestResult = {
  jobId: string;
  template: string;
  kind: ImportKind;
  received: number;
  created: number;
  skipped: number;
  duplicates: number;
  errors: Array<{ row: number; error: string }>;
  skipReasons: Record<string, number>;
  mapping: Record<string, string>;
};

async function exists(kind: ImportKind, organizationId: string, source: string, sourceId: string) {
  const where = { organizationId, source, sourceId };
  switch (kind) {
    case "opportunities":
      return Boolean(await prisma.opportunity.findFirst({ where, select: { id: true } }));
    case "inefficiencies":
      return Boolean(await prisma.inefficiency.findFirst({ where, select: { id: true } }));
    case "customers":
      return Boolean(await prisma.customer.findFirst({ where, select: { id: true } }));
    case "processes":
      return Boolean(await prisma.process.findFirst({ where, select: { id: true } }));
  }
}

export async function runTemplateImport(input: {
  organizationId: string;
  userId: string | null;
  templateSlug: string;
  rows: Array<Record<string, string>>;
  mapping?: Record<string, string> | null;
  source: IngestSource;
  fileName?: string | null;
}): Promise<IngestResult> {
  const template = getTemplate(input.templateSlug);
  if (!template) throw new Error(`Unknown import template “${input.templateSlug}”`);
  if (!input.organizationId) throw new Error("Organization context required");
  if (input.rows.length > MAX_INGEST_ROWS) throw new Error(`Too many rows (${input.rows.length}). Send at most ${MAX_INGEST_ROWS} per import.`);

  const headers = Array.from(new Set(input.rows.flatMap((r) => Object.keys(r))));
  const auto = autoMap(template, headers);
  const mapping: Record<string, string> = { ...auto };
  for (const [k, v] of Object.entries(input.mapping ?? {})) {
    if (v && headers.includes(v) && template.fields.some((f) => f.key === k)) mapping[k] = v;
    if (v === "") delete mapping[k];
  }

  const job = await prisma.importJob.create({
    data: {
      organizationId: input.organizationId,
      kind: template.kind,
      status: "RUNNING",
      fileName: (input.fileName || `${template.name}`).slice(0, 200),
      mappingJson: JSON.stringify(mapping),
      createdById: input.userId,
      source: input.source,
      template: template.slug,
      startedAt: new Date(),
    },
  });

  const settings = await prisma.orgSettings.upsert({ where: { organizationId: input.organizationId }, update: {}, create: { organizationId: input.organizationId } });
  let picked = input.rows.map((r) => pickFields(template, r, mapping));
  if (template.aggregate) picked = template.aggregate(picked);

  let created = 0;
  let skipped = 0;
  let duplicates = 0;
  const errors: IngestResult["errors"] = [];
  const skipReasons: Record<string, number> = {};
  const defaultSource = `import_${template.slug}`;

  for (let i = 0; i < picked.length; i++) {
    const row = i + 2;
    try {
      const res = template.transform(picked[i]!, row);
      if ("skip" in res) {
        skipped++;
        skipReasons[res.skip] = (skipReasons[res.skip] ?? 0) + 1;
        continue;
      }
      if ("error" in res) {
        errors.push({ row, error: res.error });
        continue;
      }
      const rec = { ...res.record };
      const source = rec.source || defaultSource;
      rec.source = source;
      rec.sourceId = (rec.sourceId || `h:${createHash("sha1").update(JSON.stringify(rec)).digest("hex").slice(0, 16)}`).slice(0, 190);
      if (await exists(template.kind, input.organizationId, source, rec.sourceId)) {
        duplicates++;
        continue;
      }
      await writeImportRecord({ organizationId: input.organizationId, kind: template.kind, get: (k) => rec[k] ?? "", rowNumber: row, settings, defaultSource: source });
      created++;
    } catch (e) {
      errors.push({ row, error: e instanceof Error ? e.message.slice(0, 200) : "error" });
    }
  }

  const failed = created === 0 && errors.length > 0;
  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: failed ? "FAILED" : "SUCCEEDED",
      finishedAt: new Date(),
      rowCount: input.rows.length,
      successCount: created,
      errorCount: errors.length,
      skippedCount: skipped + duplicates,
      errorJson: errors.length || skipped || duplicates ? JSON.stringify({ errors: errors.slice(0, 100), skipped: skipReasons, duplicates }) : null,
    },
  });
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.userId,
    action: "import.completed",
    entityType: "ImportJob",
    entityId: job.id,
    metadata: { source: input.source, template: template.slug, received: input.rows.length, created, skipped, duplicates, errors: errors.length },
  });
  if (!failed && (created > 0 || duplicates > 0 || skipped > 0)) {
    const provider = SOURCE_PROVIDER[input.source];
    await prisma.integrationConnection
      .updateMany({ where: { organizationId: input.organizationId, provider }, data: { status: "CONNECTED", lastSyncAt: new Date(), errorMessage: null } })
      .catch(() => undefined);
  }
  return { jobId: job.id, template: template.slug, kind: template.kind, received: input.rows.length, created, skipped, duplicates, errors, skipReasons, mapping };
}
