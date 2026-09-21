import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { analyzeRevenueSignals } from "@/lib/intelligence";
import { Prisma } from "@prisma/client";
import { OpportunityPriority, OpportunityStatus } from "@/lib/enums";

export const dynamic = "force-dynamic";

const VIEWS: Record<string, { label: string; where?: Prisma.OpportunityWhereInput }> = {
  all: { label: "All" },
  critical: { label: "Critical", where: { priority: "CRITICAL" } },
  high_value: { label: "High Value", where: { estimatedAmount: { gte: 50000 } } },
  new: { label: "New", where: { status: "NEW" } },
  in_progress: { label: "In Progress", where: { status: "IN_PROGRESS" } },
  recovered: { label: "Recovered", where: { status: "RECOVERED" } },
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

  const [opps, agg] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      orderBy: [{ priority: "asc" }, { estimatedAmount: "desc" }],
      include: { assignee: { select: { name: true, email: true } } },
      take: 200,
    }),
    prisma.opportunity.aggregate({
      where: { organizationId: ctx.organizationId },
      _sum: { estimatedAmount: true, recoveredAmount: true },
      _count: true,
    }),
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="si-label text-amber-500">Product</p>
          <h1 className="mt-1 text-2xl font-semibold">Revenue Recovery</h1>
          {ctx.organization?.isDemo ? <Badge tone="demo" className="mt-2">DEMO data</Badge> : null}
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/app/revenue/new" className="rounded-md bg-amber-500 px-3 py-2 font-semibold text-neutral-950">
            New opportunity
          </Link>
          <Link href="/app/revenue/analytics" className="rounded-md border border-neutral-700 px-3 py-2">
            Analytics
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Estimated pipeline</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-amber-400">{formatCurrency(estimated)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recovered</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-400">{formatCurrency(recovered)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Open opportunities</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{agg._count}</CardContent>
        </Card>
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
            className={`rounded-full border px-3 py-1 text-xs ${
              view === k ? "border-amber-500 text-amber-400" : "border-neutral-800 text-neutral-400"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <form className="mt-4 grid gap-2 sm:grid-cols-6 text-xs">
        <input type="hidden" name="view" value={view} />
        <input name="source" placeholder="Source" defaultValue={searchParams.source} className="h-9 rounded-md border border-neutral-700 bg-neutral-950 px-2" />
        <input name="dept" placeholder="Department" defaultValue={searchParams.dept} className="h-9 rounded-md border border-neutral-700 bg-neutral-950 px-2" />
        <input name="type" placeholder="Type" defaultValue={searchParams.type} className="h-9 rounded-md border border-neutral-700 bg-neutral-950 px-2" />
        <input name="from" type="date" defaultValue={searchParams.from} className="h-9 rounded-md border border-neutral-700 bg-neutral-950 px-2" />
        <input name="to" type="date" defaultValue={searchParams.to} className="h-9 rounded-md border border-neutral-700 bg-neutral-950 px-2" />
        <button type="submit" className="h-9 rounded-md border border-neutral-700 px-3">Filter</button>
      </form>

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
                <TH>Recovered</TH>
                <TH>Identified</TH>
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
                  <TD><Badge>{o.status}</Badge></TD>
                  <TD><Badge tone={o.priority === "CRITICAL" ? "danger" : o.priority === "HIGH" ? "warning" : "default"}>{o.priority}</Badge></TD>
                  <TD>{formatCurrency(o.estimatedAmount)}</TD>
                  <TD className="text-emerald-300">{formatCurrency(o.recoveredAmount)}</TD>
                  <TD>{formatDate(o.identifiedAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
