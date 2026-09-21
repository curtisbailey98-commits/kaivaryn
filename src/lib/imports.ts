/**
 * CSV import with mapping / validation / errors / history.
 */
import { prisma } from "./prisma";
import { normalizeRevenueAmounts, normalizeOpsAmounts } from "./financial-impact";
import { scoreWorkItem } from "./scoring";

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export type ImportMapping = Record<string, string>; // canonical -> csv header

export async function runImportJob(jobId: string, csvText: string) {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });
  const mapping: ImportMapping = job.mappingJson ? JSON.parse(job.mappingJson) : {};
  const { rows } = parseCsv(csvText);
  const errors: { row: number; error: string }[] = [];
  let success = 0;

  try {
    const settings = await prisma.orgSettings.upsert({
      where: { organizationId: job.organizationId },
      update: {},
      create: { organizationId: job.organizationId },
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const get = (canon: string) => {
          const header = mapping[canon] || canon;
          return row[header] ?? "";
        };
        if (job.kind === "opportunities") {
          const title = get("title");
          if (!title) throw new Error("title required");
          const amount = Number(get("estimatedAmount") || get("potentialAmount") || 0) || 0;
          const money = normalizeRevenueAmounts({ potentialAmount: amount, estimatedAmount: amount });
          const scored = scoreWorkItem({ amount: money.potential, ageDays: 0, settings });
          await prisma.opportunity.create({
            data: {
              organizationId: job.organizationId,
              title,
              description: get("description") || null,
              source: get("source") || "csv_import",
              sourceId: get("sourceId") || `csv-row-${i + 2}`,
              department: get("department") || null,
              type: get("type") || null,
              status: "IDENTIFIED",
              priority: scored.priority,
              score: scored.score,
              scoreFactorsJson: JSON.stringify(scored.factors),
              potentialAmount: money.potential,
              estimatedAmount: money.potential,
              importedAt: new Date(),
            },
          });
        } else if (job.kind === "customers") {
          const name = get("name");
          if (!name) throw new Error("name required");
          await prisma.customer.create({
            data: {
              organizationId: job.organizationId,
              name,
              email: get("email") || null,
              status: get("status") || "ACTIVE",
              lastActivityAt: get("lastActivityAt") ? new Date(get("lastActivityAt")) : null,
              source: "csv_import",
              sourceId: get("sourceId") || `csv-row-${i + 2}`,
              importedAt: new Date(),
            },
          });
        } else if (job.kind === "processes") {
          const name = get("name");
          if (!name) throw new Error("name required");
          await prisma.process.create({
            data: {
              organizationId: job.organizationId,
              name,
              description: get("description") || null,
              avgCycleDays: get("avgCycleDays") ? Number(get("avgCycleDays")) : null,
              source: "csv_import",
              sourceId: get("sourceId") || `csv-row-${i + 2}`,
              importedAt: new Date(),
            },
          });
        } else if (job.kind === "inefficiencies") {
          const title = get("title");
          if (!title) throw new Error("title required");
          const waste = Number(get("estimatedWasteAnnual") || get("projectedSavings") || 0) || 0;
          const money = normalizeOpsAmounts({ estimatedWasteAnnual: waste, projectedSavings: waste });
          const scored = scoreWorkItem({ amount: money.projectedSavings, ageDays: 0, settings });
          await prisma.inefficiency.create({
            data: {
              organizationId: job.organizationId,
              title,
              description: get("description") || null,
              department: get("department") || null,
              type: get("type") || null,
              source: "csv_import",
              sourceId: get("sourceId") || `csv-row-${i + 2}`,
              status: "IDENTIFIED",
              priority: scored.priority,
              score: scored.score,
              scoreFactorsJson: JSON.stringify(scored.factors),
              estimatedWasteAnnual: money.projectedSavings,
              projectedSavings: money.projectedSavings,
              hoursWastedWeekly: get("hoursWastedWeekly") ? Number(get("hoursWastedWeekly")) : null,
              automationCandidate: ["1", "true", "yes"].includes((get("automationCandidate") || "").toLowerCase()),
              importedAt: new Date(),
            },
          });
        } else {
          throw new Error(`Unknown kind ${job.kind}`);
        }
        success++;
      } catch (e) {
        errors.push({ row: i + 2, error: e instanceof Error ? e.message : "error" });
      }
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: errors.length && !success ? "FAILED" : "SUCCEEDED",
        finishedAt: new Date(),
        rowCount: rows.length,
        successCount: success,
        errorCount: errors.length,
        errorJson: errors.length ? JSON.stringify(errors.slice(0, 200)) : null,
      },
    });
  } catch (e) {
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorJson: JSON.stringify([{ error: e instanceof Error ? e.message : "unknown" }]),
      },
    });
  }
}
