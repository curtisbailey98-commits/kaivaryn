import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { urgencyScore, impactForRanking } from "@/lib/financial-impact";
import { ageDays, slaBucket, slaLabel, slaTone, agingBucketLabel } from "@/lib/sla";
import { runIntelligence } from "../actions";
import { Button } from "@/components/ui/button";
import { DynBarChart, Sparkline, CHART } from "@/components/charts/dynamic";
import { getActionCenterChartData } from "@/lib/chart-data";
import { ActivityStrip, StatusDot } from "@/components/motion";

export const dynamic = "force-dynamic";

type ActionItem = {
  id: string;
  kind: "approval" | "revenue" | "operations";
  title: string;
  href: string;
  impact: number;
  urgency: number;
  rank: number;
  meta: string;
  badge: string;
  owner: string | null;
  age: number;
  sla: ReturnType<typeof slaBucket>;
  agingLabel: string;
  unassigned: boolean;
  needsAttention: boolean;
};

export default async function ActionCenterPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const filter = searchParams.filter || "all";
  const triage = searchParams.triage || "all";
  const settings = await prisma.orgSettings.upsert({
    where: { organizationId: ctx.organizationId },
    update: {},
    create: { organizationId: ctx.organizationId },
  });

  const [pendingApprovals, opps, ineff, recentAudit, unread, chartData] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: { organizationId: ctx.organizationId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { requestedBy: { select: { name: true, email: true } } },
    }),
    prisma.opportunity.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { notIn: ["DISMISSED", "VERIFIED"] },
      },
      orderBy: [{ score: "desc" }, { potentialAmount: "desc" }],
      take: 40,
      include: { assignee: { select: { name: true, email: true } } },
    }),
    prisma.inefficiency.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { notIn: ["DISMISSED", "VERIFIED", "RESOLVED"] },
      },
      orderBy: [{ score: "desc" }, { projectedSavings: "desc" }],
      take: 40,
      include: { assignee: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.notification.count({
      where: { organizationId: ctx.organizationId, userId: ctx.user.id, readAt: null },
    }),
    getActionCenterChartData(ctx.organizationId),
  ]);

  const now = new Date();
  const items: ActionItem[] = [];

  for (const a of pendingApprovals) {
    const age = ageDays(a.createdAt, now);
    const sla = slaBucket(age, "approval");
    const urgency = urgencyScore({ priority: "HIGH", ageDays: age, amount: 0 });
    items.push({
      id: a.id,
      kind: "approval",
      title: a.title,
      href: "/app/approvals",
      impact: a.needsIntegration ? 10 : 25,
      urgency,
      rank: 0,
      meta: a.needsIntegration ? `Needs integration: ${a.needsIntegration}` : a.type,
      badge: a.type,
      owner: a.requestedBy.name || a.requestedBy.email,
      age,
      sla,
      agingLabel: agingBucketLabel(age),
      unassigned: false,
      needsAttention: sla === "aging" || sla === "breach" || Boolean(a.needsIntegration),
    });
  }
  for (const o of opps) {
    const amount = o.potentialAmount || o.estimatedAmount;
    const age = ageDays(o.identifiedAt, now);
    const sla = slaBucket(age, "work");
    const urgency = urgencyScore({
      priority: o.priority,
      ageDays: age,
      amount,
      highValueThreshold: settings.highValueThreshold,
    });
    const unassigned = !o.assigneeId;
    items.push({
      id: o.id,
      kind: "revenue",
      title: o.title,
      href: `/app/revenue/${o.id}`,
      impact: impactForRanking("RR", amount),
      urgency,
      rank: 0,
      meta: `${o.status} · score ${o.score}`,
      badge: o.priority,
      owner: o.assignee?.name || o.assignee?.email || null,
      age,
      sla,
      agingLabel: agingBucketLabel(age),
      unassigned,
      needsAttention: unassigned || sla === "breach" || o.priority === "CRITICAL",
    });
  }
  for (const i of ineff) {
    const amount = i.projectedSavings || i.estimatedWasteAnnual;
    const age = ageDays(i.identifiedAt, now);
    const sla = slaBucket(age, "work");
    const urgency = urgencyScore({
      priority: i.priority,
      ageDays: age,
      amount,
      highValueThreshold: settings.highValueThreshold,
    });
    const unassigned = !i.assigneeId;
    items.push({
      id: i.id,
      kind: "operations",
      title: i.title,
      href: `/app/operations/${i.id}`,
      impact: impactForRanking("OE", amount),
      urgency,
      rank: 0,
      meta: `${i.status} · score ${i.score}`,
      badge: i.priority,
      owner: i.assignee?.name || i.assignee?.email || null,
      age,
      sla,
      agingLabel: agingBucketLabel(age),
      unassigned,
      needsAttention: unassigned || sla === "breach" || i.priority === "CRITICAL" || i.automationCandidate,
    });
  }

  for (const it of items) {
    it.rank = it.impact * 0.6 + it.urgency * 400 + (it.needsAttention ? 5000 : 0);
  }
  items.sort((a, b) => b.rank - a.rank);

  let filtered = filter === "all" ? items : items.filter((i) => i.kind === filter);
  if (triage === "needs_attention") filtered = filtered.filter((i) => i.needsAttention);
  if (triage === "unassigned") filtered = filtered.filter((i) => i.unassigned);
  if (triage === "sla_risk") filtered = filtered.filter((i) => i.sla === "aging" || i.sla === "breach");

  const agingCounts = {
    "0–3d": items.filter((i) => i.agingLabel === "0–3d").length,
    "4–7d": items.filter((i) => i.agingLabel === "4–7d").length,
    "8–14d": items.filter((i) => i.agingLabel === "8–14d").length,
    "15–30d": items.filter((i) => i.agingLabel === "15–30d").length,
    "30d+": items.filter((i) => i.agingLabel === "30d+").length,
  };
  const needsCount = items.filter((i) => i.needsAttention).length;
  const unassignedCount = items.filter((i) => i.unassigned).length;
  const slaRiskCount = items.filter((i) => i.sla === "aging" || i.sla === "breach").length;

  return (
    <div className="space-y-4">
      <ActivityStrip
        items={[
          { id: "1", label: "Queue ranked by impact × urgency × SLA — decisions only, no fake external success", tone: "accent" },
          { id: "2", label: "Mission control online · tenant isolation verified", tone: "ok" },
          { id: "3", label: "High-value actions remain approval-gated until review", tone: "warn" },
        ]}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="si-label flex items-center gap-2 text-amber-500"><StatusDot tone="accent" />Executive</p>
          <h1 className="mt-1 text-2xl font-semibold">Action Center</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Unified queue ranked by financial impact, urgency, and SLA risk. Approvals record decisions only —
            external actions never fake success.
          </p>
          {ctx.organization?.isDemo ? <Badge tone="demo" className="mt-3">DEMO</Badge> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {unread > 0 ? (
            <Link href="/app/notifications" className="rounded-md border border-amber-500/40 px-3 py-2 text-sm text-amber-400">
              {unread} notifications
            </Link>
          ) : null}
          <Link href="/app/query" className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-amber-600">
            Ask (NL)
          </Link>
          <Link href="/app/reports" className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-amber-600">
            Reports
          </Link>
          <form action={runIntelligence}>
            <Button type="submit" variant="secondary">Run intelligence</Button>
          </form>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/app/action-center?triage=needs_attention" className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <p className="text-[10px] uppercase tracking-wider text-amber-300">Needs attention</p>
          <p className="mt-2 text-2xl font-semibold text-white">{needsCount}</p>
          <p className="mt-1 text-xs text-neutral-500">Unassigned, critical, or SLA risk</p>
        </Link>
        <Link href="/app/action-center?triage=unassigned" className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Unassigned</p>
          <p className="mt-2 text-2xl font-semibold text-white">{unassignedCount}</p>
          <p className="mt-1 text-xs text-neutral-500">Open work without an owner</p>
        </Link>
        <Link href="/app/action-center?triage=sla_risk" className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-wider text-red-300">SLA risk</p>
          <p className="mt-2 text-2xl font-semibold text-white">{slaRiskCount}</p>
          <p className="mt-1 text-xs text-neutral-500">Aging or breach buckets</p>
        </Link>
        <Link href="/app/approvals" className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Pending approvals</p>
          <p className="mt-2 text-2xl font-semibold text-white">{pendingApprovals.length}</p>
          <p className="mt-1 text-xs text-neutral-500">Decision-gated actions</p>
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="text-neutral-600 self-center">Aging:</span>
        {Object.entries(agingCounts).map(([label, count]) => (
          <span key={label} className="rounded-full border border-neutral-800 px-3 py-1 text-neutral-400">
            {label} · {count}
          </span>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <DynBarChart
          title="Aging buckets"
          description="Distribution of open executive actions"
          data={chartData.aging}
          series={[{ key: "count", label: "Items", color: CHART.amber }]}
          height={220}
          footnote={chartData.sourceNote}
          stagger={0}
        />
        <DynBarChart
          title="Aging ranking"
          description="Horizontal ranking of open work by age"
          data={[...chartData.aging].sort((a, b) => b.count - a.count)}
          series={[{ key: "count", label: "Items", color: CHART.violet }]}
          layout="vertical"
          height={220}
          footnote={chartData.sourceNote}
          stagger={1}
        />
        <div className="si-glass p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">SLA breach sparkline</h3>
              <p className="mt-0.5 text-xs text-neutral-500">Open items in aging/breach over recent weeks</p>
            </div>
            <p className="text-2xl font-semibold text-rose-300">{slaRiskCount}</p>
          </div>
          <Sparkline
            className="mt-4"
            height={120}
            data={chartData.slaSpark}
            color={CHART.rose}
            label="SLA risk"
          />
          <p className="mt-2 text-[10px] text-neutral-600">{chartData.sourceNote}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {([["all", "All"], ["approval", "Approvals"], ["revenue", "Revenue"], ["operations", "Operations"]] as const).map(([k, label]) => (
          <Link
            key={k}
            href={`/app/action-center?filter=${k}${triage !== "all" ? `&triage=${triage}` : ""}`}
            className={`rounded-full border px-3 py-1 ${
              filter === k ? "border-amber-500 text-amber-400" : "border-neutral-800 text-neutral-400"
            }`}
          >
            {label}
          </Link>
        ))}
        <span className="mx-1 text-neutral-700">|</span>
        {([["all", "All triage"], ["needs_attention", "Needs attention"], ["unassigned", "Unassigned"], ["sla_risk", "SLA risk"]] as const).map(([k, label]) => (
          <Link
            key={k}
            href={`/app/action-center?filter=${filter}&triage=${k}`}
            className={`rounded-full border px-3 py-1 ${
              triage === k ? "border-emerald-500 text-emerald-400" : "border-neutral-800 text-neutral-400"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState className="mt-8" title="No open executive actions" description="Critical items and pending approvals will appear here. Import data or run intelligence to surface work." />
      ) : (
        <ul className="mt-6 space-y-3">
          {filtered.slice(0, 40).map((it) => (
            <li key={`${it.kind}-${it.id}`} className="si-panel p-3 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={it.kind === "approval" ? "warning" : it.kind === "revenue" ? "danger" : "info"}>
                      {it.kind}
                    </Badge>
                    <Badge>{it.badge}</Badge>
                    <Badge tone={slaTone(it.sla)}>{slaLabel(it.sla)} · {it.age}d</Badge>
                    {it.unassigned ? <Badge tone="warning">Unassigned</Badge> : null}
                    {it.needsAttention ? <Badge tone="danger">Needs attention</Badge> : null}
                  </div>
                  <Link href={it.href} className="mt-1 block truncate text-base font-medium text-amber-400 hover:underline">
                    {it.title}
                  </Link>
                  <p className="mt-1 text-xs text-neutral-500">
                    {it.meta}
                    {" · "}
                    Owner: {it.owner || "—"}
                    {" · "}
                    Aging {it.agingLabel}
                  </p>
                </div>
                <div className="flex shrink-0 gap-4 text-right text-xs sm:flex-col sm:items-end">
                  <div>
                    <span className="text-neutral-500">Impact</span>
                    <div className="font-semibold text-amber-400">{formatCurrency(it.impact)}</div>
                  </div>
                  <div>
                    <span className="text-neutral-500">Urgency</span>
                    <div className="font-semibold">{Math.round(it.urgency)}</div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Ask (NL)</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/app/query" method="get" className="flex flex-col gap-2 sm:flex-row">
            <input
              name="q"
              placeholder='e.g. "How much revenue have we recovered?"'
              className="h-10 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm"
            />
            <button type="submit" className="h-10 rounded-md bg-amber-500 px-4 text-sm font-semibold text-neutral-950">
              Ask
            </button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-8">
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
  );
}
