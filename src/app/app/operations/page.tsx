import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/states";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { analyzeOperationsSignals } from "@/lib/intelligence";
import { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Clock3, Cog, Gauge, ShieldCheck } from "lucide-react";
import { automationReadinessScore } from "@/lib/leakage-taxonomy";
import { ageDays } from "@/lib/sla";
import { getOperationsChartData } from "@/lib/chart-data";
import { DynAreaChart, DynBarChart, AnimatedGaugeBar } from "@/components/charts/dynamic";
import { CHART } from "@/components/charts/theme";
import { MONEY, MONEY_GLOSSARY_FOOTNOTE } from "@/lib/money-glossary";
import { Badge, StatusBadge, PriorityBadge, ExampleDataTag } from "@/components/ui/badge";
import { clientTitle, humanizeLabel } from "@/lib/labels";

export const metadata = { title: "Operations Efficiency" };

export const dynamic = "force-dynamic";

const VIEWS: Record<string, { label: string; where?: Prisma.InefficiencyWhereInput }> = {
  all: { label: "All" },
  critical: { label: "Critical", where: { priority: "CRITICAL" } },
  automation: { label: "Automation candidates", where: { automationCandidate: true } },
  identified: { label: "Identified", where: { status: { in: ["IDENTIFIED", "NEW"] } } },
  analyzing: { label: "Analyzing", where: { status: "ANALYZING" } },
  implementing: { label: "Implementing", where: { status: { in: ["APPROVED", "IMPLEMENTING", "IN_PROGRESS"] } } },
  realized: { label: "Realized", where: { status: { in: ["REALIZED", "VERIFIED", "RESOLVED"] } } },
  dismissed: { label: "Dismissed", where: { status: "DISMISSED" } },
};

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  await requireEntitlement(ctx.organizationId, "OPERATIONS_EFFICIENCY");

  const view = searchParams.view && VIEWS[searchParams.view] ? searchParams.view : "all";
  const where: Prisma.InefficiencyWhereInput = {
    organizationId: ctx.organizationId,
    ...(VIEWS[view].where || {}),
  };

  const [items, agg, autoCount, criticalCount, pendingApprovals, hours, chartData] = await Promise.all([
    prisma.inefficiency.findMany({
      where,
      orderBy: [{ estimatedWasteAnnual: "desc" }, { score: "desc" }],
      take: 200,
      include: { assignee: { select: { name: true, email: true } }, _count: { select: { evidence: true } } },
    }),
    prisma.inefficiency.aggregate({
      where: { organizationId: ctx.organizationId },
      _sum: { estimatedWasteAnnual: true, projectedSavings: true, recoveredAnnual: true, realizedSavings: true },
      _count: true,
    }),
    prisma.inefficiency.count({
      where: { organizationId: ctx.organizationId, automationCandidate: true },
    }),
    prisma.inefficiency.count({
      where: { organizationId: ctx.organizationId, priority: "CRITICAL", status: { notIn: ["REALIZED", "VERIFIED", "RESOLVED", "DISMISSED"] } },
    }),
    prisma.approvalRequest.count({ where: { organizationId: ctx.organizationId, status: "PENDING" } }),
    prisma.inefficiency.aggregate({ where: { organizationId: ctx.organizationId }, _sum: { projectedHoursWeekly: true, realizedHoursWeekly: true } }),
    getOperationsChartData(ctx.organizationId),
  ]);

  const intel = analyzeOperationsSignals({
    inefficiencyCount: agg._count,
    totalEstimatedWaste: agg._sum.estimatedWasteAnnual ?? 0,
    automationCandidates: autoCount,
  });

  const annualized = agg._sum.estimatedWasteAnnual ?? 0;
  const projected = agg._sum.projectedSavings ?? 0;
  const realized = agg._sum.realizedSavings ?? agg._sum.recoveredAnnual ?? 0;
  const gap = Math.max(0, projected - realized);
  const precision = projected > 0 ? Math.round((realized / projected) * 1000) / 10 : 0;
  const sameAsCost = annualized > 0 && Math.abs(annualized - projected) < 1;
  const readinessFor = (i: (typeof items)[number]) =>
    automationReadinessScore({
      automationCandidate: i.automationCandidate,
      score: i.score,
      evidenceCount: i._count?.evidence ?? 0,
      projectedSavings: i.projectedSavings || i.estimatedWasteAnnual,
      priority: i.priority,
    });
  const readinessAvg = items.length ? Math.round(items.reduce((n, i) => n + readinessFor(i), 0) / items.length) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Operations Efficiency"
        title="Operations Efficiency"
        description="Manual work, bottlenecks, and delays that cost you money — tracked from projected to realized savings."
        actions={<div className="flex flex-wrap items-center gap-2 text-sm">
          {ctx.organization?.isDemo ? <ExampleDataTag /> : null}
          <Link href="/app/operations/new" className="rounded-md bg-amber-500 px-3 py-2 font-semibold text-neutral-950 hover:bg-amber-400">New issue</Link>
          <Link href="/app/operations/analytics" className="rounded-md border border-neutral-700 px-3 py-2 text-neutral-200 hover:border-neutral-500">Analytics</Link>
        </div>}
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label={MONEY.projectedSavings.label} value={formatCurrency(projected)} sublabel={sameAsCost ? "Projection · per year · equal to annual cost identified" : `Projection · per year · of ${formatCurrency(annualized)} annual cost`} icon={Gauge} tone="accent" />
        <MetricCard label={MONEY.realizedSavings.label} value={formatCurrency(realized)} sublabel={`Recorded · ${precision}% of projection`} icon={ShieldCheck} tone="success" />
        <MetricCard label="Wasted hours" value={`${Math.round(hours._sum.projectedHoursWeekly ?? 0)} h/wk`} sublabel={`${Math.round(hours._sum.realizedHoursWeekly ?? 0)} h/wk recovered so far`} icon={Clock3} />
        <MetricCard label="Automation candidates" value={autoCount} sublabel="Each needs approval before any change" icon={Cog} href="/app/operations?view=automation" />
      </div>
      <p className="mt-2 text-xs text-neutral-500">{MONEY_GLOSSARY_FOOTNOTE}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Link href="/app/operations?view=critical" className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 transition hover:border-red-500/40"><p className="text-[10px] uppercase tracking-wider text-red-300">Needs attention now</p><p className="mt-2 text-2xl font-semibold text-white">{criticalCount}</p><p className="mt-1 text-xs text-neutral-500">Critical bottlenecks still open</p></Link>
        <Link href="/app/approvals" className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 transition hover:border-amber-500/40"><p className="text-[10px] uppercase tracking-wider text-amber-300">Decisions waiting</p><p className="mt-2 text-2xl font-semibold text-white">{pendingApprovals}</p><p className="mt-1 text-xs text-neutral-500">Actions awaiting approval</p></Link>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4"><p className="text-[10px] uppercase tracking-wider text-emerald-300">Open gap</p><p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(gap)}</p><p className="mt-1 text-xs text-neutral-500">Projected savings not yet realized</p></div>
      </div>

      <section className="mt-8" aria-labelledby="oe-list-title">
        <h2 id="oe-list-title" className="text-base font-semibold text-white">Highest-cost bottlenecks</h2>
        <p className="mt-0.5 text-xs text-neutral-500">Ranked by annual cost. Open one to see the evidence, owner, approval, and realized savings.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(VIEWS).map(([k, v]) => (
            <Link key={k} href={`/app/operations?view=${k}`}
              className={`rounded-full border px-3 py-1 text-xs transition ${view === k ? "border-amber-500 text-amber-400" : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"}`}>
              {v.label}
            </Link>
          ))}
        </div>

        <div className="si-panel mt-3 overflow-hidden">
          {items.length === 0 ? (
            <EmptyState title="No issues in this view" description="Try another view." />
          ) : (
            <Table>
              <THead><TR><TH>Issue</TH><TH className="text-right">Annual cost</TH><TH className="hidden text-right lg:table-cell">Hours / wk</TH><TH className="hidden text-right lg:table-cell">Realized</TH><TH className="hidden md:table-cell">Owner</TH><TH>Status</TH></TR></THead>
              <TBody>
                {items.map((i) => (
                  <TR key={i.id}>
                    <TD>
                      <Link href={`/app/operations/${i.id}`} className="font-medium text-amber-400 hover:underline">{clientTitle(i.title)}</Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <PriorityBadge priority={i.priority} />
                        {i.automationCandidate ? <Badge tone="info" title={`Automation readiness ${readinessFor(i)}/100`}>Automation candidate</Badge> : null}
                        <span>{[i.department, i.type ? humanizeLabel(i.type) : null].filter(Boolean).join(" · ") || "—"} · {ageDays(i.identifiedAt)}d old</span>
                      </div>
                    </TD>
                    <TD className="text-right font-semibold text-white">{formatCurrency(i.estimatedWasteAnnual)}</TD>
                    <TD className="hidden text-right lg:table-cell">{i.projectedHoursWeekly ?? i.hoursWastedWeekly ?? "—"}</TD>
                    <TD className="hidden text-right text-emerald-300 lg:table-cell">{formatCurrency(i.realizedSavings || i.recoveredAnnual)}</TD>
                    <TD className="hidden text-sm md:table-cell">{i.assignee ? <span className="text-neutral-300">{i.assignee.name || i.assignee.email}</span> : <span className="text-amber-400/80">Unassigned</span>}</TD>
                    <TD><StatusBadge status={i.status} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="oe-analytics-title">
        <h2 id="oe-analytics-title" className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Portfolio analytics</h2>
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Savings ledger</p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><p className="text-[10px] uppercase text-neutral-500">{MONEY.projectedSavings.label}</p><p className="mt-1 text-xl font-semibold text-white">{formatCurrency(projected)}</p></div>
            <div><p className="text-[10px] uppercase text-neutral-500">{MONEY.realizedSavings.label}</p><p className="mt-1 text-xl font-semibold text-emerald-400">{formatCurrency(realized)}</p></div>
            <div><p className="text-[10px] uppercase text-neutral-500">Open gap</p><p className="mt-1 text-xl font-semibold text-amber-400">{formatCurrency(gap)}</p></div>
            <div><p className="text-[10px] uppercase text-neutral-500">Realized to date</p><p className="mt-1 text-xl font-semibold text-white">{precision}%</p><p className="text-[10px] text-neutral-600">realized ÷ projected</p></div>
          </div>
          <p className="mt-3 text-xs text-neutral-500">Projected savings are never treated as banked. Savings count only once your team records them after the change is made.</p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <DynAreaChart
            className="lg:col-span-1"
            title="Savings over time"
            description="Weekly projected (estimate) and realized savings — overlaid, not stacked"
            data={chartData.trend}
            series={[
              { key: "projected", label: "Projected", color: CHART.amber },
              { key: "realized", label: "Realized", color: CHART.emerald },
            ]}
            footnote={chartData.sourceNote}
            height={260}
            stagger={0}
          />
          <DynBarChart
            className="lg:col-span-1"
            title="Cost by department"
            description="Estimated annual cost of open issues, by department"
            data={chartData.heat}
            series={[{ key: "waste", label: "Cost / yr", color: CHART.violet }]}
            money
            layout="vertical"
            height={260}
            footnote={chartData.sourceNote}
          />
          <AnimatedGaugeBar
            title="Automation readiness"
            description="Average score for items in this view"
            value={readinessAvg || chartData.readiness}
            footnote="Based on evidence, confidence, impact, and priority — not a claim that automation ran"
          />
        </div>
        <div className="si-glass mt-6 p-4 text-sm">
          <p className="si-label">Analysis summary</p>
          {intel.status === "INSUFFICIENT_DATA" ? (
            <><Badge tone="warning" className="mt-2">Insufficient data</Badge><p className="mt-2 text-neutral-400">{intel.reason}</p></>
          ) : (
            <><Badge tone="info" className="mt-2">Finding · {humanizeLabel(intel.confidence)} confidence</Badge><p className="mt-2 text-neutral-200">{intel.summary}</p></>
          )}
        </div>
      </section>
    </div>
  );
}
