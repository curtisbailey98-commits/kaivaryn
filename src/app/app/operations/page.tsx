import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { analyzeOperationsSignals } from "@/lib/intelligence";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const VIEWS: Record<string, { label: string; where?: Prisma.InefficiencyWhereInput }> = {
  all: { label: "All" },
  critical: { label: "Critical", where: { priority: "CRITICAL" } },
  automation: { label: "Automation candidates", where: { automationCandidate: true } },
  new: { label: "New", where: { status: "NEW" } },
  in_progress: { label: "In Progress", where: { status: "IN_PROGRESS" } },
  resolved: { label: "Resolved", where: { status: "RESOLVED" } },
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

  const [items, agg, autoCount] = await Promise.all([
    prisma.inefficiency.findMany({
      where,
      orderBy: [{ priority: "asc" }, { estimatedWasteAnnual: "desc" }],
      take: 200,
    }),
    prisma.inefficiency.aggregate({
      where: { organizationId: ctx.organizationId },
      _sum: { estimatedWasteAnnual: true, recoveredAnnual: true },
      _count: true,
    }),
    prisma.inefficiency.count({
      where: { organizationId: ctx.organizationId, automationCandidate: true },
    }),
  ]);

  const intel = analyzeOperationsSignals({
    inefficiencyCount: agg._count,
    totalEstimatedWaste: agg._sum.estimatedWasteAnnual ?? 0,
    automationCandidates: autoCount,
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="si-label text-amber-500">Product</p>
          <h1 className="mt-1 text-2xl font-semibold">Operations Efficiency</h1>
          {ctx.organization?.isDemo ? <Badge tone="demo" className="mt-2">DEMO data</Badge> : null}
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/app/operations/new" className="rounded-md bg-amber-500 px-3 py-2 font-semibold text-neutral-950">New inefficiency</Link>
          <Link href="/app/operations/analytics" className="rounded-md border border-neutral-700 px-3 py-2">Analytics</Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Est. annual waste</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-amber-400">{formatCurrency(agg._sum.estimatedWasteAnnual ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recovered efficiency</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-400">{formatCurrency(agg._sum.recoveredAnnual ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Automation candidates</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{autoCount}</CardContent>
        </Card>
      </div>
      <p className="mt-2 text-xs text-neutral-500">Automation is approval-gated — never auto-executed externally (SI pattern).</p>

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
