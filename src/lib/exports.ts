import { prisma } from "./prisma";

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportOpportunitiesCsv(organizationId: string) {
  const rows = await prisma.opportunity.findMany({
    where: { organizationId },
    orderBy: { identifiedAt: "desc" },
  });
  const header = [
    "id",
    "title",
    "status",
    "priority",
    "score",
    "potentialAmount",
    "approvedAmount",
    "inProgressAmount",
    "recoveredAmount",
    "verifiedAmount",
    "department",
    "type",
    "source",
    "identifiedAt",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.title,
        r.status,
        r.priority,
        r.score,
        r.potentialAmount,
        r.approvedAmount,
        r.inProgressAmount,
        r.recoveredAmount,
        r.verifiedAmount,
        r.department,
        r.type,
        r.source,
        r.identifiedAt.toISOString(),
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return lines.join("\n");
}

export async function exportFindingsCsv(organizationId: string) {
  const rows = await prisma.finding.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  const header = [
    "id",
    "product",
    "status",
    "ruleId",
    "confidence",
    "impactEstimate",
    "evidenceSummary",
    "analysis",
    "recommendation",
    "decision",
    "createdAt",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.product,
        r.status,
        r.ruleId,
        r.confidence,
        r.impactEstimate,
        r.evidenceSummary,
        r.analysis,
        r.recommendation,
        r.decision,
        r.createdAt.toISOString(),
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return lines.join("\n");
}
