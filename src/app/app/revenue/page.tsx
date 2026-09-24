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

export const dynamic = "force-dynamic";

const VIEWS: Record<string, { label: string; where?: Prisma.OpportunityWhereInput }> = {
  all: { label: "All" },
  critical: { label: "Critical", where: { priority: "CRITICAL" } },
  high_value: { label: "High Value", where: { potentialAmount: { gte: 50000 } } },
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
  if (searchParams.source) where.source = { contains: searchParams.source };
  if (searchParams.dept) where.department = { contains: searchParams.dept };
  if (searchParams.type) where.type = { contains: searchParams.type };
  if (searchParams.from || searchParams.to) {
    where.identifiedAt = {};
    if (searchParams.from) where.identifiedAt.gte = new Date(searchParams.from);
    if (searchParams.to) where.identifiedAt.lte = new Date(searchParams.to);
  }

  const [opps, agg, highConfidence, pendingApprovals] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      orderBy: [{ score: "desc" }, { potentialAmount: "desc" }],
      include: { assignee: { select: { name: true, email: true } } },
      take: 200,
    }),
    prisma.opportunity.aggregate({
      where: { organizationId: ctx.organizationId },
      _sum: { estimatedAmount: true, approvedAmount: true, inProgressAmount: true, recoveredAmount: true, verifiedAmount: true },
      _count: true,
    }),
    prisma.opportunity.count({ where: { organizationId: ctx.organizationId, score: { gte: 70 }, status: { notIn: ["RECOVERED", "VERIFIED", "DISMISSED"] } } }),
    prisma.approvalRequest.count({ where: { organizationId: ctx.organizationId, status: "PENDING" } }),
  ]);

  const sources = Array.from(new Set(opps.map((o) => o.source).filter(Boolean) as string[]));
  const intel = analyzeRevenueSignals({
    opportunityCount: agg._count,
    totalEstimated: agg._sum.estimatedAmount ?? 0,
    totalRecovered: agg._sum.recoveredAmount ?? 0,
    sources,
  });

  const estimated = agg._sum.estimatedAmount ?? 0;
  const recovered = agg._sum.recoveredAmount ?? 0;

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
        <MetricCard label="Potential recoverable revenue" value={formatCurrency(estimated)} sublabel={`${agg._count} identified opportunities`} icon={CircleDollarSign} tone="accent" />
        <MetricCard label="High-confidence opportunity" value={highConfidence} sublabel="Open opportunities scoring 70+" icon={Crosshair} />
        <MetricCard label="Value in intervention" value={formatCurrency(agg._sum.inProgressAmount ?? 0)} sublabel={`${formatCurrency(agg._sum.approvedAmount ?? 0)} approved`} icon={TrendingUp} />
        <MetricCard label="Verified recovery" value={formatCurrency(agg._sum.verifiedAmount ?? recovered)} sublabel={`${pendingApprovals} executive decisions pending`} icon={ShieldCheck} tone="success" />
      </div>
      <p className="mt-2 text-xs text-neutral-500">Estimated and recovered are always separate metrics.</p>

      <div className="si-glass mt-6 p-4 text-sm">
        <p className="si-label">Intelligence</p>
        {intel.status === "INSUFFICIENT_DATA" ? (
          <div className="mt-2">
            <Badge tone="warning">INSUFFICIENT_DATA</Badge>
            <p className="mt-2 text-neutral-400">{intel.reason}</p>
          </div>
        ) : (
          <div className="mt-2">
            <Badge tone="info">FINDING · {intel.confidence}</Badge>
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
                <TH>Estimated</TH>
                <TH className="hidden sm:table-cell">Recovered</TH>
                <TH className="hidden md:table-cell">Identified</TH>
              </TR>
            </THead>
            <TBody>
              {opps.map((o) => (
                <TR key={o.id}>
                  <TD>
                    <Link href={`/app/revenue/${o.id}`} className="text-amber-400 hover:underline">
                      {o.title}
                    </Link>
                    <div className="text-xs text-neutral-500">{[o.source, o.department, o.type].filter(Boolean).join(" · ")}</div>
                  </TD>
                  <TD><StatusBadge status={o.status} /></TD>
                  <TD><PriorityBadge priority={o.priority} /></TD>
                  <TD>
                    {formatCurrency(o.potentialAmount || o.estimatedAmount)} <span className="text-xs text-neutral-500">s{Math.round(o.score)}</span>
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
