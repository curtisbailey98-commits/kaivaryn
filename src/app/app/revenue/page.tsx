import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge, PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { analyzeRevenueSignals } from "@/lib/intelligence";
import { Prisma } from "@prisma/client";
import { OpportunityPriority, OpportunityStatus } from "@/lib/enums";
import { CircleDollarSign, Crosshair, Download, LineChart, Plus, ShieldCheck, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { classifyLeakageType, LEAKAGE_TYPES } from "@/lib/leakage-taxonomy";
import { ageDays } from "@/lib/sla";
import { getRevenueChartData, revenueFunnelToWaterfall, trendToCumulativeRecovered } from "@/lib/chart-data";
import { DynAreaChart, DynDonutChart, DynWaterfallChart, DynStepChart, AnimatedFunnelBars } from "@/components/charts/dynamic";
import { CHART } from "@/components/charts/theme";
import { formatMoneyTick } from "@/components/charts/theme";
import { MONEY, MONEY_GLOSSARY_FOOTNOTE, cashRecoveryRate } from "@/lib/money-glossary";
import { clientTitle, humanizeLabel } from "@/lib/labels";

export const metadata = { title: "Revenue Recovery" };

export const dynamic = "force-dynamic";

const VIEWS: Record<string, { label: string; where?: Prisma.OpportunityWhereInput }> = {
  all: { label: "All" },
  critical: { label: "Critical", where: { priority: "CRITICAL" } },
  high_value: { label: "High Value", where: { potentialAmount: { gte: 50000 } } },
  high_confidence: { label: "High Confidence", where: { score: { gte: 70 }, status: { notIn: ["RECOVERED", "VERIFIED", "DISMISSED"] } } },
  identified: { label: "Identified", where: { status: { in: ["IDENTIFIED", "NEW"] } } },
  under_review: { label: "Under Review", where: { status: "UNDER_REVIEW" } },
  in_recovery: { label: "In Recovery", where: { status: { in: ["APPROVED", "IN_RECOVERY", "IN_PROGRESS", "PARTIALLY_RECOVERED"] } } },
  recovered: { label: "Recovered", where: { status: { in: ["RECOVERED", "VERIFIED"] } } },
  dismissed: { label: "Dismissed", where: { status: "DISMISSED" } },
};

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  await requireEntitlement(ctx.organizationId, "REVENUE_RECOVERY");

  const view = searchParams.view && VIEWS[searchParams.view] ? searchParams.view : "all";
  const where: Prisma.OpportunityWhereInput = {
    organizationId: ctx.organizationId,
    ...(VIEWS[view].where || {}),
  };
  if (searchParams.status && Object.values(OpportunityStatus).includes(searchParams.status as OpportunityStatus)) {
    where.status = searchParams.status as OpportunityStatus;
  }
  if (searchParams.priority && Object.values(OpportunityPriority).includes(searchParams.priority as OpportunityPriority)) {
    where.priority = searchParams.priority as OpportunityPriority;
  }
  if (searchParams.source) where.source = { contains: searchParams.source, mode: "insensitive" };
  if (searchParams.dept) where.department = { contains: searchParams.dept, mode: "insensitive" };
  if (searchParams.type) where.type = { contains: searchParams.type, mode: "insensitive" };
  if (searchParams.from || searchParams.to) {
    where.identifiedAt = {};
    if (searchParams.from) where.identifiedAt.gte = new Date(searchParams.from);
    if (searchParams.to) where.identifiedAt.lte = new Date(searchParams.to);
  }

  const [opps, agg, highConfidence, pendingApprovals, byStatus, allForTaxonomy, chartData] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      orderBy: [{ score: "desc" }, { potentialAmount: "desc" }],
      include: { assignee: { select: { name: true, email: true } } },
      take: 200,
    }),
    prisma.opportunity.aggregate({
      where: { organizationId: ctx.organizationId },
      _sum: { estimatedAmount: true, potentialAmount: true, approvedAmount: true, inProgressAmount: true, recoveredAmount: true, verifiedAmount: true },
      _count: true,
    }),
    prisma.opportunity.count({ where: { organizationId: ctx.organizationId, score: { gte: 70 }, status: { notIn: ["RECOVERED", "VERIFIED", "DISMISSED"] } } }),
    prisma.approvalRequest.count({ where: { organizationId: ctx.organizationId, status: "PENDING" } }),
    prisma.opportunity.groupBy({
      by: ["status"],
      where: { organizationId: ctx.organizationId },
      _count: true,
      _sum: { potentialAmount: true, recoveredAmount: true },
    }),
    prisma.opportunity.findMany({
      where: { organizationId: ctx.organizationId, status: { notIn: ["DISMISSED"] } },
      select: { type: true, potentialAmount: true, recoveredAmount: true, status: true },
      take: 500,
    }),
    getRevenueChartData(ctx.organizationId),
  ]);

  const sources = Array.from(new Set(opps.map((o) => o.source).filter(Boolean) as string[]));
  const intel = analyzeRevenueSignals({
    opportunityCount: agg._count,
    totalEstimated: agg._sum.estimatedAmount ?? 0,
    totalRecovered: agg._sum.recoveredAmount ?? 0,
    sources,
  });

  const estimated = agg._sum.estimatedAmount ?? agg._sum.potentialAmount ?? 0;
  const recovered = agg._sum.recoveredAmount ?? 0;
  const verified = agg._sum.verifiedAmount ?? 0;
  const openPipeline = Math.max(0, estimated - recovered);
  const recoveryRate = cashRecoveryRate(recovered, estimated);

  const funnelStages = [
    { key: "identified", label: "Identified", statuses: ["IDENTIFIED", "NEW"], href: "/app/revenue?view=identified" },
    { key: "review", label: "Under review", statuses: ["UNDER_REVIEW"], href: "/app/revenue?view=under_review" },
    { key: "recovery", label: "In recovery", statuses: ["APPROVED", "IN_RECOVERY", "IN_PROGRESS", "PARTIALLY_RECOVERED"], href: "/app/revenue?view=in_recovery" },
    { key: "recovered", label: "Recovered", statuses: ["RECOVERED", "VERIFIED"], href: "/app/revenue?view=recovered" },
  ].map((stage) => {
    const rows = byStatus.filter((g) => stage.statuses.includes(g.status));
    return {
      ...stage,
      count: rows.reduce((n, g) => n + g._count, 0),
      potential: rows.reduce((n, g) => n + (g._sum.potentialAmount ?? 0), 0),
      recovered: rows.reduce((n, g) => n + (g._sum.recoveredAmount ?? 0), 0),
    };
  });

  const taxonomy = LEAKAGE_TYPES.map((t) => {
    const rows = allForTaxonomy.filter((o) => classifyLeakageType(o.type).id === t.id);
    return {
      id: t.id,
      label: t.label,
      count: rows.length,
      potential: rows.reduce((n, r) => n + (r.potentialAmount || 0), 0),
      recovered: rows.reduce((n, r) => n + (r.recoveredAmount || 0), 0),
    };
  }).filter((t) => t.count > 0);

  return (
    <div>
      <PageHeader
        eyebrow="Product"
        title="Revenue Recovery"
        description="Every dollar Kaivaryn believes is leaking, prioritized by confidence and size — estimates and recovered amounts always kept separate."
        actions={
          <>
            {ctx.organization?.isDemo ? <Badge tone="demo">DEMO data</Badge> : null}
            <Link href="/app/revenue/new" className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-400">
              <Plus className="h-3.5 w-3.5" /> New opportunity
            </Link>
            <Link href="/app/revenue/analytics" className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500">
              <LineChart className="h-3.5 w-3.5" /> Analytics
            </Link>
            <Link href="/api/export?type=opportunities" className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500">
              <Download className="h-3.5 w-3.5" /> Export
            </Link>
          </>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label={MONEY.pipelinePotential.label} value={formatCurrency(estimated)} sublabel={`${agg._count} identified opportunities`} icon={CircleDollarSign} tone="accent" />
        <MetricCard label="High-confidence" value={highConfidence} sublabel="Open opportunities scoring 70+" icon={Crosshair} />
        <MetricCard label={MONEY.inIntervention.label} value={formatCurrency(agg._sum.inProgressAmount ?? 0)} sublabel={`${formatCurrency(agg._sum.approvedAmount ?? 0)} ${MONEY.approved.short.toLowerCase()}`} icon={TrendingUp} />
        <MetricCard label={MONEY.cashRecovered.label} value={formatCurrency(recovered)} sublabel={verified > 0 ? `${MONEY.verifiedRecovered.label}: ${formatCurrency(verified)}` : `${pendingApprovals} approvals pending`} icon={ShieldCheck} tone="success" />
      </div>
      <p className="mt-2 text-xs text-neutral-500">{MONEY_GLOSSARY_FOOTNOTE} Recovery rate = cash recovered ÷ pipeline potential.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Open pipeline</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(openPipeline)}</p>
          <p className="mt-1 text-xs text-neutral-500">Potential minus cash recovered</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-wider text-emerald-300">Recovery rate</p>
          <p className="mt-2 text-2xl font-semibold text-white">{recoveryRate}%</p>
          <p className="mt-1 text-xs text-neutral-500">Cash recovered ÷ pipeline potential{verified > 0 ? ` · verified ${formatCurrency(verified)}` : ""}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Funnel stages</p>
          <p className="mt-2 text-2xl font-semibold text-white">{funnelStages.reduce((n, s) => n + s.count, 0)}</p>
          <p className="mt-1 text-xs text-neutral-500">Active opportunities across stages</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {funnelStages.map((s) => (
          <Link key={s.key} href={s.href} className="rounded-lg border border-neutral-800 bg-neutral-950/80 p-3 transition hover:border-amber-500/40">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">{s.label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{s.count}</p>
            {s.key === "recovered" ? (
              <p className="mt-0.5 text-xs text-emerald-400/90">{formatCurrency(s.recovered)} cash · {formatCurrency(s.potential)} at-stage potential</p>
            ) : (
              <p className="mt-0.5 text-xs text-neutral-500">{formatCurrency(s.potential)} potential at stage</p>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <AnimatedFunnelBars
          className="lg:col-span-1"
          title="Recovery funnel"
          description="Counts · potential at stage (Recovered also shows cash)"
          stages={chartData.funnel}
          footnote={chartData.sourceNote}
        />
        <DynAreaChart
          className="lg:col-span-1"
          title="Recovered vs projected"
          description="Weekly identified potential (estimate) and cash recovered (realized) — overlaid, not stacked"
          data={chartData.trend}
          series={[
            { key: "projected", label: "Projected (identified)", color: CHART.amber },
            { key: "recovered", label: "Recovered", color: CHART.emerald },
          ]}
          footnote={chartData.sourceNote}
          height={280}
          stagger={1}
        />
        <DynDonutChart
          className="lg:col-span-1"
          title="Leakage taxonomy"
          description="Potential by leakage type"
          data={chartData.taxonomy}
          centerLabel="Potential"
          centerValue={formatMoneyTick(chartData.taxonomy.reduce((n, t) => n + t.value, 0))}
          footnote={chartData.sourceNote}
          height={280}
          stagger={2}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DynWaterfallChart
          title="Portfolio by recovery stage"
          description="Mutually exclusive status buckets · sum = portfolio potential"
          stages={revenueFunnelToWaterfall(chartData.funnel)}
          money
          height={280}
          footnote={chartData.sourceNote}
          stagger={3}
        />
        <DynStepChart
          title="Cumulative recovered"
          description="Step accumulation of recovered amounts by week"
          data={trendToCumulativeRecovered(chartData.trend)}
          series={[
            { key: "cumulative", label: "Cumulative recovered", color: CHART.emerald },
            { key: "weekly", label: "Weekly recovered", color: CHART.amber },
          ]}
          money
          height={280}
          footnote="Recovered only · projected excluded"
          stagger={4}
        />
      </div>

      {taxonomy.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">Leakage taxonomy</p>
          <div className="flex flex-wrap gap-2">
            {taxonomy.map((t) => (
              <Link
                key={t.id}
                href={`/app/revenue?type=${encodeURIComponent(t.id)}`}
                className="rounded-full border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:border-amber-500/50"
              >
                {t.label} · {t.count} · {formatCurrency(t.potential)}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="si-glass mt-6 p-4 text-sm">
        <p className="si-label">Intelligence</p>
        {intel.status === "INSUFFICIENT_DATA" ? (
          <div className="mt-2">
            <Badge tone="warning">Insufficient data</Badge>
            <p className="mt-2 text-neutral-400">{intel.reason}</p>
          </div>
        ) : (
          <div className="mt-2">
            <Badge tone="info">Finding · {humanizeLabel(intel.confidence)}</Badge>
            <p className="mt-2 text-neutral-200">{intel.summary}</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {Object.entries(VIEWS).map(([k, v]) => (
          <Link
            key={k}
            href={`/app/revenue?view=${k}`}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              view === k ? "border-amber-500 text-amber-400" : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <details className="mt-4 rounded-lg border border-neutral-900">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200">Filters</summary>
        <form className="grid gap-3 border-t border-neutral-900 p-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
          <input type="hidden" name="view" value={view} />
          <label className="block">
            <span className="mb-1 block text-neutral-500">Source</span>
            <input name="source" defaultValue={searchParams.source} className="h-9 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-neutral-500">Department</span>
            <input name="dept" defaultValue={searchParams.dept} className="h-9 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-neutral-500">Type</span>
            <input name="type" defaultValue={searchParams.type} className="h-9 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-neutral-500">From</span>
            <input name="from" type="date" defaultValue={searchParams.from} className="h-9 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-neutral-500">To</span>
            <input name="to" type="date" defaultValue={searchParams.to} className="h-9 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2" />
          </label>
          <div className="flex items-end">
            <button type="submit" className="h-9 w-full rounded-md border border-neutral-700 px-3 text-neutral-200 hover:border-neutral-500">Apply filters</button>
          </div>
        </form>
      </details>

      <div className="si-panel mt-6 overflow-hidden">
        {opps.length === 0 ? (
          <EmptyState title="No opportunities in this view" description="Create one or adjust filters. Demo org ships with DEMO-labeled seed data." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Status</TH>
                <TH>Priority</TH>
                <TH>Potential</TH>
                <TH className="hidden sm:table-cell">Cash recovered</TH>
                <TH className="hidden md:table-cell">Identified</TH>
              </TR>
            </THead>
            <TBody>
              {opps.map((o) => (
                <TR key={o.id}>
                  <TD>
                    <Link href={`/app/revenue/${o.id}`} className="text-amber-400 hover:underline">
                      {clientTitle(o.title)}
                    </Link>
                    <div className="text-xs text-neutral-500">{[o.source ? humanizeLabel(o.source) : null, o.department, classifyLeakageType(o.type).label].filter(Boolean).join(" · ")}{o.assignee ? ` · ${o.assignee.name || o.assignee.email}` : " · Unassigned"} · {ageDays(o.identifiedAt)}d</div>
                  </TD>
                  <TD><StatusBadge status={o.status} /></TD>
                  <TD><PriorityBadge priority={o.priority} /></TD>
                  <TD>
                    {formatCurrency(o.potentialAmount || o.estimatedAmount)} <span className="text-xs text-neutral-500">{Math.round(o.score)} conf.</span>
                  </TD>
                  <TD className="hidden text-emerald-300 sm:table-cell">{formatCurrency(o.recoveredAmount)}</TD>
                  <TD className="hidden md:table-cell">{formatDate(o.identifiedAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
