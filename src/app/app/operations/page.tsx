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
import { Badge, StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { clientTitle, humanizeLabel } from "@/lib/labels";

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
      orderBy: [{ score: "desc" }, { projectedSavings: "desc" }],
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

  return (
    <div>
      <PageHeader eyebrow="Executive decision system" title="Operations Efficiency" description="Translate operational friction into financial impact, governed interventions, and measured results." actions={<div className="flex flex-wrap gap-2 text-sm">
          {ctx.organization?.isDemo ? <Badge tone="demo">DEMO data</Badge> : null}
          <Link href="/app/operations/new" className="rounded-md bg-amber-500 px-3 py-2 font-semibold text-neutral-950">New inefficiency</Link>
          <Link href="/app/operations/analytics" className="rounded-md border border-neutral-700 px-3 py-2">Analytics</Link>
        </div>} />

      {(() => {
        const annualized = agg._sum.estimatedWasteAnnual ?? 0;
        const addressable = agg._sum.projectedSavings ?? 0;
        const noHaircut = annualized > 0 && Math.abs(annualized - addressable) < 1;
        return (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Annualized inefficiency" value={formatCurrency(annualized)} sublabel="Modeled cost exposure (gross)" icon={Gauge} tone="accent" />
              <MetricCard
                label={MONEY.projectedSavings.label}
                value={formatCurrency(addressable)}
                sublabel={noHaircut ? "Equals annualized · no addressability haircut applied" : `${criticalCount} critical signals`}
                icon={Cog}
              />
              <MetricCard label={MONEY.realizedSavings.label} value={formatCurrency(agg._sum.realizedSavings ?? agg._sum.recoveredAnnual ?? 0)} sublabel="Recorded outcomes only" icon={ShieldCheck} tone="success" />
              <MetricCard label="Time opportunity" value={`${(hours._sum.projectedHoursWeekly ?? 0).toFixed(1)} h/wk`} sublabel={`${autoCount} automation candidates`} icon={Clock3} />
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {MONEY_GLOSSARY_FOOTNOTE}
              {noHaircut ? " Addressable currently mirrors annualized waste with no haircut — labeled above, not implied as fully recoverable." : ""}
            </p>
          </>
        );
      })()}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link href="/app/operations?view=critical" className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4"><p className="text-[10px] uppercase tracking-wider text-red-300">Immediate attention</p><p className="mt-2 text-2xl font-semibold text-white">{criticalCount}</p><p className="mt-1 text-xs text-neutral-500">Critical unresolved bottlenecks</p></Link>
        <Link href="/app/approvals" className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4"><p className="text-[10px] uppercase tracking-wider text-amber-300">Decision queue</p><p className="mt-2 text-2xl font-semibold text-white">{pendingApprovals}</p><p className="mt-1 text-xs text-neutral-500">Actions awaiting approval</p></Link>
        <Link href="/app/operations?view=automation" className="rounded-xl border border-neutral-800 bg-neutral-950 p-4"><p className="text-[10px] uppercase tracking-wider text-neutral-500">Execution readiness</p><p className="mt-2 text-2xl font-semibold text-white">{autoCount}</p><p className="mt-1 text-xs text-neutral-500">Automation candidates identified</p></Link>
      </div>

      <div className="si-glass mt-6 p-4 text-sm">
        <p className="si-label">Intelligence</p>
        {intel.status === "INSUFFICIENT_DATA" ? (
          <><Badge tone="warning" className="mt-2">Insufficient data</Badge><p className="mt-2 text-neutral-400">{intel.reason}</p></>
        ) : (
          <><Badge tone="info" className="mt-2">Finding · {humanizeLabel(intel.confidence)}</Badge><p className="mt-2">{intel.summary}</p></>
        )}
      </div>

      {(() => {
        const projected = agg._sum.projectedSavings ?? 0;
        const realized = agg._sum.realizedSavings ?? agg._sum.recoveredAnnual ?? 0;
        const gap = Math.max(0, projected - realized);
        const precision = projected > 0 ? Math.round((realized / projected) * 1000) / 10 : 0;
        const readinessAvg = items.length
          ? Math.round(
              items.reduce(
                (n, i) =>
                  n +
                  automationReadinessScore({
                    automationCandidate: i.automationCandidate,
                    score: i.score,
                    evidenceCount: i._count?.evidence ?? 0,
                    projectedSavings: i.projectedSavings || i.estimatedWasteAnnual,
                    priority: i.priority,
                  }),
                0
              ) / items.length
            )
          : 0;
        return (
          <>
            <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Savings realization ledger</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div><p className="text-[10px] uppercase text-neutral-500">{MONEY.projectedSavings.short}</p><p className="mt-1 text-xl font-semibold text-white">{formatCurrency(projected)}</p></div>
                <div><p className="text-[10px] uppercase text-neutral-500">{MONEY.realizedSavings.short}</p><p className="mt-1 text-xl font-semibold text-emerald-400">{formatCurrency(realized)}</p></div>
                <div><p className="text-[10px] uppercase text-neutral-500">Open gap</p><p className="mt-1 text-xl font-semibold text-amber-400">{formatCurrency(gap)}</p></div>
                <div><p className="text-[10px] uppercase text-neutral-500">Realization precision</p><p className="mt-1 text-xl font-semibold text-white">{precision}%</p><p className="text-[10px] text-neutral-600">realized ÷ projected</p></div>
              </div>
              <p className="mt-3 text-xs text-neutral-500">Projected is never treated as banked savings. Record realized outcomes only after verified execution.</p>
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
                title="Dept bottleneck heat"
                description="Estimated annual waste by department"
                data={chartData.heat}
                series={[{ key: "waste", label: "Waste / yr", color: CHART.violet }]}
                money
                layout="vertical"
                height={260}
                footnote={chartData.sourceNote}
              />
              <AnimatedGaugeBar
                title="Automation readiness"
                description="Average score for items in this view"
                value={readinessAvg || chartData.readiness}
                footnote="From candidate flag, confidence, evidence, impact, priority — not a promise automation ran"
              />
            </div>
          </>
        );
      })()}

      <div className="mt-6 flex flex-wrap gap-2">
        {Object.entries(VIEWS).map(([k, v]) => (
          <Link key={k} href={`/app/operations?view=${k}`}
            className={`rounded-full border px-3 py-1 text-xs ${view === k ? "border-amber-500 text-amber-400" : "border-neutral-800 text-neutral-400"}`}>
            {v.label}
          </Link>
        ))}
      </div>

      <div className="si-panel mt-6 overflow-hidden">
        {items.length === 0 ? (
          <EmptyState title="No inefficiencies in this view" />
        ) : (
          <Table>
            <THead><TR><TH>Title</TH><TH>Status</TH><TH>Priority</TH><TH>Est. waste/yr</TH><TH>Realized</TH><TH>Ready</TH><TH>Auto?</TH></TR></THead>
            <TBody>
              {items.map((i) => (
                <TR key={i.id}>
                  <TD>
                    <Link href={`/app/operations/${i.id}`} className="text-amber-400 hover:underline">{clientTitle(i.title)}</Link>
                    <div className="text-xs text-neutral-500">{[i.department, i.type].filter(Boolean).join(" · ") || "—"}{i.assignee ? ` · ${i.assignee.name || i.assignee.email}` : " · Unassigned"} · {ageDays(i.identifiedAt)}d</div>
                  </TD>
                  <TD><StatusBadge status={i.status} /></TD>
                  <TD><PriorityBadge priority={i.priority} /></TD>
                  <TD>{formatCurrency(i.estimatedWasteAnnual)}</TD>
                  <TD className="text-emerald-300">{formatCurrency(i.realizedSavings || i.recoveredAnnual)}</TD>
                  <TD>{automationReadinessScore({ automationCandidate: i.automationCandidate, score: i.score, evidenceCount: i._count?.evidence ?? 0, projectedSavings: i.projectedSavings || i.estimatedWasteAnnual, priority: i.priority })}</TD>
                  <TD>{i.automationCandidate ? "Yes" : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
