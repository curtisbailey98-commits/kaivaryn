import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Badge, PriorityBadge, StatusBadge, ExampleDataTag } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { analyzeRevenueSignals } from "@/lib/intelligence";
import { Prisma } from "@prisma/client";
import { OpportunityPriority, OpportunityStatus } from "@/lib/enums";
import { CircleDollarSign, Download, LineChart, Plus, ShieldCheck, TrendingUp } from "lucide-react";
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
      orderBy: [{ potentialAmount: "desc" }, { score: "desc" }],
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

  const viewChips = (
    <div className="flex flex-wrap gap-2">
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
  );

  return (
    <div>
      <PageHeader
        eyebrow="Revenue Recovery"
        title="Revenue Recovery"
        description="Revenue your business is losing, ranked by value — tracked from estimate to verified recovery."
        actions={
          <>
            {ctx.organization?.isDemo ? <ExampleDataTag /> : null}
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
        <MetricCard label={MONEY.pipelinePotential.label} value={formatCurrency(estimated)} sublabel={`Estimate · ${agg._count} opportunities`} icon={CircleDollarSign} tone="accent" />
        <MetricCard label="In recovery" value={formatCurrency(agg._sum.inProgressAmount ?? 0)} sublabel={`${formatCurrency(agg._sum.approvedAmount ?? 0)} approved for recovery`} icon={TrendingUp} />
        <MetricCard label={MONEY.cashRecovered.label} value={formatCurrency(recovered)} sublabel={`Recorded · ${recoveryRate}% of estimate`} icon={ShieldCheck} tone="success" />
        <MetricCard label={MONEY.verifiedRecovered.label} value={formatCurrency(verified)} sublabel="Recovered cash confirmed against evidence" icon={ShieldCheck} tone="success" />
      </div>
      <p className="mt-2 text-xs text-neutral-500">{MONEY_GLOSSARY_FOOTNOTE}</p>

      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {funnelStages.map((s, idx) => (
          <Link key={s.key} href={s.href} className="rounded-lg border border-neutral-800 bg-neutral-950/80 p-3 transition hover:border-amber-500/40">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">{idx + 1}. {s.label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{s.count}</p>
            {s.key === "recovered" ? (
              <p className="mt-0.5 text-xs text-emerald-400/90">{formatCurrency(s.recovered)} cash recovered</p>
            ) : (
              <p className="mt-0.5 text-xs text-neutral-500">{formatCurrency(s.potential)} estimated</p>
            )}
          </Link>
        ))}
      </div>

      <section className="mt-8" aria-labelledby="rr-list-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="rr-list-title" className="text-base font-semibold text-white">Highest-value opportunities</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Ranked by estimated value. Open one to see the evidence, owner, approval, and recorded result.</p>
          </div>
        </div>
        <div className="mt-3">{viewChips}</div>

        <details className="mt-3 rounded-lg border border-neutral-900">
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

        <div className="si-panel mt-3 overflow-hidden">
          {opps.length === 0 ? (
            <EmptyState title="No opportunities in this view" description="Try another view or clear the filters." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Opportunity</TH>
                  <TH className="text-right">Estimated</TH>
                  <TH className="hidden text-right lg:table-cell">Recovered · verified</TH>
                  <TH className="hidden md:table-cell">Owner</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {opps.map((o) => (
                  <TR key={o.id}>
                    <TD>
                      <Link href={`/app/revenue/${o.id}`} className="font-medium text-amber-400 hover:underline">
                        {clientTitle(o.title)}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <PriorityBadge priority={o.priority} />
                        <span>{[classifyLeakageType(o.type).label, o.department].filter(Boolean).join(" · ")} · {ageDays(o.identifiedAt)}d old</span>
                      </div>
                    </TD>
                    <TD className="text-right font-semibold text-white">{formatCurrency(o.potentialAmount || o.estimatedAmount)}</TD>
                    <TD className="hidden text-right lg:table-cell">
                      <span className="text-emerald-300">{formatCurrency(o.recoveredAmount)}</span>
                      {o.verifiedAmount > 0 ? <span className="block text-[11px] text-emerald-400/70">{formatCurrency(o.verifiedAmount)} verified</span> : null}
                    </TD>
                    <TD className="hidden text-sm md:table-cell">{o.assignee ? <span className="text-neutral-300">{o.assignee.name || o.assignee.email}</span> : <span className="text-amber-400/80">Unassigned</span>}</TD>
                    <TD><StatusBadge status={o.status} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="rr-analytics-title">
        <h2 id="rr-analytics-title" className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Portfolio analytics</h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Open estimate</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(openPipeline)}</p>
            <p className="mt-1 text-xs text-neutral-500">Estimated opportunity minus cash recovered</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
            <p className="text-[10px] uppercase tracking-wider text-emerald-300">Recovery rate</p>
            <p className="mt-2 text-2xl font-semibold text-white">{recoveryRate}%</p>
            <p className="mt-1 text-xs text-neutral-500">Cash recovered ÷ estimated opportunity</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">High-confidence</p>
            <p className="mt-2 text-2xl font-semibold text-white">{highConfidence}</p>
            <p className="mt-1 text-xs text-neutral-500">Open opportunities with confidence 70+ · {pendingApprovals} approvals pending</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <AnimatedFunnelBars
            className="lg:col-span-1"
            title="Recovery funnel"
            description="Count and estimated value at each stage (recovered also shows cash)"
            stages={chartData.funnel}
            footnote={chartData.sourceNote}
          />
          <DynAreaChart
            className="lg:col-span-1"
            title="Recovered vs. estimated"
            description="Weekly estimated opportunity identified and cash recovered — overlaid, not stacked"
            data={chartData.trend}
            series={[
              { key: "projected", label: "Estimated (identified)", color: CHART.amber },
              { key: "recovered", label: "Recovered", color: CHART.emerald },
            ]}
            footnote={chartData.sourceNote}
            height={280}
            stagger={1}
          />
          <DynDonutChart
            className="lg:col-span-1"
            title="Where revenue is leaking"
            description="Estimated value by leakage type"
            data={chartData.taxonomy}
            centerLabel="Estimated"
            centerValue={formatMoneyTick(chartData.taxonomy.reduce((n, t) => n + t.value, 0))}
            footnote={chartData.sourceNote}
            height={280}
            stagger={2}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <DynWaterfallChart
            title="Portfolio by recovery stage"
            description="Each opportunity counted once, at its current stage · sums to total estimate"
            stages={revenueFunnelToWaterfall(chartData.funnel)}
            money
            height={280}
            footnote={chartData.sourceNote}
            stagger={3}
          />
          <DynStepChart
            title="Cumulative cash recovered"
            description="Recovered amounts accumulated by week"
            data={trendToCumulativeRecovered(chartData.trend)}
            series={[
              { key: "cumulative", label: "Cumulative recovered", color: CHART.emerald },
              { key: "weekly", label: "Weekly recovered", color: CHART.amber },
            ]}
            money
            height={280}
            footnote="Recovered only · estimates excluded"
            stagger={4}
          />
        </div>

        {taxonomy.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">By leakage type</p>
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
          <p className="si-label">Analysis summary</p>
          {intel.status === "INSUFFICIENT_DATA" ? (
            <div className="mt-2">
              <Badge tone="warning">Insufficient data</Badge>
              <p className="mt-2 text-neutral-400">{intel.reason}</p>
            </div>
          ) : (
            <div className="mt-2">
              <Badge tone="info">Finding · {humanizeLabel(intel.confidence)} confidence</Badge>
              <p className="mt-2 text-neutral-200">{intel.summary}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
