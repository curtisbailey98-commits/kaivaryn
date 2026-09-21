import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

export const dynamic = "force-dynamic";

/**
 * Executive Action Center — SI action_requests + approvals + RR/OE priorities.
 * Decisions are recorded; no external auto-execution.
 */
export default async function ActionCenterPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);

  const [pendingApprovals, criticalOpps, criticalIneff, recentAudit] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: { organizationId: ctx.organizationId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.opportunity.findMany({
      where: {
        organizationId: ctx.organizationId,
        priority: "CRITICAL",
        status: { in: ["NEW", "IN_PROGRESS"] },
      },
      orderBy: { estimatedAmount: "desc" },
      take: 10,
    }),
    prisma.inefficiency.findMany({
      where: {
        organizationId: ctx.organizationId,
        priority: "CRITICAL",
        status: { in: ["NEW", "IN_PROGRESS"] },
      },
      orderBy: { estimatedWasteAnnual: "desc" },
      take: 10,
    }),
    prisma.auditLog.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const empty =
    pendingApprovals.length === 0 &&
    criticalOpps.length === 0 &&
    criticalIneff.length === 0;

  return (
    <div>
      <p className="si-label text-amber-500">Executive</p>
      <h1 className="mt-1 text-2xl font-semibold">Action Center</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Unified queue: pending approvals (SI-gated), critical revenue opportunities, and critical
        operational inefficiencies. Approvals record decisions only — no external auto-execute.
      </p>
      {ctx.organization?.isDemo ? <Badge tone="demo" className="mt-3">DEMO</Badge> : null}

      {empty ? (
        <EmptyState
          className="mt-8"
          title="No open executive actions"
          description="Critical items and pending approvals will appear here."
        />
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pending approvals ({pendingApprovals.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {pendingApprovals.length === 0 ? (
              <p className="text-neutral-500">None pending</p>
            ) : (
              pendingApprovals.map((a) => (
                <div key={a.id} className="border-b border-neutral-900 pb-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="warning">{a.type}</Badge>
                    <Link href="/app/approvals" className="text-amber-400 hover:underline">
                      {a.title}
                    </Link>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">{formatDate(a.createdAt)}</p>
                </div>
              ))
            )}
            <Link href="/app/approvals" className="inline-block text-xs text-amber-400">
              Open approvals →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Critical revenue ({criticalOpps.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {criticalOpps.length === 0 ? (
              <p className="text-neutral-500">None</p>
            ) : (
              criticalOpps.map((o) => (
                <div key={o.id} className="flex justify-between border-b border-neutral-900 pb-2">
                  <Link href={`/app/revenue/${o.id}`} className="text-amber-400 hover:underline">
                    {o.title}
                  </Link>
                  <span className="text-neutral-400">{formatCurrency(o.estimatedAmount)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Critical operations ({criticalIneff.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {criticalIneff.length === 0 ? (
              <p className="text-neutral-500">None</p>
            ) : (
              criticalIneff.map((i) => (
                <div key={i.id} className="flex justify-between border-b border-neutral-900 pb-2">
                  <Link href={`/app/operations/${i.id}`} className="text-amber-400 hover:underline">
                    {i.title}
                  </Link>
                  <span className="text-neutral-400">{formatCurrency(i.estimatedWasteAnnual)}/yr</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent audit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-neutral-400">
            {recentAudit.map((a) => (
              <div key={a.id} className="flex justify-between gap-2 border-b border-neutral-900 py-1 font-mono">
                <span>{a.action}</span>
                <span>{formatDate(a.createdAt)}</span>
              </div>
            ))}
            {!recentAudit.length ? <p>No audit entries</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
