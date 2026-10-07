/**
 * SpotOn sales-export import — one path for the UI upload and the demo seed.
 * Tenant identity always comes from the caller (session or seed), never from the file.
 * Re-importing the same export is safe: rows are keyed by (organization, "spoton_export", day/check id) and
 * updated in place. Writes POS sales rows only; never recovered / realized amounts.
 */
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { mapSpotOnRows, parseSpotOnCsv, SPOTON_IMPORT_KIND, SPOTON_MAX_ROWS, SPOTON_TEMPLATE_SLUG, type SpotOnMapped } from "./export-format";

export type SpotOnImportResult = {
  jobId: string;
  received: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
  granularity: "day" | "check";
  mapping: Record<string, string>;
  missingRequired: string[];
};

async function upsertRow(organizationId: string, m: SpotOnMapped, now: Date): Promise<"created" | "updated" | "same"> {
  const detailJson = JSON.stringify(m.detail);
  const existing = await prisma.transaction.findFirst({ where: { organizationId, source: m.source, sourceId: m.sourceId }, select: { id: true, amount: true, detailJson: true, occurredAt: true, locationId: true, status: true } });
  if (!existing) {
    await prisma.transaction.create({ data: { organizationId, type: m.type, status: m.status, amount: m.amount, currency: m.currency, occurredAt: m.occurredAt, source: m.source, sourceId: m.sourceId, locationId: m.locationId, detailJson, importedAt: now, lastSyncAt: now } });
    return "created";
  }
  const changed = existing.status !== m.status || Math.abs(existing.amount - m.amount) > 0.0001 || existing.detailJson !== detailJson || existing.locationId !== m.locationId || existing.occurredAt.getTime() !== m.occurredAt.getTime();
  await prisma.transaction.update({ where: { id: existing.id }, data: changed ? { status: m.status, amount: m.amount, occurredAt: m.occurredAt, locationId: m.locationId, detailJson, lastSyncAt: now } : { lastSyncAt: now } });
  return changed ? "updated" : "same";
}

export async function runSpotOnImport(input: {
  organizationId: string;
  userId: string | null;
  text?: string;
  rows?: Array<Record<string, string>>;
  mapping?: Record<string, string> | null;
  fileName?: string | null;
  source?: "CSV_UPLOAD" | "DEMO_SEED";
}): Promise<SpotOnImportResult> {
  if (!input.organizationId) throw new Error("Organization context required");
  const rows = input.rows ?? (input.text ? parseSpotOnCsv(input.text).rows : []);
  if (!rows.length) throw new Error("Found no data rows. Export the SpotOn report as CSV and include the header row.");
  if (rows.length > SPOTON_MAX_ROWS) throw new Error(`Too many rows (${rows.length}). Import at most ${SPOTON_MAX_ROWS} at a time.`);
  const mapped = mapSpotOnRows(rows, input.mapping);
  const now = new Date();
  const job = await prisma.importJob.create({
    data: {
      organizationId: input.organizationId,
      kind: SPOTON_IMPORT_KIND,
      status: "RUNNING",
      fileName: (input.fileName || "SpotOn sales export").slice(0, 200),
      mappingJson: JSON.stringify(mapped.mapping),
      createdById: input.userId,
      source: "CSV_UPLOAD",
      template: SPOTON_TEMPLATE_SLUG,
      startedAt: now,
    },
  });
  let created = 0, updated = 0, unchanged = 0;
  const errors = [...mapped.errors];
  if (mapped.missingRequired.length) {
    errors.unshift({ row: 1, error: `Missing column(s): ${mapped.missingRequired.join(", ")}. Check the header row of your SpotOn export.` });
  } else {
    for (const m of mapped.rows) {
      try {
        const r = await upsertRow(input.organizationId, m, now);
        if (r === "created") created++; else if (r === "updated") updated++; else unchanged++;
      } catch (e) {
        errors.push({ row: 0, error: e instanceof Error ? e.message.slice(0, 160) : "error" });
      }
    }
  }
  const failed = created + updated + unchanged === 0;
  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: failed ? "FAILED" : "SUCCEEDED",
      finishedAt: new Date(),
      rowCount: mapped.received,
      successCount: created + updated,
      errorCount: errors.length,
      skippedCount: mapped.skipped.length + unchanged,
      errorJson: errors.length || mapped.skipped.length ? JSON.stringify({ errors: errors.slice(0, 100), skipped: mapped.skipped.slice(0, 50), unchanged }) : null,
    },
  });
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.userId,
    action: "import.spoton.completed",
    entityType: "ImportJob",
    entityId: job.id,
    metadata: { source: input.source ?? "CSV_UPLOAD", granularity: mapped.granularity, received: mapped.received, created, updated, unchanged, skipped: mapped.skipped.length, errors: errors.length },
  });
  return { jobId: job.id, received: mapped.received, created, updated, unchanged, skipped: mapped.skipped.length, errors, granularity: mapped.granularity, mapping: mapped.mapping, missingRequired: mapped.missingRequired };
}
