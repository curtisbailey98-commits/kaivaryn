import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { analyzeOperationsSignals } from "@/lib/intelligence";
import { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Clock3, Cog, Gauge, ShieldCheck } from "lucide-react";

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

  const [items, agg, autoCount, criticalCount, pendingApprovals, hours] = await Promise.all([
    prisma.inefficiency.findMany({
      where,
      orderBy: [{ score: "desc" }, { projectedSavings: "desc" }],
      take: 200,
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

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Annualized inefficiency" value={formatCurrency(agg._sum.estimatedWasteAnnual ?? 0)} sublabel="Modeled cost exposure" icon={Gauge} tone="accent" />
        <MetricCard label="Addressable savings" value={formatCurrency(agg._sum.projectedSavings ?? 0)} sublabel={`${criticalCount} critical signals`} icon={Cog} />
        <MetricCard label="Realized savings" value={formatCurrency(agg._sum.realizedSavings ?? agg._sum.recoveredAnnual ?? 0)} sublabel="Recorded outcomes only" icon={ShieldCheck} tone="success" />
        <MetricCard label="Time opportunity" value={`${(hours._sum.projectedHoursWeekly ?? 0).toFixed(1)}h`} sublabel={`${autoCount} automation candidates · weekly`} icon={Clock3} />
      </div>
      <p className="mt-2 text-xs text-neutral-500">Projected and realized value remain separate. High-impact execution is approval-gated.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link href="/app/operations?view=critical" className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4"><p className="text-[10px] uppercase tracking-wider text-red-300">Immediate attention</p><p className="mt-2 text-2xl font-semibold text-white">{criticalCount}</p><p className="mt-1 text-xs text-neutral-500">Critical unresolved bottlenecks</p></Link>
        <Link href="/app/approvals" className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4"><p className="text-[10px] uppercase tracking-wider text-amber-300">Decision queue</p><p className="mt-2 text-2xl font-semibold text-white">{pendingApprovals}</p><p className="mt-1 text-xs text-neutral-500">Actions awaiting approval</p></Link>
        <Link href="/app/operations?view=automation" className="rounded-xl border border-neutral-800 bg-neutral-950 p-4"><p className="text-[10px] uppercase tracking-wider text-neutral-500">Execution readiness</p><p className="mt-2 text-2xl font-semibold text-white">{autoCount}</p><p className="mt-1 text-xs text-neutral-500">Automation candidates identified</p></Link>
      </div>

      <div className="si-glass mt-6 p-4 text-sm">
        <p className="si-label">Intelligence</p>
        {intel.status === "INSUFFICIENT_DATA" ? (
          <><Badge tone="warning" className="mt-2">INSUFFICIENT_DATA</Badge><p className="mt-2 text-neutral-400">{intel.reason}</p></>
        ) : (
          <><Badge tone="info" className="mt-2">FINDING · {intel.confidence}</Badge><p className="mt-2">{intel.summary}</p></>
        )}
      </div>

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
            <THead><TR><TH>Title</TH><TH>Status</TH><TH>Priority</TH><TH>Est. waste/yr</TH><TH>Recovered</TH><TH>Auto?</TH></TR></THead>
            <TBody>
              {items.map((i) => (
                <TR key={i.id}>
                  <TD><Link href={`/app/operations/${i.id}`} className="text-amber-400 hover:underline">{i.title}</Link></TD>
                  <TD><Badge>{i.status}</Badge></TD>
                  <TD><Badge tone={i.priority === "CRITICAL" ? "danger" : "default"}>{i.priority}</Badge></TD>
                  <TD>{formatCurrency(i.estimatedWasteAnnual)}</TD>
                  <TD className="text-emerald-300">{formatCurrency(i.recoveredAnnual)}</TD>
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
