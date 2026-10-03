/**
 * Deterministic NL executive query interpreter — tenant-scoped DB aggregates only.
 * No LLM required. Never bypasses organizationId.
 */
import { prisma } from "./prisma";

export type NlAnswer = {
  intent: string;
  interpretedAs: string;
  summary: string;
  metrics: Record<string, number | string>;
  rows?: Array<Record<string, string | number | null>>;
  links?: Array<{ label: string; href: string }>;
};

function money(n: number) {
  return Math.round(n * 100) / 100;
}

type AggOpp = {
  _sum: {
    potentialAmount: number | null;
    recoveredAmount: number | null;
    verifiedAmount: number | null;
    estimatedAmount: number | null;
  };
  _count: number;
};

async function rrAgg(organizationId: string, where: Record<string, unknown> = {}) {
  const [agg, count] = await Promise.all([
    prisma.opportunity.aggregate({
      where: { organizationId, ...where },
      _sum: {
        potentialAmount: true,
        recoveredAmount: true,
        verifiedAmount: true,
        estimatedAmount: true,
      },
    }),
    prisma.opportunity.count({ where: { organizationId, ...where } }),
  ]);
  return { ...agg, _count: count } as AggOpp;
}

async function oeAgg(organizationId: string, where: Record<string, unknown> = {}) {
  const [agg, count] = await Promise.all([
    prisma.inefficiency.aggregate({
      where: { organizationId, ...where },
      _sum: {
        projectedSavings: true,
        realizedSavings: true,
        estimatedWasteAnnual: true,
        recoveredAnnual: true,
        projectedHoursWeekly: true,
        realizedHoursWeekly: true,
      },
    }),
    prisma.inefficiency.count({ where: { organizationId, ...where } }),
  ]);
  return { ...agg, _count: count };
}

/** Parse natural-language executive questions into structured DB queries. */
export async function interpretExecutiveQuery(
  organizationId: string,
  raw: string
): Promise<NlAnswer> {
  const q = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) {
    return {
      intent: "empty",
      interpretedAs: "Empty query",
      summary: "Ask a question about recovery, savings, pipeline, or approvals.",
      metrics: {},
    };
  }

  // Example: How much revenue have we recovered?
  if (
    /how much.*(recover|recovered|recovery)/.test(q) ||
    /total recovered/.test(q) ||
    /revenue recovered/.test(q)
  ) {
    const a = await rrAgg(organizationId);
    const recovered = money(a._sum.recoveredAmount ?? 0);
    const verified = money(a._sum.verifiedAmount ?? 0);
    const potential = money(a._sum.potentialAmount ?? a._sum.estimatedAmount ?? 0);
    return {
      intent: "rr_recovered_total",
      interpretedAs: "Sum of recoveredAmount / verifiedAmount across opportunities",
      summary: `Recovered ${recovered.toLocaleString("en-US", { style: "currency", currency: "USD" })} (${verified.toLocaleString("en-US", { style: "currency", currency: "USD" })} verified). Pipeline potential ${potential.toLocaleString("en-US", { style: "currency", currency: "USD" })} across ${a._count} opportunities. Estimates ≠ recovered.`,
      metrics: { recovered, verified, potential, opportunityCount: a._count },
      links: [
        { label: "Revenue Recovery", href: "/app/revenue" },
        { label: "RR Summary report", href: "/app/reports?type=rr_summary" },
      ],
    };
  }

  // How much is still at risk / open pipeline?
  if (
    /at risk|open pipeline|still open|outstanding|unrecovered|potential left|leftover/.test(q) ||
    /how much.*(potential|pipeline|identified)/.test(q)
  ) {
    const open = await rrAgg(organizationId, {
      status: { notIn: ["DISMISSED", "VERIFIED", "RECOVERED"] },
    });
    const potential = money(open._sum.potentialAmount ?? open._sum.estimatedAmount ?? 0);
    const recovered = money(open._sum.recoveredAmount ?? 0);
    return {
      intent: "rr_open_pipeline",
      interpretedAs: "Open opportunities (not dismissed/verified/recovered): sum potential",
      summary: `Open pipeline potential ${potential.toLocaleString("en-US", { style: "currency", currency: "USD" })} across ${open._count} items (${recovered.toLocaleString("en-US", { style: "currency", currency: "USD" })} already partially recovered on those).`,
      metrics: { openPotential: potential, openRecovered: recovered, openCount: open._count },
      links: [{ label: "Action Center", href: "/app/action-center" }],
    };
  }

  // Top / highest value opportunities
  if (/top|highest|biggest|largest/.test(q) && /(opportunit|recovery|revenue|claim)/.test(q)) {
    const rows = await prisma.opportunity.findMany({
      where: { organizationId, status: { notIn: ["DISMISSED"] } },
      orderBy: [{ potentialAmount: "desc" }, { score: "desc" }],
      take: 5,
      select: { id: true, title: true, status: true, potentialAmount: true, recoveredAmount: true, priority: true },
    });
    return {
      intent: "rr_top_opportunities",
      interpretedAs: "Top 5 opportunities by potentialAmount",
      summary: rows.length
        ? `Top ${rows.length} by potential: ${rows.map((r) => r.title).join("; ")}.`
        : "No opportunities in this organization.",
      metrics: { count: rows.length },
      rows: rows.map((r) => ({
        title: r.title,
        status: r.status,
        potential: r.potentialAmount,
        recovered: r.recoveredAmount,
        priority: r.priority,
        href: `/app/revenue/${r.id}`,
      })),
      links: rows.map((r) => ({ label: r.title, href: `/app/revenue/${r.id}` })),
    };
  }

  // Ops savings
  if (
    /how much.*(sav|waste|ops|operation)/.test(q) ||
    /realized savings|projected savings|operational waste/.test(q)
  ) {
    const a = await oeAgg(organizationId);
    const projected = money(a._sum.projectedSavings ?? a._sum.estimatedWasteAnnual ?? 0);
    const realized = money(a._sum.realizedSavings ?? a._sum.recoveredAnnual ?? 0);
    return {
      intent: "oe_savings",
      interpretedAs: "Sum projected vs realized savings on inefficiencies",
      summary: `Projected annual savings ${projected.toLocaleString("en-US", { style: "currency", currency: "USD" })}; realized ${realized.toLocaleString("en-US", { style: "currency", currency: "USD" })} across ${a._count} inefficiencies. Projected ≠ realized.`,
      metrics: {
        projected,
        realized,
        projectedHoursWeekly: money(a._sum.projectedHoursWeekly ?? 0),
        realizedHoursWeekly: money(a._sum.realizedHoursWeekly ?? 0),
        count: a._count,
      },
      links: [
        { label: "Operations", href: "/app/operations" },
        { label: "Ops Summary report", href: "/app/reports?type=ops_summary" },
      ],
    };
  }

  // Pending approvals
  if (/pending approval|approvals? (waiting|open|queue)|what.*(need|await).*approv/.test(q)) {
    const pending = await prisma.approvalRequest.findMany({
      where: { organizationId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return {
      intent: "pending_approvals",
      interpretedAs: "List PENDING ApprovalRequest rows",
      summary: pending.length
        ? `${pending.length} pending approval(s): ${pending
            .slice(0, 5)
            .map((p) => p.title)
            .join("; ")}${pending.length > 5 ? "…" : ""}.`
        : "No pending approvals.",
      metrics: { pendingCount: pending.length },
      rows: pending.map((p) => ({
        title: p.title,
        type: p.type,
        needsIntegration: p.needsIntegration,
        createdAt: p.createdAt.toISOString(),
      })),
      links: [{ label: "Approvals", href: "/app/approvals" }],
    };
  }

  // High value / critical
  if (/high[- ]?value|critical|urgent/.test(q)) {
    const settings = await prisma.orgSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
    const hv = settings.highValueThreshold;
    const [opps, ineff] = await Promise.all([
      prisma.opportunity.findMany({
        where: {
          organizationId,
          OR: [{ potentialAmount: { gte: hv } }, { priority: { in: ["CRITICAL", "HIGH"] } }],
          status: { notIn: ["DISMISSED", "VERIFIED"] },
        },
        orderBy: { potentialAmount: "desc" },
        take: 10,
      }),
      prisma.inefficiency.findMany({
        where: {
          organizationId,
          OR: [{ projectedSavings: { gte: hv } }, { priority: { in: ["CRITICAL", "HIGH"] } }],
          status: { notIn: ["DISMISSED", "VERIFIED", "RESOLVED"] },
        },
        orderBy: { projectedSavings: "desc" },
        take: 10,
      }),
    ]);
    return {
      intent: "high_value_items",
      interpretedAs: `Items ≥ highValueThreshold (${hv}) or CRITICAL/HIGH priority`,
      summary: `${opps.length} high-value RR + ${ineff.length} high-value OE items (threshold ${hv}).`,
      metrics: { rr: opps.length, oe: ineff.length, threshold: hv },
      rows: [
        ...opps.map((o) => ({
          kind: "RR",
          title: o.title,
          amount: o.potentialAmount,
          status: o.status,
          href: `/app/revenue/${o.id}`,
        })),
        ...ineff.map((i) => ({
          kind: "OE",
          title: i.title,
          amount: i.projectedSavings,
          status: i.status,
          href: `/app/operations/${i.id}`,
        })),
      ],
      links: [{ label: "Action Center", href: "/app/action-center" }],
    };
  }

  // By department
  const deptMatch = q.match(/department[:\s]+([a-z0-9 &\-/]+)/i) || q.match(/in ([a-z0-9 &\-/]+) department/);
  if (deptMatch || /by department|per department/.test(q)) {
    const dept = deptMatch?.[1]?.trim();
    if (dept && dept.length < 80) {
      const [opps, ineff] = await Promise.all([
        prisma.opportunity.findMany({
          where: { organizationId, department: { contains: dept, mode: "insensitive" } },
          take: 20,
        }),
        prisma.inefficiency.findMany({
          where: { organizationId, department: { contains: dept, mode: "insensitive" } },
          take: 20,
        }),
      ]);
      const pot = money(opps.reduce((s, o) => s + (o.potentialAmount || 0), 0));
      const proj = money(ineff.reduce((s, i) => s + (i.projectedSavings || 0), 0));
      return {
        intent: "by_department",
        interpretedAs: `Filter RR/OE by department contains "${dept}"`,
        summary: `Department "${dept}": ${opps.length} opportunities (potential ${pot}), ${ineff.length} inefficiencies (projected ${proj}).`,
        metrics: { opportunities: opps.length, inefficiencies: ineff.length, potential: pot, projected: proj },
        rows: [
          ...opps.map((o) => ({ kind: "RR", title: o.title, amount: o.potentialAmount, status: o.status })),
          ...ineff.map((i) => ({ kind: "OE", title: i.title, amount: i.projectedSavings, status: i.status })),
        ],
      };
    }
    // Aggregate breakdown
    const opps = await prisma.opportunity.groupBy({
      by: ["department"],
      where: { organizationId },
      _sum: { potentialAmount: true, recoveredAmount: true },
      _count: true,
    });
    return {
      intent: "department_breakdown",
      interpretedAs: "groupBy department on opportunities",
      summary: `Breakdown across ${opps.length} department buckets.`,
      metrics: { departments: opps.length },
      rows: opps.map((g) => ({
        department: g.department || "(none)",
        count: g._count,
        potential: g._sum.potentialAmount ?? 0,
        recovered: g._sum.recoveredAmount ?? 0,
      })),
    };
  }

  // Status counts
  if (/status|pipeline summary|how many/.test(q) && /(opportunit|recovery|inefficien|ops)/.test(q)) {
    const wantOe = /inefficien|ops|operation/.test(q);
    if (wantOe) {
      const groups = await prisma.inefficiency.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: true,
        _sum: { projectedSavings: true, realizedSavings: true },
      });
      return {
        intent: "oe_status_summary",
        interpretedAs: "groupBy status on inefficiencies",
        summary: groups.map((g) => `${g.status}: ${g._count}`).join(" · ") || "No inefficiencies.",
        metrics: Object.fromEntries(groups.map((g) => [g.status, g._count])),
        rows: groups.map((g) => ({
          status: g.status,
          count: g._count,
          projected: g._sum.projectedSavings ?? 0,
          realized: g._sum.realizedSavings ?? 0,
        })),
      };
    }
    const groups = await prisma.opportunity.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: true,
      _sum: { potentialAmount: true, recoveredAmount: true },
    });
    return {
      intent: "rr_status_summary",
      interpretedAs: "groupBy status on opportunities",
      summary: groups.map((g) => `${g.status}: ${g._count}`).join(" · ") || "No opportunities.",
      metrics: Object.fromEntries(groups.map((g) => [g.status, g._count])),
      rows: groups.map((g) => ({
        status: g.status,
        count: g._count,
        potential: g._sum.potentialAmount ?? 0,
        recovered: g._sum.recoveredAmount ?? 0,
      })),
    };
  }

  // Weekly / monthly impact
  if (/this week|weekly|last 7/.test(q)) {
    const since = new Date(Date.now() - 7 * 86400000);
    const [recov, savings, hist] = await Promise.all([
      prisma.opportunity.aggregate({
        where: { organizationId, recoveredAt: { gte: since } },
        _sum: { recoveredAmount: true },
        _count: true,
      }),
      prisma.inefficiency.aggregate({
        where: { organizationId, resolvedAt: { gte: since } },
        _sum: { realizedSavings: true },
        _count: true,
      }),
      prisma.statusHistory.count({
        where: { organizationId, createdAt: { gte: since } },
      }),
    ]);
    return {
      intent: "weekly_impact",
      interpretedAs: "Recoveries/savings with recoveredAt/resolvedAt in last 7 days",
      summary: `Last 7 days: recovered ${money(recov._sum.recoveredAmount ?? 0)} on ${recov._count} ops; realized savings ${money(savings._sum.realizedSavings ?? 0)} on ${savings._count}; ${hist} status changes.`,
      metrics: {
        recovered: money(recov._sum.recoveredAmount ?? 0),
        recoveryCount: recov._count,
        realizedSavings: money(savings._sum.realizedSavings ?? 0),
        savingsCount: savings._count,
        statusChanges: hist,
      },
      links: [{ label: "Weekly Brief", href: "/app/reports?type=weekly_brief" }],
    };
  }

  if (/this month|monthly|last 30/.test(q)) {
    const since = new Date(Date.now() - 30 * 86400000);
    const [recov, savings] = await Promise.all([
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
    ]);
    return {
      intent: "monthly_impact",
      interpretedAs: "Recoveries/savings in last 30 days",
      summary: `Last 30 days: recovered ${money(recov._sum.recoveredAmount ?? 0)} (verified ${money(recov._sum.verifiedAmount ?? 0)}); realized savings ${money(savings._sum.realizedSavings ?? 0)}.`,
      metrics: {
        recovered: money(recov._sum.recoveredAmount ?? 0),
        verified: money(recov._sum.verifiedAmount ?? 0),
        realizedSavings: money(savings._sum.realizedSavings ?? 0),
      },
      links: [{ label: "Monthly Impact", href: "/app/reports?type=monthly_impact" }],
    };
  }

  // Unassigned
  if (/unassigned|no assignee|without owner/.test(q)) {
    const [opps, ineff] = await Promise.all([
      prisma.opportunity.findMany({
        where: { organizationId, assigneeId: null, status: { notIn: ["DISMISSED", "VERIFIED"] } },
        take: 15,
        orderBy: { potentialAmount: "desc" },
      }),
      prisma.inefficiency.findMany({
        where: { organizationId, assigneeId: null, status: { notIn: ["DISMISSED", "VERIFIED"] } },
        take: 15,
        orderBy: { projectedSavings: "desc" },
      }),
    ]);
    return {
      intent: "unassigned",
      interpretedAs: "RR/OE with null assigneeId",
      summary: `${opps.length} unassigned opportunities, ${ineff.length} unassigned inefficiencies.`,
      metrics: { rr: opps.length, oe: ineff.length },
      rows: [
        ...opps.map((o) => ({ kind: "RR", title: o.title, amount: o.potentialAmount, status: o.status })),
        ...ineff.map((i) => ({ kind: "OE", title: i.title, amount: i.projectedSavings, status: i.status })),
      ],
      links: [{ label: "Action Center", href: "/app/action-center" }],
    };
  }

  // Fallback: keyword search summary (still tenant-scoped)
  const [opps, ineff, findings] = await Promise.all([
    prisma.opportunity.findMany({
      where: {
        organizationId,
        OR: [{ title: { contains: raw.trim(), mode: "insensitive" } }, { description: { contains: raw.trim(), mode: "insensitive" } }],
      },
      take: 8,
      orderBy: { score: "desc" },
    }),
    prisma.inefficiency.findMany({
      where: {
        organizationId,
        OR: [{ title: { contains: raw.trim(), mode: "insensitive" } }, { description: { contains: raw.trim(), mode: "insensitive" } }],
      },
      take: 8,
      orderBy: { score: "desc" },
    }),
    prisma.finding.count({
      where: {
        organizationId,
        OR: [{ evidenceSummary: { contains: raw.trim(), mode: "insensitive" } }, { recommendation: { contains: raw.trim(), mode: "insensitive" } }],
      },
    }),
  ]);

  return {
    intent: "keyword_fallback",
    interpretedAs: "Keyword contains search (no NL intent matched)",
    summary: `No structured intent matched. Keyword hits: ${opps.length} opportunities, ${ineff.length} inefficiencies, ${findings} findings. Try: "How much revenue have we recovered?", "Top opportunities", "Pending approvals", "High-value items", "Weekly impact".`,
    metrics: { opportunities: opps.length, inefficiencies: ineff.length, findings },
    rows: [
      ...opps.map((o) => ({ kind: "RR", title: o.title, status: o.status, amount: o.potentialAmount })),
      ...ineff.map((i) => ({ kind: "OE", title: i.title, status: i.status, amount: i.projectedSavings })),
    ],
    links: [{ label: "Full search", href: `/app/search?q=${encodeURIComponent(raw.trim())}` }],
  };
}
