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
