import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { ageDays, slaBucket, slaLabel, slaTone } from "@/lib/sla";
import { decideApproval, bulkDecideApprovals } from "../operations/actions";
import { getApprovalsChartData } from "@/lib/chart-data";
import { DynBarChart, DynComposedChart, KpiSpark, CHART } from "@/components/charts/dynamic";

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

  return (
    <div>
      <h1 className="text-2xl font-semibold">Approvals</h1>
      <p className="mt-2 text-sm text-neutral-400">
        SI-style gated decisions with aging and bulk actions. Critical automation / integration gates require step-up confirmation.
        Approving does <strong className="text-neutral-200">not</strong> execute external actions.
      </p>

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


      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <DynBarChart
          title="Pending by aging"
          description="SLA-style aging for open approval gates"
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

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <a href="/app/approvals?view=pending" className={`rounded-full border px-3 py-1 ${view === "pending" ? "border-amber-500 text-amber-400" : "border-neutral-800 text-neutral-400"}`}>
          Pending ({pending.length})
        </a>
        <a href="/app/approvals?view=all" className={`rounded-full border px-3 py-1 ${view === "all" ? "border-amber-500 text-amber-400" : "border-neutral-800 text-neutral-400"}`}>
          All
        </a>
      </div>

      {pending.length > 0 ? (
        <form action={bulkDecideApprovals} className="si-panel mt-6 space-y-3 p-4">
          <p className="si-label text-amber-500">Bulk decide</p>
          <p className="text-xs text-neutral-500">Select pending items, provide a required reason, then approve or reject. Decisions are recorded only.</p>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded border border-neutral-900 p-2">
            {pending.map((a) => {
              const age = ageDays(a.createdAt, now);
              const sla = slaBucket(age, "approval");
              return (
                <label key={a.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="ids" value={a.id} className="mt-1" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-neutral-200">{a.title}</span>
                    <span className="mt-0.5 flex flex-wrap gap-2 text-xs text-neutral-500">
                      <Badge tone={slaTone(sla)}>{slaLabel(sla)} · {age}d</Badge>
                      <span>{a.type}</span>
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
            <input type="checkbox" name="confirmStepUp" /> Step-up confirm (required for critical gates in the selection)
          </label>
          <div className="flex flex-wrap gap-2">
            <Button name="decision" value="APPROVED" type="submit" size="sm">Bulk approve</Button>
            <Button name="decision" value="REJECTED" type="submit" variant="outline" size="sm">Bulk reject</Button>
          </div>
        </form>
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
                    {a.status}
                  </Badge>
                  <Badge>{a.type}</Badge>
                  {a.status === "PENDING" ? <Badge tone={slaTone(sla)}>{slaLabel(sla)} · {age}d</Badge> : null}
                  <span className="text-sm font-medium">{a.title}</span>
                </div>
                {a.description ? <p className="mt-2 text-sm text-neutral-400">{a.description}</p> : null}
                <p className="mt-1 text-xs text-neutral-600">
                  Requested by {a.requestedBy.name || a.requestedBy.email} · {formatDate(a.createdAt)}
                  {a.decisionNote ? ` · ${a.decisionNote}` : ""}
                </p>
                {a.status === "PENDING" ? (
                  <form
                    action={async (fd) => {
                      "use server";
                      await decideApproval(a.id, fd);
                    }}
                    className="mt-4 flex flex-wrap items-center gap-3"
                  >
                    <label className="flex items-center gap-2 text-xs text-neutral-400">
                      <input type="checkbox" name="confirmStepUp" /> Step-up confirm (required for critical gates)
                    </label>
                    <input name="note" placeholder="Reason / note" className="h-9 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm" />
                    <Button name="decision" value="APPROVED" type="submit" size="sm">Approve</Button>
                    <Button name="decision" value="REJECTED" type="submit" variant="outline" size="sm">Reject</Button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
