import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PriorityBadge, StatusBadge, ExampleDataTag } from "@/components/ui/badge";
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
      _sum: { estimatedWasteAnnual: true, projectedSavings: true, recoveredAnnual: true, realizedSavings: true, projectedHoursWeekly: true, realizedHoursWeekly: true },
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
          orderBy: [{ potentialAmount: "desc" }, { score: "desc" }],
          take: 5,
          include: { assignee: { select: { name: true, email: true } } },
        })
      : Promise.resolve([]),
    hasOps
      ? prisma.inefficiency.findMany({
          where: { organizationId: ctx.organizationId, status: { notIn: oeClosed } },
          orderBy: [{ estimatedWasteAnnual: "desc" }, { score: "desc" }],
          take: 5,
          include: { assignee: { select: { name: true, email: true } } },
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

  const topItems = [
    ...topOpportunities.map((o) => ({ id: o.id, title: clientTitle(o.title), priority: o.priority, status: o.status, amount: o.potentialAmount || o.estimatedAmount, amountSuffix: "", href: `/app/revenue/${o.id}`, kind: "Revenue" as const, owner: o.assignee?.name || o.assignee?.email || null })),
    ...topInefficiencies.map((i) => ({ id: i.id, title: clientTitle(i.title), priority: i.priority, status: i.status, amount: i.estimatedWasteAnnual, amountSuffix: " / yr", href: `/app/operations/${i.id}`, kind: "Operations" as const, owner: i.assignee?.name || i.assignee?.email || null })),
  ]
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    .slice(0, 6);

  const openTasksForTop = topItems.length
    ? await prisma.task.findMany({
        where: { organizationId: ctx.organizationId, status: "OPEN", entityId: { in: topItems.map((t) => t.id) } },
        orderBy: { createdAt: "desc" },
        select: { entityId: true, title: true },
      })
    : [];
  const taskFor = new Map<string, string>();
  for (const t of openTasksForTop) if (t.entityId && !taskFor.has(t.entityId)) taskFor.set(t.entityId, t.title);
  const nextStepFor = (item: (typeof topItems)[number]) => {
    const task = taskFor.get(item.id);
    if (task) return task;
    if (!item.owner) return "Assign an owner";
    if (["IDENTIFIED", "NEW"].includes(item.status)) return "Review the evidence";
    if (["UNDER_REVIEW", "ANALYZING"].includes(item.status)) return "Approve or dismiss";
    if (item.status === "APPROVED") return item.kind === "Revenue" ? "Start recovery" : "Start the fix";
    return item.kind === "Revenue" ? "Record recovered cash" : "Record realized savings";
  };

  const topRevenue = topOpportunities[0];
  const topOperations = topInefficiencies[0];
  const projectedHours = operations._sum.projectedHoursWeekly ?? 0;
  const realizedHours = operations._sum.realizedHoursWeekly ?? 0;

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
        eyebrow="Executive overview"
        title={ctx.user.name ? `Welcome back, ${ctx.user.name.split(" ")[0]}` : "Executive overview"}
        description={ctx.organization?.name
          ? `${ctx.organization.name} — what matters, what it is worth, what to do next, and whether it worked.`
          : "What matters, what it is worth, what to do next, and whether it worked."}
        actions={ctx.organization?.isDemo ? <ExampleDataTag label="Example workspace" /> : undefined}
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
          <span className="shrink-0 text-xs font-semibold text-amber-400">Continue setup →</span>
        </Link>
      ) : null}

      {/* 1 — What is it worth? Estimates on the left of each product, recorded results on the right. Never summed. */}
      <section aria-labelledby="value-title" className="si-glass relative overflow-hidden rounded-2xl border border-neutral-800/90 bg-gradient-to-br from-neutral-950 to-neutral-900/40 p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="value-title" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">The value case</h2>
          <p className="text-[11px] text-neutral-500">Estimates and recorded results are shown side by side — never added together.</p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Link href={hasRevenue ? "/app/revenue" : "/pricing"} className="group rounded-xl border border-neutral-800 bg-neutral-950/80 p-4 transition hover:border-amber-500/40 sm:p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><TrendingUp className="h-4 w-4 text-amber-400" /> Revenue Recovery <ArrowRight className="ml-auto h-3.5 w-3.5 text-neutral-600 transition group-hover:text-amber-400" /></p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-neutral-500">{MONEY.pipelinePotential.label}</p>
                <p className="mt-1 text-xl font-semibold text-white sm:text-2xl"><CountUpCurrency value={pipelinePotential} /></p>
                <p className="mt-0.5 text-[10px] text-neutral-600">Estimate · {revenue._count} items</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">{MONEY.cashRecovered.label}</p>
                <p className="mt-1 text-xl font-semibold text-emerald-400 sm:text-2xl"><CountUpCurrency value={cashRecovered} /></p>
                <p className="mt-0.5 text-[10px] text-neutral-600">Recorded</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">{MONEY.verifiedRecovered.label}</p>
                <p className="mt-1 text-xl font-semibold text-emerald-300 sm:text-2xl"><CountUpCurrency value={verifiedRecovered} /></p>
                <p className="mt-0.5 text-[10px] text-neutral-600">Confirmed against evidence</p>
              </div>
            </div>
          </Link>
          <Link href={hasOps ? "/app/operations" : "/pricing"} className="group rounded-xl border border-neutral-800 bg-neutral-950/80 p-4 transition hover:border-amber-500/40 sm:p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><Settings2 className="h-4 w-4 text-amber-400" /> Operations Efficiency <ArrowRight className="ml-auto h-3.5 w-3.5 text-neutral-600 transition group-hover:text-amber-400" /></p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-neutral-500">{MONEY.projectedSavings.label}</p>
                <p className="mt-1 text-xl font-semibold text-white sm:text-2xl"><CountUpCurrency value={projectedSavings} /></p>
                <p className="mt-0.5 text-[10px] text-neutral-600">Projection · per year</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">{MONEY.realizedSavings.label}</p>
                <p className="mt-1 text-xl font-semibold text-emerald-400 sm:text-2xl"><CountUpCurrency value={realizedSavings} /></p>
                <p className="mt-0.5 text-[10px] text-neutral-600">Recorded</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-neutral-500">Hours / week</p>
                <p className="mt-1 text-xl font-semibold text-white sm:text-2xl">{Math.round(projectedHours)}<span className="text-sm font-normal text-neutral-500"> wasted</span></p>
                <p className="mt-0.5 text-[10px] text-neutral-600">{Math.round(realizedHours)} h/wk recovered</p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* 2 — The path from a finding to a verified result, using live records. */}
      <section aria-labelledby="path-title">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="path-title" className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">From finding to verified result</h2>
          <p className="text-[11px] text-neutral-600">Follow one issue from evidence to outcome.</p>
        </div>
        <ol className="grid gap-px overflow-hidden rounded-xl border border-neutral-800 bg-neutral-800 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              n: "1",
              label: "Highest-value revenue issue",
              title: topRevenue ? clientTitle(topRevenue.title) : "No open revenue issues",
              meta: topRevenue ? `${formatCurrency(topRevenue.potentialAmount || topRevenue.estimatedAmount)} estimated` : "Import records to begin",
              href: topRevenue ? `/app/revenue/${topRevenue.id}` : "/app/revenue",
            },
            {
              n: "2",
              label: "Highest-cost bottleneck",
              title: topOperations ? clientTitle(topOperations.title) : "No open bottlenecks",
              meta: topOperations ? `${formatCurrency(topOperations.estimatedWasteAnnual)} / yr estimated` : "Import records to begin",
              href: topOperations ? `/app/operations/${topOperations.id}` : "/app/operations",
            },
            {
              n: "3",
              label: "Decisions waiting",
              title: pendingApprovals > 0 ? `${pendingApprovals} approval${pendingApprovals === 1 ? "" : "s"} pending` : "No decisions waiting",
              meta: "Owner, next step, and approval",
              href: "/app/approvals",
            },
            {
              n: "4",
              label: "Did it work?",
              title: `${formatCurrency(verifiedRecovered)} verified · ${formatCurrency(realizedSavings)} realized`,
              meta: "Recorded results, by week",
              href: "/app/reports",
            },
          ].map((step) => (
            <li key={step.n} className="bg-neutral-950">
              <Link href={step.href} className="group flex h-full flex-col p-4 transition hover:bg-neutral-900/70">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-amber-500/40 font-mono text-[10px] text-amber-400">{step.n}</span>
                  {step.label}
                </p>
                <p className="mt-2 line-clamp-2 text-sm font-medium text-white">{step.title}</p>
                <p className="mt-auto flex items-center gap-1 pt-2 text-xs text-neutral-500 group-hover:text-amber-300">{step.meta} <ArrowRight className="h-3 w-3" /></p>
              </Link>
            </li>
          ))}
        </ol>
      </section>

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

      {/* 3 — What matters, who owns it, what happens next. */}
      <section aria-labelledby="top-issues-title">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="top-issues-title" className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Highest-value open issues</h2>
          <Link href="/app/findings" className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300">
            All findings <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {topItems.length === 0 ? (
          <EmptyState title="No open issues yet" description="Import records or wait for the next analysis — new revenue and operations issues will appear here, ranked by value." />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_7rem_minmax(0,1fr)_minmax(0,1.3fr)_6.5rem] gap-4 border-b border-neutral-900 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600 lg:grid">
              <span>Issue</span><span className="text-right">Estimated value</span><span>Owner</span><span>Next step</span><span>Status</span>
            </div>
            <ul className="divide-y divide-neutral-900">
              {topItems.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link href={item.href} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-neutral-900/60 lg:grid-cols-[minmax(0,1.6fr)_7rem_minmax(0,1fr)_minmax(0,1.3fr)_6.5rem] lg:items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white lg:truncate">{item.title}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">{item.kind} <PriorityBadge priority={item.priority} /></p>
                    </div>
                    <p className="text-right text-sm font-semibold text-amber-300">{formatCurrency(item.amount ?? 0)}<span className="text-[10px] font-normal text-neutral-500">{item.amountSuffix}</span></p>
                    <p className="col-span-2 truncate text-xs text-neutral-400 lg:col-span-1 lg:text-sm"><span className="text-neutral-600 lg:hidden">Owner: </span>{item.owner ?? <span className="text-amber-400/80">Unassigned</span>}</p>
                    <p className="col-span-2 text-xs text-neutral-300 lg:col-span-1 lg:truncate lg:text-sm"><span className="text-neutral-600 lg:hidden">Next: </span>{nextStepFor(item)}</p>
                    <div className="col-span-2 lg:col-span-1"><StatusBadge status={item.status} /></div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <NextBestAction title={nextAction.title} description={nextAction.description} href={nextAction.href} actionLabel="Review" />

      <section aria-labelledby="value-motion-title" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="value-motion-title" className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Estimated vs. realized, over time</h2>
          <p className="text-[10px] text-neutral-600">Shown separately on purpose — estimates are never added to recorded outcomes.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <DynLineChart
            title="Estimated value identified"
            description="Running total of estimated opportunity — revenue opportunity and projected savings. Not cash."
            badge={{ label: "Estimated", tone: "estimate" }}
            data={chartWeekly.estimated}
            series={[
              { key: "rrPotential", label: "Revenue opportunity (est.)", color: CHART.amber },
              { key: "oeProjected", label: "Projected savings (est.)", color: CHART.sky },
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
        <p className="text-[10px] text-neutral-600">{MONEY_GLOSSARY_FOOTNOTE}</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="High-confidence revenue" value={<CountUp value={highConfidenceRevenue} />} sublabel="Open · confidence 70+" icon={TrendingUp} href="/app/revenue?view=high_confidence" />
        <MetricCard label="Critical bottlenecks" value={<CountUp value={criticalOperations} />} sublabel="Open · critical priority" icon={Settings2} href="/app/operations?view=critical" />
        <MetricCard label="Pending approvals" value={<CountUp value={pendingApprovals} />} sublabel="Decisions awaiting review" icon={ShieldCheck} tone={pendingApprovals > 0 ? "danger" : "default"} href="/app/approvals" />
        <MetricCard label="Open team actions" value={<CountUp value={openActionsCount} />} sublabel={`Action Center · ${slaOpenCount} at SLA risk`} icon={Bell} href="/app/action-center" />
      </div>

      <Card className="border-emerald-500/20 bg-emerald-500/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> What improved</CardTitle>
          <CardDescription>Patterns from your recorded outcomes only.</CardDescription>
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
              <span>No patterns yet — they appear once enough outcomes are recorded to learn from.</span>
            )}
          </div>
          <Link href="/app/learning" className="text-xs text-emerald-400 hover:text-emerald-300">
            What improved and what&apos;s next →
          </Link>
        </CardContent>
      </Card>

      {/* Operating detail — command bar, health, runs. Secondary to the value story above. */}
      <section aria-label="Operating detail" className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">Operating detail</p>
        <OperatingDesk organizationId={ctx.organizationId} userId={ctx.user.id} />
        <ActivityStrip
          items={[
            { id: "a", label: pendingApprovals > 0 ? `${pendingApprovals} approval${pendingApprovals === 1 ? "" : "s"} awaiting review` : "No pending decisions", tone: pendingApprovals > 0 ? "warn" : "ok" },
            { id: "b", label: openActionsCount > 0 ? `${openActionsCount} open team action${openActionsCount === 1 ? "" : "s"} in the Action Center` : "No open team actions", tone: openActionsCount > 0 ? "accent" : "ok" },
            { id: "c", label: unreadNotifications > 0 ? `${unreadNotifications} unread notification${unreadNotifications === 1 ? "" : "s"}` : "Notifications clear", tone: unreadNotifications > 0 ? "accent" : "ok" },
            { id: "d", label: lastHealth ? `Last health check ${lastHealth.status.toLowerCase()}` : "No health check recorded yet", tone: lastHealth?.status === "OK" ? "ok" : "warn" },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <DynBarChart
            title="Open work by age"
            description="Open items across aging buckets"
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
      </section>
    </div>
  );
}
