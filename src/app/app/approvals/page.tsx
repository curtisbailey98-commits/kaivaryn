import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { ageDays, slaBucket, slaLabel, slaTone } from "@/lib/sla";
import { decideApproval, bulkDecideApprovals } from "../operations/actions";
import { getApprovalsChartData } from "@/lib/chart-data";
import { DynBarChart, DynComposedChart, KpiSpark } from "@/components/charts/dynamic";
import { CHART } from "@/components/charts/theme";
import { humanizeLabel } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";
import { can } from "@/lib/rbac";
import Link from "next/link";

export const metadata = { title: "Approvals" };

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const view = searchParams.view === "all" ? "all" : "pending";
  const approvals = await prisma.approvalRequest.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(view === "pending" ? { status: "PENDING" } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { requestedBy: { select: { email: true, name: true } } },
  });

  const now = new Date();
  const pending = approvals.filter((a) => a.status === "PENDING");
  const chartData = await getApprovalsChartData(ctx.organizationId);
  const canDecide = can(ctx.effectiveRole, "approve");
  const linkFor = (payloadJson: string | null): string | null => {
    try {
      const p = JSON.parse(payloadJson || "{}") as { opportunityId?: string; inefficiencyId?: string };
      if (p.opportunityId) return `/app/revenue/${p.opportunityId}`;
      if (p.inefficiencyId) return `/app/operations/${p.inefficiencyId}`;
    } catch { /* ignore */ }
    return null;
  };

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-500/90">Govern</p>
      <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">Approvals</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
        Decisions waiting on your team. Approving records the decision — it does <strong className="text-neutral-200">not</strong> act in your systems. Your team carries out the work.
      </p>
      {!canDecide ? <p className="mt-2 text-xs text-neutral-500">You can view approvals. A manager or above makes the decision.</p> : null}

      {searchParams.ok ? (
        <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {searchParams.msg || "Saved"}
        </p>
      ) : null}
      {searchParams.error ? (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {searchParams.msg || "Error"}
        </p>
      ) : null}


      <div className="mt-6 flex flex-wrap gap-2 text-xs">
        <a href="/app/approvals?view=pending" className={`rounded-full border px-3 py-1 ${view === "pending" ? "border-amber-500 text-amber-400" : "border-neutral-800 text-neutral-400"}`}>
          Pending ({pending.length})
        </a>
        <a href="/app/approvals?view=all" className={`rounded-full border px-3 py-1 ${view === "all" ? "border-amber-500 text-amber-400" : "border-neutral-800 text-neutral-400"}`}>
          All
        </a>
      </div>

      {pending.length > 1 && canDecide ? (
        <details className="si-panel mt-4 p-4">
        <summary className="cursor-pointer select-none text-sm font-medium text-neutral-300 hover:text-white">Decide several at once</summary>
        <form action={bulkDecideApprovals} className="mt-3 space-y-3">
          <p className="text-xs text-neutral-500">Select items, give a reason, then approve or reject. Decisions are recorded only.</p>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded border border-neutral-900 p-2">
            {pending.map((a) => {
              const age = ageDays(a.createdAt, now);
              const sla = slaBucket(age, "approval");
              return (
                <label key={a.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="ids" value={a.id} className="mt-1" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-neutral-200" title={a.title}>{a.title}</span>
                    <span className="mt-0.5 flex flex-wrap gap-2 text-xs text-neutral-500">
                      <Badge tone={slaTone(sla)}>{slaLabel(sla)} · {age}d</Badge>
                      <span>{humanizeLabel(a.type)}</span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <label className="block text-xs text-neutral-400">
            Decision reason (required)
            <input name="reason" required minLength={3} placeholder="e.g. Within policy; evidence reviewed" className="mt-1 h-9 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            <input type="checkbox" name="confirmStepUp" /> Confirm (required if the selection includes automation or integration changes)
          </label>
          <div className="flex flex-wrap gap-2">
            <Button name="decision" value="APPROVED" type="submit" size="sm">Bulk approve</Button>
            <Button name="decision" value="REJECTED" type="submit" variant="outline" size="sm">Bulk reject</Button>
          </div>
        </form>
        </details>
      ) : null}

      {approvals.length === 0 ? (
        <EmptyState className="mt-8" title="No approval requests" description="High-value recoveries, automation candidates, and gated actions will queue here." />
      ) : (
        <ul className="mt-6 space-y-4">
          {approvals.map((a) => {
            const age = ageDays(a.createdAt, now);
            const sla = slaBucket(age, "approval");
            return (
              <li key={a.id} className="si-panel p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={a.status === "PENDING" ? "warning" : a.status === "APPROVED" ? "success" : "default"}>
                    {humanizeLabel(a.status)}
                  </Badge>
                  <Badge>{humanizeLabel(a.type)}</Badge>
                  {a.status === "PENDING" ? <Badge tone={slaTone(sla)}>{slaLabel(sla)} · {age}d</Badge> : null}
                  <span className="min-w-0 truncate text-sm font-medium" title={a.title}>{a.title}</span>
                </div>
                {a.description ? <p className="mt-2 text-sm text-neutral-400">{a.description}</p> : null}
                {(() => {
                  let impact: number | null = null;
                  try {
                    const payload = JSON.parse(a.payloadJson || "{}") as {
                      amount?: number; recovered?: number; recoveredAmount?: number;
                      realized?: number; realizedSavings?: number; impact?: number; projectedSavings?: number;
                    };
                    impact = payload.amount ?? payload.recoveredAmount ?? payload.recovered
                      ?? payload.realizedSavings ?? payload.realized ?? payload.projectedSavings ?? payload.impact ?? null;
                  } catch { /* ignore */ }
                  return impact != null && impact > 0 ? (
                    <p className="mt-1 text-sm text-amber-400">Impact {formatCurrency(impact)}</p>
                  ) : null;
                })()}
                <p className="mt-1 text-xs text-neutral-600">
                  Requested by {a.requestedBy.name || a.requestedBy.email} · {formatDate(a.createdAt)}
                  {a.decisionNote ? ` · ${a.decisionNote}` : ""}
                </p>
                {linkFor(a.payloadJson) ? (
                  <Link href={linkFor(a.payloadJson)!} className="mt-2 inline-block text-xs text-amber-400 hover:text-amber-300">Open the finding →</Link>
                ) : null}
                {a.status === "PENDING" && canDecide ? (
                  <form
                    action={async (fd) => {
                      "use server";
                      await decideApproval(a.id, fd);
                    }}
                    className="mt-4 flex flex-wrap items-center gap-3"
                  >
                    <label className="flex items-center gap-2 text-xs text-neutral-400">
                      <input type="checkbox" name="confirmStepUp" /> Confirm (required for automation and integration changes)
                    </label>
                    <input name="note" placeholder="Reason (optional)" aria-label="Decision reason" className="h-9 min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm sm:max-w-xs" />
                    <Button name="decision" value="APPROVED" type="submit" size="sm">Approve</Button>
                    <Button name="decision" value="REJECTED" type="submit" variant="outline" size="sm">Reject</Button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-10 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Approval analytics</h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <DynBarChart
          title="Pending by aging"
          description="Aging for open approval gates"
          data={chartData.aging}
          series={[{ key: "count", label: "Pending", color: CHART.amber }]}
          height={220}
          footnote={chartData.sourceNote}
          stagger={0}
        />
        <DynComposedChart
          title="Created vs decided"
          description="Weekly approval volume"
          data={chartData.volume}
          bars={[{ key: "created", label: "Created", color: CHART.sky }]}
          lines={[{ key: "decided", label: "Decided", color: CHART.emerald }]}
          height={220}
          footnote={chartData.sourceNote}
          stagger={1}
        />
        <div className="space-y-4">
          <KpiSpark
            label="Pending now"
            value={chartData.pendingCount}
            data={chartData.volume.map((v) => ({ label: v.label, value: v.created }))}
            color={CHART.amber}
            footnote="Live pending count"
            stagger={2}
          />
          <DynBarChart
            title="Pending by type"
            description="Horizontal ranking of open request types"
            data={chartData.byType}
            series={[{ key: "count", label: "Count", color: CHART.violet }]}
            layout="vertical"
            height={160}
            stagger={3}
          />
        </div>
      </div>

    </div>
  );
}
