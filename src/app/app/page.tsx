import Link from "next/link";
import { requireOrgAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { assertOrgId } from "@/lib/tenant";
import { getLearningSummary } from "@/lib/learning";

export default async function AppHomePage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const entitlements = await prisma.entitlement.findMany({
    where: { organizationId: ctx.organizationId, active: true },
  });
  const hasRevenue = entitlements.some((e) => e.product === "REVENUE_RECOVERY");
  const hasOps = entitlements.some((e) => e.product === "OPERATIONS_EFFICIENCY");
  const [revenue, operations, pendingApprovals, unreadNotifications, openTasks, learning] = await Promise.all([
    prisma.opportunity.aggregate({
      where: { organizationId: ctx.organizationId },
      _sum: { estimatedAmount: true, recoveredAmount: true },
      _count: true,
    }),
    prisma.inefficiency.aggregate({
      where: { organizationId: ctx.organizationId },
      _sum: { estimatedWasteAnnual: true, recoveredAnnual: true },
      _count: true,
    }),
    prisma.approvalRequest.count({ where: { organizationId: ctx.organizationId, status: "PENDING" } }),
    prisma.notification.count({ where: { organizationId: ctx.organizationId, userId: ctx.user.id, readAt: null } }),
    prisma.task.count({ where: { organizationId: ctx.organizationId, status: "OPEN" } }),
    getLearningSummary(ctx.organizationId),
  ]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Command center</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Choose a product. {ctx.organization?.isDemo ? <Badge tone="demo">DEMO org</Badge> : null}
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle>Recovery pipeline</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-semibold text-amber-400">{formatCurrency(revenue._sum.estimatedAmount ?? 0)}</p>
            <p className="mt-1 text-xs text-neutral-500">{revenue._count} opportunities · {formatCurrency(revenue._sum.recoveredAmount ?? 0)} recovered</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Annual waste</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-semibold text-amber-400">{formatCurrency(operations._sum.estimatedWasteAnnual ?? 0)}</p>
            <p className="mt-1 text-xs text-neutral-500">{operations._count} inefficiencies · {formatCurrency(operations._sum.recoveredAnnual ?? 0)} recovered</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pending approvals</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{pendingApprovals}</p>
            <Link href="/app/approvals" className="mt-1 inline-block text-xs text-amber-400 hover:underline">Review decisions →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Open actions</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{openTasks + unreadNotifications}</p>
            <p className="mt-1 text-xs text-neutral-500">{openTasks} tasks · {unreadNotifications} unread notifications</p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/app/action-center" className="rounded-md bg-amber-500 px-3 py-2 font-semibold text-neutral-950">Open Action Center →</Link>
        <Link href="/api/summary" className="rounded-md border border-neutral-700 px-3 py-2 text-neutral-300">View summary API</Link>
      </div>
      <Card className="mt-4 border-emerald-500/20 bg-emerald-500/[0.04]">
        <CardHeader><CardTitle>Learning loop</CardTitle><CardDescription>Tenant-specific patterns built only from recorded outcomes.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3 text-xs text-neutral-400">{learning.length ? learning.map((profile) => <span key={profile.product} className="rounded-md border border-emerald-500/20 px-3 py-2"><span className="text-white">{profile.product === "REVENUE_RECOVERY" ? "Revenue" : "Operations"}</span> · {profile.sampleSize} outcomes · {profile.confidence} confidence</span>) : <span>No verified outcomes yet — the brain learns as your team records results.</span>}</div>
          <Link href="/api/learning/summary" className="text-xs text-emerald-400 hover:text-emerald-300">View learned profile →</Link>
        </CardContent>
      </Card>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className={!hasRevenue ? "opacity-60" : undefined}>
          <CardHeader>
            <CardTitle>Revenue Recovery</CardTitle>
            <CardDescription>
              {hasRevenue ? "Entitlement active" : "No active entitlement — activate via engagement"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasRevenue ? (
              <Link href="/app/revenue" className="text-sm text-amber-400 hover:text-amber-300">
                Open Revenue Recovery →
              </Link>
            ) : (
              <Link href="/pricing" className="text-sm text-neutral-400 hover:text-white">
                View pricing →
              </Link>
            )}
          </CardContent>
        </Card>
        <Card className={!hasOps ? "opacity-60" : undefined}>
          <CardHeader>
            <CardTitle>Operations Efficiency</CardTitle>
            <CardDescription>
              {hasOps ? "Entitlement active" : "No active entitlement — activate via engagement"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasOps ? (
              <Link href="/app/operations" className="text-sm text-amber-400 hover:text-amber-300">
                Open Operations Efficiency →
              </Link>
            ) : (
              <Link href="/pricing" className="text-sm text-neutral-400 hover:text-white">
                View pricing →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 flex flex-wrap gap-4 text-sm text-neutral-400">
        <Link href="/app/integrations" className="hover:text-white">Integrations</Link>
        <Link href="/app/approvals" className="hover:text-white">Approvals</Link>
        <Link href="/app/onboarding" className="hover:text-white">Onboarding</Link>
      </div>
    </div>
  );
}
