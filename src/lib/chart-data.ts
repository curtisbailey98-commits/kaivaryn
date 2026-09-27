/**
 * Tenant-scoped chart aggregates from live DB rows.
 * Projected ≠ recovered/realized. Never invents KPIs.
 */
import { prisma } from "./prisma";
import { agingBucketLabel, ageDays, slaBucket } from "./sla";
import { classifyLeakageType, LEAKAGE_TYPES, automationReadinessScore } from "./leakage-taxonomy";

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday start
  x.setDate(x.getDate() - diff);
  return x;
}

function weekLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

function lastNWeeks(n: number, now = new Date()): { start: Date; label: string }[] {
  const thisWeek = startOfWeek(now);
  const out: { start: Date; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - i * 7);
    out.push({ start, label: weekLabel(start) });
  }
  return out;
}

function inWeek(date: Date | null | undefined, weekStart: Date): boolean {
  if (!date) return false;
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return date >= weekStart && date < end;
}

export async function getRevenueChartData(organizationId: string) {
  const opps = await prisma.opportunity.findMany({
    where: { organizationId, status: { notIn: ["DISMISSED"] } },
    select: {
      status: true,
      type: true,
      potentialAmount: true,
      estimatedAmount: true,
      recoveredAmount: true,
      verifiedAmount: true,
      identifiedAt: true,
      recoveredAt: true,
      verifiedAt: true,
      createdAt: true,
    },
  });

  const weeks = lastNWeeks(8);
  const trend = weeks.map((w) => {
    const identified = opps
      .filter((o) => inWeek(o.identifiedAt || o.createdAt, w.start))
      .reduce((n, o) => n + (o.potentialAmount || o.estimatedAmount || 0), 0);
    const recovered = opps
      .filter((o) => inWeek(o.recoveredAt || o.verifiedAt, w.start))
      .reduce((n, o) => n + (o.recoveredAmount || o.verifiedAmount || 0), 0);
    return { label: w.label, projected: Math.round(identified), recovered: Math.round(recovered) };
  });

  const funnelDefs = [
    { key: "identified", label: "Identified", statuses: ["IDENTIFIED", "NEW"] },
    { key: "review", label: "Under review", statuses: ["UNDER_REVIEW"] },
    { key: "recovery", label: "In recovery", statuses: ["APPROVED", "IN_RECOVERY", "IN_PROGRESS", "PARTIALLY_RECOVERED"] },
    { key: "recovered", label: "Recovered", statuses: ["RECOVERED", "VERIFIED"] },
  ];
  const funnel = funnelDefs.map((s) => {
    const rows = opps.filter((o) => s.statuses.includes(o.status));
    return {
      key: s.key,
      label: s.label,
      count: rows.length,
      value: rows.reduce((n, o) => n + (o.potentialAmount || o.estimatedAmount || 0), 0),
      href: `/app/revenue?view=${s.key === "review" ? "under_review" : s.key === "recovery" ? "in_recovery" : s.key}`,
    };
  });

  const taxonomy = LEAKAGE_TYPES.map((t) => {
    const rows = opps.filter((o) => classifyLeakageType(o.type).id === t.id);
    return {
      name: t.label,
      value: Math.round(rows.reduce((n, r) => n + (r.potentialAmount || r.estimatedAmount || 0), 0)),
    };
  }).filter((t) => t.value > 0);

  return { trend, funnel, taxonomy, sourceNote: "From Opportunity rows · projected ≠ recovered" };
}

export async function getOperationsChartData(organizationId: string) {
  const items = await prisma.inefficiency.findMany({
    where: { organizationId, status: { notIn: ["DISMISSED"] } },
    select: {
      status: true,
      department: true,
      projectedSavings: true,
      estimatedWasteAnnual: true,
      realizedSavings: true,
      recoveredAnnual: true,
      identifiedAt: true,
      resolvedAt: true,
      verifiedAt: true,
      createdAt: true,
      automationCandidate: true,
      score: true,
      priority: true,
      _count: { select: { evidence: true } },
    },
  });

  const weeks = lastNWeeks(8);
  const trend = weeks.map((w) => {
    const projected = items
      .filter((i) => inWeek(i.identifiedAt || i.createdAt, w.start))
      .reduce((n, i) => n + (i.projectedSavings || i.estimatedWasteAnnual || 0), 0);
    const realized = items
      .filter((i) => inWeek(i.resolvedAt || i.verifiedAt, w.start))
      .reduce((n, i) => n + (i.realizedSavings || i.recoveredAnnual || 0), 0);
    return { label: w.label, projected: Math.round(projected), realized: Math.round(realized) };
  });

  const deptMap = new Map<string, { waste: number; count: number }>();
  for (const i of items) {
    const d = i.department || "Unspecified";
    const cur = deptMap.get(d) || { waste: 0, count: 0 };
    cur.waste += i.estimatedWasteAnnual || 0;
    cur.count += 1;
    deptMap.set(d, cur);
  }
  const heat = Array.from(deptMap.entries())
    .map(([label, v]) => ({ label, waste: Math.round(v.waste), count: v.count }))
    .sort((a, b) => b.waste - a.waste)
    .slice(0, 8);

  const readiness = items.length
    ? Math.round(
        items.reduce(
          (n, i) =>
            n +
            automationReadinessScore({
              automationCandidate: i.automationCandidate,
              score: i.score,
              evidenceCount: i._count.evidence,
              projectedSavings: i.projectedSavings || i.estimatedWasteAnnual,
              priority: i.priority,
            }),
          0
        ) / items.length
      )
    : 0;

  return { trend, heat, readiness, sourceNote: "From Inefficiency rows · projected ≠ realized" };
}

export async function getActionCenterChartData(organizationId: string) {
  const now = new Date();
  const [opps, ineff, approvals] = await Promise.all([
    prisma.opportunity.findMany({
      where: { organizationId, status: { notIn: ["DISMISSED", "VERIFIED", "RECOVERED"] } },
      select: { identifiedAt: true, createdAt: true, priority: true },
    }),
    prisma.inefficiency.findMany({
      where: { organizationId, status: { notIn: ["DISMISSED", "VERIFIED", "RESOLVED", "REALIZED"] } },
      select: { identifiedAt: true, createdAt: true, priority: true },
    }),
    prisma.approvalRequest.findMany({
      where: { organizationId, status: "PENDING" },
      select: { createdAt: true },
    }),
  ]);

  const open = [
    ...opps.map((o) => ({ age: ageDays(o.identifiedAt || o.createdAt, now), kind: "work" as const })),
    ...ineff.map((i) => ({ age: ageDays(i.identifiedAt || i.createdAt, now), kind: "work" as const })),
    ...approvals.map((a) => ({ age: ageDays(a.createdAt, now), kind: "approval" as const })),
  ];

  const bucketOrder = ["0–3d", "4–7d", "8–14d", "15–30d", "30d+"] as const;
  const aging = bucketOrder.map((label) => ({
    label,
    count: open.filter((i) => agingBucketLabel(i.age) === label).length,
  }));

  const weeks = lastNWeeks(8);
  // Honest SLA-risk sparkline: count of currently-open items whose age *as of week end*
  // would have been in aging/breach — approximated by items identified before that week
  // that remain open and would already exceed SLA at that week's end.
  const slaSpark = weeks.map((w) => {
    const weekEnd = new Date(w.start);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const breachish = open.filter((item) => {
      // Reconstruct approximate open-since from age at now
      const openedAt = new Date(now.getTime() - item.age * 86400000);
      if (openedAt > weekEnd) return false;
      const ageThen = ageDays(openedAt, weekEnd);
      const bucket = slaBucket(ageThen, item.kind);
      return bucket === "aging" || bucket === "breach";
    }).length;
    return { label: w.label, value: breachish };
  });

  return { aging, slaSpark, openCount: open.length, sourceNote: "Open work + pending approvals · live ages" };
}

export async function getWeeklyBriefChartData(organizationId: string) {
  const [rr, ops] = await Promise.all([
    getRevenueChartData(organizationId),
    getOperationsChartData(organizationId),
  ]);
  const weeks = rr.trend.map((r, i) => ({
    label: r.label,
    recovered: r.recovered,
    realized: ops.trend[i]?.realized ?? 0,
    projectedRr: r.projected,
    projectedOe: ops.trend[i]?.projected ?? 0,
  }));
  return { weeks, sourceNote: "Weekly identified vs recovered/realized from tenant timestamps" };
}

/** Public illustrative series — labeled Example framework, not customer data. */
export const EXAMPLE_FRAMEWORK_SERIES = [
  { label: "Signal", projected: 40, verified: 8 },
  { label: "Rank", projected: 55, verified: 18 },
  { label: "Govern", projected: 48, verified: 28 },
  { label: "Execute", projected: 62, verified: 41 },
  { label: "Measure", projected: 70, verified: 58 },
  { label: "Learn", projected: 66, verified: 63 },
];

export async function getApprovalsChartData(organizationId: string) {
  const rows = await prisma.approvalRequest.findMany({
    where: { organizationId },
    select: { status: true, type: true, createdAt: true, decidedAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const now = new Date();
  const pending = rows.filter((r) => r.status === "PENDING");
  const bucketOrder = ["0–3d", "4–7d", "8–14d", "15–30d", "30d+"] as const;
  const aging = bucketOrder.map((label) => ({
    label,
    count: pending.filter((a) => agingBucketLabel(ageDays(a.createdAt, now)) === label).length,
  }));
  const byStatus = ["PENDING", "APPROVED", "REJECTED"].map((status) => ({
    label: status,
    count: rows.filter((r) => r.status === status).length,
  }));
  const weeks = lastNWeeks(8);
  const volume = weeks.map((w) => ({
    label: w.label,
    created: rows.filter((r) => inWeek(r.createdAt, w.start)).length,
    decided: rows.filter((r) => inWeek(r.decidedAt, w.start)).length,
  }));
  const typeMap = new Map<string, number>();
  for (const r of pending) {
    typeMap.set(r.type || "Other", (typeMap.get(r.type || "Other") || 0) + 1);
  }
  const byType = Array.from(typeMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  return {
    aging,
    byStatus,
    volume,
    byType,
    pendingCount: pending.length,
    sourceNote: "From ApprovalRequest rows · decisions recorded only",
  };
}

export async function getSettingsUsageChartData(organizationId: string) {
  const weeks = lastNWeeks(8);
  const since = weeks[0]?.start || new Date(0);
  const [imports, runs, audits, notifications] = await Promise.all([
    prisma.importJob.findMany({
      where: { organizationId, createdAt: { gte: since } },
      select: { createdAt: true, successCount: true, rowCount: true },
    }),
    prisma.intelligenceRun.findMany({
      where: { organizationId, createdAt: { gte: since } },
      select: { createdAt: true, findingCount: true },
    }),
    prisma.auditLog.findMany({
      where: { organizationId, createdAt: { gte: since } },
      select: { createdAt: true },
      take: 2000,
    }),
    prisma.notification.findMany({
      where: { organizationId, createdAt: { gte: since } },
      select: { createdAt: true },
      take: 2000,
    }),
  ]);
  const usage = weeks.map((w) => ({
    label: w.label,
    imports: imports.filter((i) => inWeek(i.createdAt, w.start)).length,
    runs: runs.filter((r) => inWeek(r.createdAt, w.start)).length,
    audits: audits.filter((a) => inWeek(a.createdAt, w.start)).length,
    notifications: notifications.filter((n) => inWeek(n.createdAt, w.start)).length,
  }));
  const importSpark = usage.map((u) => ({ label: u.label, value: u.imports }));
  const runSpark = usage.map((u) => ({ label: u.label, value: u.runs }));
  const auditSpark = usage.map((u) => ({ label: u.label, value: u.audits }));
  return {
    usage,
    importSpark,
    runSpark,
    auditSpark,
    totals: {
      imports: imports.length,
      runs: runs.length,
      audits: audits.length,
      notifications: notifications.length,
    },
    sourceNote: "Workspace activity from ImportJob / IntelligenceRun / AuditLog / Notification",
  };
}

export async function getNotificationsChartData(organizationId: string, userId: string) {
  const notes = await prisma.notification.findMany({
    where: { organizationId, userId },
    select: { createdAt: true, readAt: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const weeks = lastNWeeks(8);
  const volume = weeks.map((w) => ({
    label: w.label,
    created: notes.filter((n) => inWeek(n.createdAt, w.start)).length,
    read: notes.filter((n) => inWeek(n.readAt, w.start)).length,
  }));
  const unread = notes.filter((n) => !n.readAt).length;
  const spark = volume.map((v) => ({ label: v.label, value: v.created }));
  return { volume, spark, unread, total: notes.length, sourceNote: "Your in-app notifications · live counts" };
}

export async function getAdminDemoFunnelData() {
  const demos = await prisma.demoRequest.findMany({ select: { status: true, createdAt: true } });
  const pipeline = [
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "SCHEDULED",
    "DEMO_COMPLETED",
    "PAYMENT_PENDING",
    "CLOSED_WON",
    "CLOSED_LOST",
  ] as const;
  const stages = pipeline.map((status) => ({
    key: status,
    label: status.replace(/_/g, " "),
    count: demos.filter((d) => d.status === status).length,
  }));
  const weeks = lastNWeeks(8);
  const inflow = weeks.map((w) => ({
    label: w.label,
    leads: demos.filter((d) => inWeek(d.createdAt, w.start)).length,
  }));
  return {
    stages,
    inflow,
    total: demos.length,
    sourceNote: "Cross-tenant DemoRequest pipeline · SUPER_ADMIN console",
  };
}

/** Multi-dimension readiness from OE automation signals (0–100 each). */
export async function getReadinessRadarData(organizationId: string) {
  const items = await prisma.inefficiency.findMany({
    where: { organizationId, status: { notIn: ["DISMISSED"] } },
    select: {
      automationCandidate: true,
      score: true,
      projectedSavings: true,
      estimatedWasteAnnual: true,
      priority: true,
      _count: { select: { evidence: true } },
    },
  });
  if (!items.length) {
    return {
      points: [
        { subject: "Candidate", value: 0, fullMark: 100 },
        { subject: "Score", value: 0, fullMark: 100 },
        { subject: "Evidence", value: 0, fullMark: 100 },
        { subject: "Impact", value: 0, fullMark: 100 },
        { subject: "Priority", value: 0, fullMark: 100 },
      ],
      sourceNote: "No inefficiencies yet",
    };
  }
  const n = items.length;
  const candidate = Math.round((items.filter((i) => i.automationCandidate).length / n) * 100);
  const score = Math.round(items.reduce((s, i) => s + Math.min(100, i.score), 0) / n);
  const evidence = Math.round(
    items.reduce((s, i) => s + Math.min(100, (i._count.evidence || 0) * 20), 0) / n
  );
  const impact = Math.round(
    items.reduce((s, i) => {
      const v = i.projectedSavings || i.estimatedWasteAnnual || 0;
      if (v >= 50000) return s + 100;
      if (v >= 10000) return s + 60;
      if (v >= 1000) return s + 30;
      return s;
    }, 0) / n
  );
  const priority = Math.round(
    items.reduce((s, i) => {
      if (i.priority === "CRITICAL") return s + 100;
      if (i.priority === "HIGH") return s + 70;
      if (i.priority === "MEDIUM") return s + 40;
      return s + 15;
    }, 0) / n
  );
  return {
    points: [
      { subject: "Candidate", value: candidate, fullMark: 100 },
      { subject: "Score", value: score, fullMark: 100 },
      { subject: "Evidence", value: evidence, fullMark: 100 },
      { subject: "Impact", value: impact, fullMark: 100 },
      { subject: "Priority", value: priority, fullMark: 100 },
    ],
    sourceNote: "OE automation dimensions · averages across open inefficiencies",
  };
}

/** Build waterfall stages from revenue funnel potential (identified → recovered path). */
export function revenueFunnelToWaterfall(
  funnel: { key: string; label: string; value: number; count: number }[]
) {
  if (!funnel.length) return [];
  // Mutually exclusive status buckets → additive portfolio composition (not a fake drop-off path).
  const stages = funnel.map((f) => ({
    label: f.label,
    value: Math.round(f.value || 0),
  }));
  return [...stages, { label: "Portfolio", value: 0, isTotal: true }];
}

/** Cumulative recovered by week for step chart (real recovered amounts). */
export function trendToCumulativeRecovered(
  trend: { label: string; recovered?: number; realized?: number }[]
) {
  let cum = 0;
  return trend.map((t) => {
    cum += t.recovered ?? t.realized ?? 0;
    return { label: t.label, cumulative: cum, weekly: t.recovered ?? t.realized ?? 0 };
  });
}

/** Public illustrative series — labeled Example only. */
export const EXAMPLE_PRICING_SERIES = [
  { label: "Signal", seats: 2, value: 12 },
  { label: "Qualify", seats: 4, value: 22 },
  { label: "Demo", seats: 6, value: 35 },
  { label: "Activate", seats: 8, value: 48 },
  { label: "Operate", seats: 10, value: 55 },
];

export const EXAMPLE_HOW_IT_WORKS_STEPS = [
  { label: "Connect", maturity: 20 },
  { label: "Analyze", maturity: 35 },
  { label: "Identify", maturity: 48 },
  { label: "Prioritize", maturity: 62 },
  { label: "Execute", maturity: 74 },
  { label: "Measure", maturity: 88 },
];

export const EXAMPLE_RECOVERY_WATERFALL = [
  { label: "Signal pool", value: 100 },
  { label: "Filtered", value: -25 },
  { label: "Prioritized", value: -15 },
  { label: "In recovery", value: -20 },
  { label: "Verified", value: 40, isTotal: true },
];
