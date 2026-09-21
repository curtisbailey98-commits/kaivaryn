import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { urgencyScore, impactForRanking } from "@/lib/financial-impact";
import { runIntelligence } from "../actions";
import { Button } from "@/components/ui/button";

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
};

export default async function ActionCenterPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const filter = searchParams.filter || "all";
  const settings = await prisma.orgSettings.upsert({
    where: { organizationId: ctx.organizationId },
    update: {},
    create: { organizationId: ctx.organizationId },
  });

  const [pendingApprovals, opps, ineff, recentAudit, unread] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: { organizationId: ctx.organizationId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.opportunity.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { notIn: ["DISMISSED", "VERIFIED"] },
      },
      orderBy: [{ score: "desc" }, { potentialAmount: "desc" }],
      take: 40,
    }),
    prisma.inefficiency.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { notIn: ["DISMISSED", "VERIFIED", "RESOLVED"] },
      },
      orderBy: [{ score: "desc" }, { projectedSavings: "desc" }],
      take: 40,
    }),
    prisma.auditLog.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.notification.count({
      where: { organizationId: ctx.organizationId, userId: ctx.user.id, readAt: null },
    }),
  ]);

  const now = Date.now();
  const items: ActionItem[] = [];

  for (const a of pendingApprovals) {
    const ageDays = Math.floor((now - a.createdAt.getTime()) / 86400000);
    const urgency = urgencyScore({ priority: "HIGH", ageDays, amount: 0 });
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
    });
  }
  for (const o of opps) {
    const amount = o.potentialAmount || o.estimatedAmount;
    const ageDays = Math.floor((now - o.identifiedAt.getTime()) / 86400000);
    const urgency = urgencyScore({
      priority: o.priority,
      ageDays,
      amount,
      highValueThreshold: settings.highValueThreshold,
    });
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
    });
  }
  for (const i of ineff) {
    const amount = i.projectedSavings || i.estimatedWasteAnnual;
    const ageDays = Math.floor((now - i.identifiedAt.getTime()) / 86400000);
    const urgency = urgencyScore({
      priority: i.priority,
      ageDays,
      amount,
      highValueThreshold: settings.highValueThreshold,
    });
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
    });
  }

  for (const it of items) {
    it.rank = it.impact * 0.6 + it.urgency * 400;
  }
  items.sort((a, b) => b.rank - a.rank);
  const filtered = filter === "all" ? items : items.filter((i) => i.kind === filter);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="si-label text-amber-500">Executive</p>
          <h1 className="mt-1 text-2xl font-semibold">Action Center</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Unified queue ranked by financial impact and urgency. Approvals record decisions only —
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
          <form action={runIntelligence}>
            <Button type="submit" variant="secondary">Run intelligence</Button>
          </form>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {([["all", "All"], ["approval", "Approvals"], ["revenue", "Revenue"], ["operations", "Operations"]] as const).map(([k, label]) => (
          <Link
            key={k}
            href={`/app/action-center?filter=${k}`}
            className={`rounded-full border px-3 py-1 ${
              filter === k ? "border-amber-500 text-amber-400" : "border-neutral-800 text-neutral-400"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState className="mt-8" title="No open executive actions" description="Critical items and pending approvals will appear here." />
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
                  </div>
                  <Link href={it.href} className="mt-1 block truncate text-base font-medium text-amber-400 hover:underline">
                    {it.title}
                  </Link>
                  <p className="mt-1 text-xs text-neutral-500">{it.meta}</p>
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
