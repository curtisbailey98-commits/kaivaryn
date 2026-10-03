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
import { MONEY, MONEY_GLOSSARY_FOOTNOTE, RR_CLOSED_STATUSES, OE_CLOSED_STATUSES } from "@/lib/money-glossary";
import { ONBOARDING_STEPS } from "@/lib/constants";
import { clientTitle } from "@/lib/labels";
import { TrendingUp, Settings2, ShieldCheck, Bell, ArrowRight, CheckCircle2 } from "lucide-react";
import { getWeeklyBriefChartData, getActionCenterChartData } from "@/lib/chart-data";
import { DynBarChart, DynLineChart, KpiSpark } from "@/components/charts/dynamic";
import { CHART } from "@/components/charts/theme";
import { ActivityStrip, CountUp, CountUpCurrency } from "@/components/motion";
import { OperatingDesk } from "@/components/operate/operating-desk";
import { getInboxCounts } from "@/lib/operate/inbox";

export const metadata = { title: "Home" };

export default async function AppHomePage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const entitlements = await prisma.entitlement.findMany({
    where: { organizationId: ctx.organizationId, active: true },
  });
  const hasRevenue = entitlements.some((e) => e.product === "REVENUE_RECOVERY");
  const hasOps = entitlements.some((e) => e.product === "OPERATIONS_EFFICIENCY");
  const rrClosed = [...RR_CLOSED_STATUSES];
  const oeClosed = [...OE_CLOSED_STATUSES];

  const [revenue, operations, pendingApprovals, unreadNotifications, openTasks, learning, chartWeekly, chartAction, topOpportunities, topInefficiencies, highConfidenceRevenue, criticalOperations, onboarding, inboxCounts] = await Promise.all([
    prisma.opportunity.aggregate({
      where: { organizationId: ctx.organizationId },
      _sum: { estimatedAmount: true, potentialAmount: true, recoveredAmount: true, verifiedAmount: true, approvedAmount: true, inProgressAmount: true },
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
    getWeeklyBriefChartData(ctx.organizationId),
    getActionCenterChartData(ctx.organizationId),
    hasRevenue
      ? prisma.opportunity.findMany({
          where: { organizationId: ctx.organizationId, status: { notIn: rrClosed } },
          orderBy: [{ priority: "asc" }, { score: "desc" }],
          take: 3,
        })
      : Promise.resolve([]),
    hasOps
      ? prisma.inefficiency.findMany({
          where: { organizationId: ctx.organizationId, status: { notIn: oeClosed } },
          orderBy: [{ priority: "asc" }, { score: "desc" }],
          take: 3,
        })
      : Promise.resolve([]),
    hasRevenue
      ? prisma.opportunity.count({ where: { organizationId: ctx.organizationId, score: { gte: 70 }, status: { notIn: rrClosed } } })
      : Promise.resolve(0),
    hasOps
      ? prisma.inefficiency.count({ where: { organizationId: ctx.organizationId, priority: "CRITICAL", status: { notIn: oeClosed } } })
      : Promise.resolve(0),
    prisma.onboardingProgress.findUnique({
      where: { organizationId_userId: { organizationId: ctx.organizationId, userId: ctx.user.id } },
    }),
    getInboxCounts(ctx.organizationId, ctx.user.id),
  ]);
  const slaOpenCount = chartAction.slaSpark.at(-1)?.value ?? 0;
  const lastHealth = await prisma.opHealthCheck.findFirst({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" }, select: { status: true } });

  // Split KPIs — never mix RR cash with OE savings under one "Verified value"
  const pipelinePotential = revenue._sum.potentialAmount ?? revenue._sum.estimatedAmount ?? 0;
  const cashRecovered = revenue._sum.recoveredAmount ?? 0;
  const verifiedRecovered = revenue._sum.verifiedAmount ?? 0;
  const projectedSavings = operations._sum.projectedSavings ?? 0;
  const realizedSavings = operations._sum.realizedSavings ?? operations._sum.recoveredAnnual ?? 0;
  const projectedValue = pipelinePotential + projectedSavings;

  const topItems = [
    ...topOpportunities.map((o) => ({ id: o.id, title: clientTitle(o.title), priority: o.priority, amount: o.potentialAmount, href: `/app/revenue/${o.id}`, kind: "Revenue" as const })),
    ...topInefficiencies.map((i) => ({ id: i.id, title: clientTitle(i.title), priority: i.priority, amount: i.estimatedWasteAnnual, href: `/app/operations/${i.id}`, kind: "Operations" as const })),
  ]
    .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "CRITICAL" ? -1 : b.priority === "CRITICAL" ? 1 : 0))
    .slice(0, 5);

  const nextAction = pendingApprovals > 0
    ? { title: `Review ${pendingApprovals} pending approval${pendingApprovals === 1 ? "" : "s"}`, href: "/app/approvals", description: "Decisions are waiting on you before Kaivaryn can proceed." }
    : topItems[0]
    ? { title: `Review: ${topItems[0].title}`, href: topItems[0].href, description: `${topItems[0].kind} · ${topItems[0].priority} priority` }
    : { title: "Open the Action Center", href: "/app/action-center", description: "See everything ranked by urgency in one place." };

  const onboardingDone = Boolean(onboarding?.completedAt);
  const onboardingStepsDone: string[] = onboarding ? JSON.parse(onboarding.completedSteps || "[]") : [];
  const showOnboardingStrip = !onboardingDone && onboardingStepsDone.length < ONBOARDING_STEPS.length;

  // Open actions aligns with Action Center: open tasks (owned work) — notifications separate
  const openActionsCount = openTasks;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Command center"
        title={ctx.user.name ? `Welcome back, ${ctx.user.name.split(" ")[0]}` : "Executive command center"}
        description={ctx.organization?.name
          ? `${ctx.organization.name} — what needs attention, what it is worth, and what Kaivaryn recommends next.`
          : "What needs attention, what it is worth, and what Kaivaryn recommends next."}
        actions={ctx.organization?.isDemo ? <Badge tone="demo">Demo org</Badge> : undefined}
      />

      {showOnboardingStrip ? (
        <Link
          href="/app/onboarding"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 transition hover:border-amber-500/50"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Getting started</p>
            <p className="mt-0.5 text-sm text-neutral-200">
              Complete your workspace setup · {onboardingStepsDone.length}/{ONBOARDING_STEPS.length} steps done
            </p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-amber-400">Continue onboarding →</span>
        </Link>
      ) : null}

      <OperatingDesk organizationId={ctx.organizationId} userId={ctx.user.id} />

      <ActivityStrip
        items={[
          { id: "a", label: pendingApprovals > 0 ? `${pendingApprovals} approval${pendingApprovals === 1 ? "" : "s"} awaiting executive review` : "Approval gate clear · no pending decisions", tone: pendingApprovals > 0 ? "warn" : "ok" },
          { id: "b", label: openActionsCount > 0 ? `${openActionsCount} open team action${openActionsCount === 1 ? "" : "s"} in the Action Center` : "Action queue quiet · no open tasks", tone: openActionsCount > 0 ? "accent" : "ok" },
          { id: "c", label: unreadNotifications > 0 ? `${unreadNotifications} unread notification${unreadNotifications === 1 ? "" : "s"}` : "Notifications clear", tone: unreadNotifications > 0 ? "accent" : "ok" },
          { id: "d", label: lastHealth ? `Last health check ${lastHealth.status.toLowerCase()}` : "No health check recorded yet", tone: lastHealth?.status === "OK" ? "ok" : "warn" },
        ]}
      />

      {/* Same counts as the sidebar Inbox badge and the Inbox page (getInboxCounts). */}
      <AttentionBanner
        summary={inboxCounts.total > 0 ? { label: `${inboxCounts.total} in your Inbox`, href: "/app/inbox" } : undefined}
        items={[
          { label: "pending approvals", one: "pending approval", count: inboxCounts.approvals, href: "/app/approvals", tone: "warning" },
          { label: "action requests", one: "action request", count: inboxCounts.tasks, href: "/app/inbox?filter=TASK" },
          { label: "unread notifications", one: "unread notification", count: inboxCounts.notifications, href: "/app/inbox?filter=NOTIFICATION" },
          { label: "unread briefings", one: "unread briefing", count: inboxCounts.briefings, href: "/app/inbox?filter=BRIEFING" },
          { label: "runs needing a decision or retry", one: "run needing a decision or retry", count: inboxCounts.runs, href: "/app/inbox?filter=RUN" },
          { label: "failed standing orders", one: "failed standing order", count: inboxCounts.standingFailures, href: "/app/inbox?filter=STANDING_FAILURE", tone: "danger" },
        ]}
      />

      <NextBestAction title={nextAction.title} description={nextAction.description} href={nextAction.href} actionLabel="Review" />

      <section className="si-glass relative overflow-hidden rounded-2xl border border-neutral-800/90 bg-gradient-to-br from-neutral-950 to-neutral-900/40 p-4 sm:p-6" aria-labelledby="executive-brief-title">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">Executive brief</p>
            <h2 id="executive-brief-title" className="mt-2 text-xl font-semibold tracking-tight text-white">The value case, distilled.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
              Kaivaryn separates modeled opportunity from recorded outcomes — then ranks the decisions that move value into execution.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-80 sm:gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Projected value</p>
              <p className="mt-1 text-xl font-semibold text-white"><CountUpCurrency value={projectedValue} /></p>
              <p className="mt-0.5 text-[10px] text-neutral-600">Potential + projected savings</p>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">{MONEY.cashRecovered.label}</p>
                <p className="mt-0.5 text-lg font-semibold text-emerald-400"><CountUpCurrency value={cashRecovered} /></p>
                {verifiedRecovered > 0 ? (
                  <p className="text-[10px] text-neutral-500">{MONEY.verifiedRecovered.short}: {formatCurrency(verifiedRecovered)}</p>
                ) : null}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">{MONEY.realizedSavings.label}</p>
                <p className="mt-0.5 text-lg font-semibold text-emerald-400"><CountUpCurrency value={realizedSavings} /></p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-neutral-800 bg-neutral-800 sm:grid-cols-4">
          <Link href="/app/revenue?view=high_confidence" className="bg-neutral-950 p-3 sm:p-4 transition hover:bg-neutral-900">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">High-confidence</p>
            <p className="mt-2 text-2xl font-semibold text-white"><CountUp value={highConfidenceRevenue} /></p>
            <p className="mt-1 text-xs text-neutral-500">Open · score 70+</p>
          </Link>
          <Link href="/app/operations?view=critical" className="bg-neutral-950 p-3 sm:p-4 transition hover:bg-neutral-900">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Critical signals</p>
            <p className="mt-2 text-2xl font-semibold text-white"><CountUp value={criticalOperations} /></p>
            <p className="mt-1 text-xs text-neutral-500">Unresolved · critical</p>
          </Link>
          <Link href="/app/approvals" className="bg-neutral-950 p-3 sm:p-4 transition hover:bg-neutral-900">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Approvals</p>
            <p className="mt-2 text-2xl font-semibold text-white"><CountUp value={pendingApprovals} /></p>
            <p className="mt-1 text-xs text-neutral-500">Pending decisions</p>
          </Link>
          <Link href="/app/action-center?triage=sla_risk" className="bg-neutral-950 p-3 sm:p-4 transition hover:bg-neutral-900">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">SLA risk</p>
            <p className="mt-2 text-2xl font-semibold text-white"><CountUp value={slaOpenCount} /></p>
            <p className="mt-1 text-xs text-neutral-500">Open · aging / breach</p>
          </Link>
        </div>
        <p className="mt-3 text-[10px] text-neutral-600">{MONEY_GLOSSARY_FOOTNOTE}</p>
      </section>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">Value in motion</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={MONEY.pipelinePotential.label}
            value={<CountUpCurrency value={pipelinePotential} />}
            sublabel={`${revenue._count} opportunities · ${formatCurrency(cashRecovered)} cash recovered`}
            icon={TrendingUp}
            tone="accent"
            href="/app/revenue"
          />
          <MetricCard
            label={MONEY.projectedSavings.label}
            value={<CountUpCurrency value={projectedSavings} />}
            sublabel={`${operations._count} inefficiencies · ${formatCurrency(realizedSavings)} realized`}
            icon={Settings2}
            tone="accent"
            href="/app/operations"
          />
          <MetricCard
            label="Pending approvals"
            value={<CountUp value={pendingApprovals} />}
            sublabel="Decisions awaiting review"
            icon={ShieldCheck}
            tone={pendingApprovals > 0 ? "danger" : "default"}
            href="/app/approvals"
          />
          <MetricCard
            label="Open team actions"
            value={<CountUp value={openActionsCount} />}
            sublabel="Action Center · all owners"
            icon={Bell}
            href="/app/action-center"
          />
        </div>
      </div>

      <section aria-labelledby="value-motion-title" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p id="value-motion-title" className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">Value motion · estimated vs realized</p>
          <p className="text-[10px] text-neutral-600">Shown separately on purpose — estimates are never added to recorded outcomes.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <DynLineChart
            title="Estimated value identified"
            description="Running total of modeled opportunity — RR potential and OE projected savings. Not cash."
            badge={{ label: "Estimated", tone: "estimate" }}
            data={chartWeekly.estimated}
            series={[
              { key: "rrPotential", label: "RR potential (est.)", color: CHART.amber },
              { key: "oeProjected", label: "OE projected savings (est.)", color: CHART.sky },
            ]}
            money
            dashed
            height={260}
            footnote={chartWeekly.cumulativeNote}
            emptyLabel="No opportunities identified yet"
            stagger={0}
          />
          <DynLineChart
            title="Realized value recorded"
            description="Running total of recorded outcomes — cash recovered and realized savings."
            badge={{ label: "Realized", tone: "realized" }}
            data={chartWeekly.realized}
            series={[
              { key: "cashRecovered", label: "Cash recovered", color: CHART.emerald },
              { key: "realizedSavings", label: "Realized savings", color: CHART.silver },
            ]}
            money
            height={260}
            footnote="Recorded outcomes only, dated when the recovery or savings was recorded."
            emptyLabel="No realized outcomes recorded yet"
            stagger={1}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <DynBarChart
          title="Open work by aging"
          description="Current open items across aging buckets"
          footnote={chartAction.sourceNote}
          data={chartAction.aging}
          series={[{ key: "count", label: "Open items", color: CHART.amber }]}
          height={200}
          stagger={2}
        />
        <KpiSpark
          label="SLA risk"
          value={chartAction.slaSpark.at(-1)?.value ?? 0}
          delta={(chartAction.slaSpark.at(-1)?.value ?? 0) - (chartAction.slaSpark.at(-2)?.value ?? 0)}
          deltaLabel="vs prior week"
          data={chartAction.slaSpark}
          color={CHART.rose}
          footnote={chartAction.sourceNote}
          stagger={3}
        />
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
          <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> What improved</CardTitle>
          <CardDescription>Tenant patterns from recorded outcomes only — aligned with the recovery and savings ledger.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3 text-xs text-neutral-400">
            {learning.length ? (
              learning.map((profile) => (
                <span key={profile.product} className="rounded-md border border-emerald-500/20 px-3 py-2">
                  <span className="text-white">{profile.product === "REVENUE_RECOVERY" ? "Revenue" : "Operations"}</span> · {profile.sampleSize} outcomes · {profile.confidence.toLowerCase()} confidence
                </span>
              ))
            ) : (
              <span>No verified outcomes yet — the workspace learns as your team records results.</span>
            )}
          </div>
          <Link href="/app/learning" className="text-xs text-emerald-400 hover:text-emerald-300">
            What improved / what&apos;s next →
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
