/**
 * Executive reports from real DB aggregates — CSV + printable HTML.
 * No fabricated numbers.
 */
import { prisma } from "./prisma";

export type ReportType = "rr_summary" | "ops_summary" | "weekly_brief" | "monthly_impact";

export const REPORT_LABELS: Record<ReportType, string> = {
  rr_summary: "Revenue Recovery Summary",
  ops_summary: "Ops Summary",
  weekly_brief: "Weekly Brief",
  monthly_impact: "Monthly Impact",
};

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function money(n: number | null | undefined) {
  return Math.round((n ?? 0) * 100) / 100;
}

export async function buildReport(organizationId: string, type: ReportType) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  const orgName = org?.name || organizationId;
  const generatedAt = new Date().toISOString();

  if (type === "rr_summary") {
    const [agg, byStatus, top] = await Promise.all([
      prisma.opportunity.aggregate({
        where: { organizationId },
        _sum: {
          potentialAmount: true,
          approvedAmount: true,
          inProgressAmount: true,
          recoveredAmount: true,
          verifiedAmount: true,
        },
        _count: true,
      }),
      prisma.opportunity.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: true,
        _sum: { potentialAmount: true, recoveredAmount: true },
      }),
      prisma.opportunity.findMany({
        where: { organizationId },
        orderBy: { potentialAmount: "desc" },
        take: 15,
        select: {
          title: true,
          status: true,
          priority: true,
          potentialAmount: true,
          recoveredAmount: true,
          verifiedAmount: true,
          department: true,
        },
      }),
    ]);
    const metrics = {
      opportunityCount: agg._count,
      potential: money(agg._sum.potentialAmount),
      approved: money(agg._sum.approvedAmount),
      inProgress: money(agg._sum.inProgressAmount),
      recovered: money(agg._sum.recoveredAmount),
      verified: money(agg._sum.verifiedAmount),
    };
    return {
      type,
      title: REPORT_LABELS[type],
      orgName,
      generatedAt,
      metrics,
      note: "Estimates (potential/approved/in-progress) ≠ recovered/verified.",
      sections: [
        {
          name: "By status",
          rows: byStatus.map((g) => ({
            status: g.status,
            count: g._count,
            potential: money(g._sum.potentialAmount),
            recovered: money(g._sum.recoveredAmount),
          })),
        },
        {
          name: "Top opportunities",
          rows: top.map((r) => ({
            title: r.title,
            status: r.status,
            priority: r.priority,
            department: r.department,
            potential: r.potentialAmount,
            recovered: r.recoveredAmount,
            verified: r.verifiedAmount,
          })),
        },
      ],
    };
  }

  if (type === "ops_summary") {
    const [agg, byStatus, top] = await Promise.all([
      prisma.inefficiency.aggregate({
        where: { organizationId },
        _sum: {
          projectedSavings: true,
          realizedSavings: true,
          projectedHoursWeekly: true,
          realizedHoursWeekly: true,
        },
        _count: true,
      }),
      prisma.inefficiency.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: true,
        _sum: { projectedSavings: true, realizedSavings: true },
      }),
      prisma.inefficiency.findMany({
        where: { organizationId },
        orderBy: { projectedSavings: "desc" },
        take: 15,
        select: {
          title: true,
          status: true,
          priority: true,
          projectedSavings: true,
          realizedSavings: true,
          department: true,
          automationCandidate: true,
        },
      }),
    ]);
    return {
      type,
      title: REPORT_LABELS[type],
      orgName,
      generatedAt,
      metrics: {
        inefficiencyCount: agg._count,
        projectedSavings: money(agg._sum.projectedSavings),
        realizedSavings: money(agg._sum.realizedSavings),
        projectedHoursWeekly: money(agg._sum.projectedHoursWeekly),
        realizedHoursWeekly: money(agg._sum.realizedHoursWeekly),
      },
      note: "Projected ≠ realized. Automation candidates are approval-gated.",
      sections: [
        {
          name: "By status",
          rows: byStatus.map((g) => ({
            status: g.status,
            count: g._count,
            projected: money(g._sum.projectedSavings),
            realized: money(g._sum.realizedSavings),
          })),
        },
        {
          name: "Top inefficiencies",
          rows: top.map((r) => ({
            title: r.title,
            status: r.status,
            priority: r.priority,
            department: r.department,
            projected: r.projectedSavings,
            realized: r.realizedSavings,
            automation: r.automationCandidate ? "yes" : "no",
          })),
        },
      ],
    };
  }

  if (type === "weekly_brief") {
    const since = new Date(Date.now() - 7 * 86400000);
    const [recov, savings, approvals, statusChanges, newFindings] = await Promise.all([
      prisma.opportunity.findMany({
        where: { organizationId, recoveredAt: { gte: since } },
        select: { title: true, recoveredAmount: true, verifiedAmount: true, status: true },
      }),
      prisma.inefficiency.findMany({
        where: { organizationId, resolvedAt: { gte: since } },
        select: { title: true, realizedSavings: true, status: true },
      }),
      prisma.approvalRequest.findMany({
        where: { organizationId, createdAt: { gte: since } },
        select: { title: true, status: true, type: true, needsIntegration: true },
      }),
      prisma.statusHistory.count({ where: { organizationId, createdAt: { gte: since } } }),
      prisma.finding.count({ where: { organizationId, createdAt: { gte: since } } }),
    ]);
    const recoveredSum = money(recov.reduce((s, r) => s + r.recoveredAmount, 0));
    const savingsSum = money(savings.reduce((s, r) => s + r.realizedSavings, 0));
    return {
      type,
      title: REPORT_LABELS[type],
      orgName,
      generatedAt,
      metrics: {
        windowDays: 7,
        recovered: recoveredSum,
        recoveryEvents: recov.length,
        realizedSavings: savingsSum,
        savingsEvents: savings.length,
        approvalsCreated: approvals.length,
        statusChanges,
        newFindings,
      },
      note: "Window: last 7 days from report generation.",
      sections: [
        { name: "Recoveries", rows: recov.map((r) => ({ title: r.title, recovered: r.recoveredAmount, verified: r.verifiedAmount, status: r.status })) },
        { name: "Savings realized", rows: savings.map((r) => ({ title: r.title, realized: r.realizedSavings, status: r.status })) },
        {
          name: "Approvals",
          rows: approvals.map((a) => ({
            title: a.title,
            status: a.status,
            type: a.type,
            needsIntegration: a.needsIntegration,
          })),
        },
      ],
    };
  }

  // monthly_impact
  const since = new Date(Date.now() - 30 * 86400000);
  const [rrAgg, oeAgg, pending] = await Promise.all([
    prisma.opportunity.aggregate({
      where: { organizationId, recoveredAt: { gte: since } },
      _sum: { recoveredAmount: true, verifiedAmount: true },
      _count: true,
    }),
    prisma.inefficiency.aggregate({
      where: { organizationId, resolvedAt: { gte: since } },
      _sum: { realizedSavings: true },
      _count: true,
    }),
    prisma.approvalRequest.count({ where: { organizationId, status: "PENDING" } }),
  ]);
  const openPipe = await prisma.opportunity.aggregate({
    where: { organizationId, status: { notIn: ["DISMISSED", "VERIFIED", "RECOVERED"] } },
    _sum: { potentialAmount: true },
    _count: true,
  });
  return {
    type,
    title: REPORT_LABELS[type],
    orgName,
    generatedAt,
    metrics: {
      windowDays: 30,
      recovered: money(rrAgg._sum.recoveredAmount),
      verified: money(rrAgg._sum.verifiedAmount),
      recoveryEvents: rrAgg._count,
      realizedSavings: money(oeAgg._sum.realizedSavings),
      savingsEvents: oeAgg._count,
      openPipelinePotential: money(openPipe._sum.potentialAmount),
      openPipelineCount: openPipe._count,
      pendingApprovals: pending,
    },
    note: "Impact window: last 30 days. Open pipeline is current snapshot.",
    sections: [
      {
        name: "Impact snapshot",
        rows: [
          { metric: "Recovered (30d)", value: money(rrAgg._sum.recoveredAmount) },
          { metric: "Verified (30d)", value: money(rrAgg._sum.verifiedAmount) },
          { metric: "Realized savings (30d)", value: money(oeAgg._sum.realizedSavings) },
          { metric: "Open pipeline potential", value: money(openPipe._sum.potentialAmount) },
          { metric: "Pending approvals", value: pending },
        ],
      },
    ],
  };
}

export type BuiltReport = Awaited<ReturnType<typeof buildReport>>;

export function reportToCsv(report: BuiltReport): string {
  const lines: string[] = [];
  lines.push(["report", "org", "generatedAt"].map(csvEscape).join(","));
  lines.push([report.title, report.orgName, report.generatedAt].map(csvEscape).join(","));
  lines.push("");
  lines.push("metric,value");
  for (const [k, v] of Object.entries(report.metrics)) {
    lines.push([k, v].map(csvEscape).join(","));
  }
  for (const section of report.sections) {
    lines.push("");
    lines.push(`section,${csvEscape(section.name)}`);
    if (!section.rows.length) continue;
    const keys = Object.keys(section.rows[0]);
    lines.push(keys.map(csvEscape).join(","));
    for (const row of section.rows) {
      lines.push(keys.map((k) => csvEscape((row as Record<string, unknown>)[k])).join(","));
    }
  }
  if (report.note) {
    lines.push("");
    lines.push(`note,${csvEscape(report.note)}`);
  }
  return lines.join("\n");
}

export function reportToHtml(report: BuiltReport): string {
  const metricRows = Object.entries(report.metrics)
    .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join("");
  const sections = report.sections
    .map((s) => {
      if (!s.rows.length) return `<h2>${escapeHtml(s.name)}</h2><p>None</p>`;
      const keys = Object.keys(s.rows[0]);
      const head = keys.map((k) => `<th>${escapeHtml(k)}</th>`).join("");
      const body = s.rows
        .map(
          (r) =>
            `<tr>${keys.map((k) => `<td>${escapeHtml((r as Record<string, unknown>)[k])}</td>`).join("")}</tr>`
        )
        .join("");
      return `<h2>${escapeHtml(s.name)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(report.title)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;color:#111;background:#fff}
h1{font-size:1.4rem} h2{font-size:1.1rem;margin-top:1.5rem}
table{border-collapse:collapse;width:100%;font-size:0.85rem}
th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
th{background:#f5f5f5}
.meta{color:#555;font-size:0.85rem}
.note{margin-top:1rem;padding:0.75rem;background:#fff8e6;border:1px solid #f0e0a0;font-size:0.85rem}
@media print{body{margin:0}}
</style></head><body>
<h1>${escapeHtml(report.title)}</h1>
<p class="meta">${escapeHtml(report.orgName)} · Generated ${escapeHtml(report.generatedAt)}</p>
<table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${metricRows}</tbody></table>
${sections}
${report.note ? `<p class="note">${escapeHtml(report.note)}</p>` : ""}
<script>/* printable HTML — use browser Print → PDF */</script>
</body></html>`;
}

function escapeHtml(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
