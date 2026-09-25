import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, PriorityBadge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { AttentionBanner, NextBestAction } from "@/components/ui/attention";
import { EmptyState } from "@/components/ui/states";
import { getLearningSummary } from "@/lib/learning";
import { TrendingUp, Settings2, ShieldCheck, Bell, ArrowRight } from "lucide-react";

export default async function AppHomePage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const entitlements = await prisma.entitlement.findMany({
    where: { organizationId: ctx.organizationId, active: true },
  });
  const hasRevenue = entitlements.some((e) => e.product === "REVENUE_RECOVERY");
  const hasOps = entitlements.some((e) => e.product === "OPERATIONS_EFFICIENCY");
  const [revenue, operations, pendingApprovals, unreadNotifications, openTasks, learning, topOpportunities, topInefficiencies, highConfidenceRevenue, criticalOperations] = await Promise.all([
    prisma.opportunity.aggregate({
      where: { organizationId: ctx.organizationId },
      _sum: { estimatedAmount: true, recoveredAmount: true, verifiedAmount: true },
      _count: true,
    }),
    prisma.inefficiency.aggregate({
      where: { organizationId: ctx.organizationId },
      _sum: { estimatedWasteAnnual: true, projectedSavings: true, recoveredAnnual: true, realizedSavings: true },
      _count: true,
    }),
    prisma.approvalRequest.count({ where: { organizationId: ctx.organizationId, status: "PENDING" } }),
    prisma.notification.count({ where: { organizationId: ctx.organizationId, userId: ctx.user.id, readAt: null } }),
    prisma.task.count({ where: { organizationId: ctx.organizationId, status: "OPEN" } }),
    getLearningSummary(ctx.organizationId),
    hasRevenue
      ? prisma.opportunity.findMany({
          where: { organizationId: ctx.organizationId, status: { notIn: ["RECOVERED", "VERIFIED", "DISMISSED"] } },
          orderBy: [{ priority: "asc" }, { score: "desc" }],
          take: 3,
        })
      : Promise.resolve([]),
    hasOps
      ? prisma.inefficiency.findMany({
          where: { organizationId: ctx.organizationId, status: { notIn: ["REALIZED", "VERIFIED", "DISMISSED"] } },
          orderBy: [{ priority: "asc" }, { score: "desc" }],
          take: 3,
        })
      : Promise.resolve([]),
    hasRevenue
      ? prisma.opportunity.count({ where: { organizationId: ctx.organizationId, score: { gte: 70 }, status: { notIn: ["RECOVERED", "VERIFIED", "DISMISSED"] } } })
      : Promise.resolve(0),
    hasOps
      ? prisma.inefficiency.count({ where: { organizationId: ctx.organizationId, priority: "CRITICAL", status: { notIn: ["REALIZED", "VERIFIED", "RESOLVED", "DISMISSED"] } } })
      : Promise.resolve(0),
  ]);

  const projectedValue = (revenue._sum.estimatedAmount ?? 0) + (operations._sum.projectedSavings ?? 0);
  const verifiedValue = (revenue._sum.verifiedAmount ?? revenue._sum.recoveredAmount ?? 0) + (operations._sum.realizedSavings ?? operations._sum.recoveredAnnual ?? 0);

  const topItems = [
    ...topOpportunities.map((o) => ({ id: o.id, title: o.title, priority: o.priority, amount: o.potentialAmount, href: `/app/revenue/${o.id}`, kind: "Revenue" as const })),
    ...topInefficiencies.map((i) => ({ id: i.id, title: i.title, priority: i.priority, amount: i.estimatedWasteAnnual, href: `/app/operations/${i.id}`, kind: "Operations" as const })),
  ]
    .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "CRITICAL" ? -1 : b.priority === "CRITICAL" ? 1 : 0))
    .slice(0, 5);

  const nextAction = pendingApprovals > 0
    ? { title: `Review ${pendingApprovals} pending approval${pendingApprovals === 1 ? "" : "s"}`, href: "/app/approvals", description: "Decisions are waiting on you before Kaivaryn can proceed." }
    : topItems[0]
    ? { title: `Review: ${topItems[0].title}`, href: topItems[0].href, description: `${topItems[0].kind} · ${topItems[0].priority} priority` }
    : { title: "Open the Action Center", href: "/app/action-center", description: "See everything ranked by urgency in one place." };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Command center"
        title={ctx.user.name ? `Welcome back, ${ctx.user.name.split(" ")[0]}` : "Executive command center"}
        description={ctx.organization?.name
          ? `${ctx.organization.name} — what needs attention, what it is worth, and what Kaivaryn recommends next.`
          : "What needs attention, what it is worth, and what Kaivaryn recommends next."}
        actions={ctx.organization?.isDemo ? <Badge tone="demo">DEMO org</Badge> : undefined}
      />

      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">What needs my attention</p>
      <AttentionBanner
        items={[
          { label: "pending approvals", count: pendingApprovals, href: "/app/approvals", tone: "warning" },
          { label: "open tasks", count: openTasks, href: "/app/action-center" },
          { label: "unread notifications", count: unreadNotifications, href: "/app/notifications" },
        ]}
      />

      <NextBestAction title={nextAction.title} description={nextAction.description} href={nextAction.href} actionLabel="Review" />

      <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 to-neutral-900/50 p-5 sm:p-6" aria-labelledby="executive-brief-title">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">Executive brief</p>
            <h2 id="executive-brief-title" className="mt-2 text-xl font-semibold tracking-tight text-white">The value case, distilled.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Kaivaryn separates modeled opportunity from verified results, then ranks the decisions that can move value into execution.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:min-w-72">
            <div><p className="text-[10px] uppercase tracking-wider text-neutral-500">Projected value</p><p className="mt-1 text-xl font-semibold text-white">{formatCurrency(projectedValue)}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-neutral-500">Verified value</p><p className="mt-1 text-xl font-semibold text-emerald-400">{formatCurrency(verifiedValue)}</p></div>
          </div>
        </div>
        <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-neutral-800 bg-neutral-800 sm:grid-cols-3">
          <Link href="/app/revenue?view=high_confidence" className="bg-neutral-950 p-4 transition hover:bg-neutral-900"><p className="text-[10px] uppercase tracking-wider text-neutral-500">High-confidence recovery</p><p className="mt-2 text-2xl font-semibold text-white">{highConfidenceRevenue}</p><p className="mt-1 text-xs text-neutral-500">Open opportunities scoring 70+</p></Link>
          <Link href="/app/operations?view=critical" className="bg-neutral-950 p-4 transition hover:bg-neutral-900"><p className="text-[10px] uppercase tracking-wider text-neutral-500">Critical operational signals</p><p className="mt-2 text-2xl font-semibold text-white">{criticalOperations}</p><p className="mt-1 text-xs text-neutral-500">Unresolved items requiring attention</p></Link>
          <Link href="/app/approvals" className="bg-neutral-950 p-4 transition hover:bg-neutral-900"><p className="text-[10px] uppercase tracking-wider text-neutral-500">Executive decisions</p><p className="mt-2 text-2xl font-semibold text-white">{pendingApprovals}</p><p className="mt-1 text-xs text-neutral-500">Approval-gated actions waiting</p></Link>
        </div>
      </section>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">Value in motion</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Recovery pipeline"
            value={formatCurrency(revenue._sum.estimatedAmount ?? 0)}
            sublabel={`${revenue._count} opportunities · ${formatCurrency(revenue._sum.recoveredAmount ?? 0)} recovered`}
            icon={TrendingUp}
            tone="accent"
            href="/app/revenue"
          />
          <MetricCard
            label="Annual waste identified"
            value={formatCurrency(operations._sum.estimatedWasteAnnual ?? 0)}
            sublabel={`${operations._count} inefficiencies · ${formatCurrency(operations._sum.recoveredAnnual ?? 0)} recovered`}
            icon={Settings2}
            tone="accent"
            href="/app/operations"
          />
          <MetricCard
            label="Pending approvals"
            value={pendingApprovals}
            sublabel="Decisions awaiting review"
            icon={ShieldCheck}
            tone={pendingApprovals > 0 ? "danger" : "default"}
            href="/app/approvals"
          />
          <MetricCard
            label="Open actions"
            value={openTasks + unreadNotifications}
            sublabel={`${openTasks} tasks · ${unreadNotifications} unread`}
            icon={Bell}
            href="/app/notifications"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">What Kaivaryn identified</p>
          <Link href="/app/findings" className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300">
            View all findings <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {topItems.length === 0 ? (
          <EmptyState title="No open findings yet" description="Import data or wait for the next detection run — new opportunities and inefficiencies will surface here first." />
        ) : (
          <Card className="divide-y divide-neutral-900 overflow-hidden p-0">
            {topItems.map((item) => (
              <Link key={`${item.kind}-${item.id}`} href={item.href} className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-neutral-900/60">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{item.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{item.kind}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-sm text-neutral-300 sm:inline">{formatCurrency(item.amount ?? 0)}</span>
                  <PriorityBadge priority={item.priority} />
                </div>
              </Link>
            ))}
          </Card>
        )}
      </div>

      <Card className="border-emerald-500/20 bg-emerald-500/[0.04]">
        <CardHeader>
          <CardTitle>Learning loop</CardTitle>
          <CardDescription>Tenant-specific patterns built only from recorded outcomes.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3 text-xs text-neutral-400">
            {learning.length ? (
              learning.map((profile) => (
                <span key={profile.product} className="rounded-md border border-emerald-500/20 px-3 py-2">
                  <span className="text-white">{profile.product === "REVENUE_RECOVERY" ? "Revenue" : "Operations"}</span> · {profile.sampleSize} outcomes · {profile.confidence} confidence
                </span>
              ))
            ) : (
              <span>No verified outcomes yet — the brain learns as your team records results.</span>
            )}
          </div>
          <Link href="/app/learning" className="text-xs text-emerald-400 hover:text-emerald-300">
            View learned profile →
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className={!hasRevenue ? "opacity-60" : undefined}>
          <CardHeader>
            <CardTitle>Revenue Recovery</CardTitle>
            <CardDescription>{hasRevenue ? "Entitlement active" : "No active entitlement — activate via engagement"}</CardDescription>
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
            <CardDescription>{hasOps ? "Entitlement active" : "No active entitlement — activate via engagement"}</CardDescription>
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
    </div>
  );
}
