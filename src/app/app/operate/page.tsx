import Link from "next/link";
import { requireOrgAccess } from "@/lib/tenant";
import { opCtxFromSession, listHealthChecks, healthRollup, listStandingOrders } from "@/lib/operate";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { RunStatusBadge } from "@/components/operate/route-badge";
import { DynBarChart } from "@/components/charts/dynamic";
import { CHART } from "@/components/charts/theme";
import { StatusDot } from "@/components/motion";
import { formatDate } from "@/lib/utils";
import { runHealthCheckAction } from "../operate-actions";

export const dynamic = "force-dynamic";

export default async function OperatePage() {
  const session = await requireOrgAccess();
  const ctx = opCtxFromSession(session);
  const [checks, rollup, orders] = await Promise.all([listHealthChecks(ctx, 20), healthRollup(ctx, 14), listStandingOrders(ctx)]);
  const latest = checks[0];
  const healthOrders = orders.filter((o) => o.kind === "STATUS" && o.enabled);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operate"
        title="Is the operating intelligence healthy?"
        description="Measured health for this workspace: database, intelligence engine freshness, detection, schedules, runs, and integrations. Components report only what was observed; missing integrations are labeled, never assumed."
        actions={<form action={runHealthCheckAction}><Button type="submit">Run health check</Button></form>}
      />

      {latest ? (
        <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900/80 to-neutral-950 p-5 sm:p-6">
          <div className={`pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl ${latest.status === "OK" ? "bg-emerald-500/10" : latest.status === "DEGRADED" ? "bg-amber-500/10" : "bg-red-500/10"}`} aria-hidden />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StatusDot tone={latest.status === "OK" ? "ok" : "warn"} />
              <p className="text-2xl font-semibold text-white">{latest.status === "OK" ? "All measured components healthy" : latest.status === "DEGRADED" ? "Needs attention" : "Down"}</p>
            </div>
            <p className="text-xs text-neutral-500">Checked {formatDate(latest.createdAt)} · {latest.latencyMs} ms · via {latest.source.toLowerCase().replace(/_/g, " ")}</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {latest.components.map((c) => (
              <div key={c.key} className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-neutral-200">{c.label}</p>
                  <RunStatusBadge status={c.status} />
                </div>
                <p className="mt-2 text-xs leading-5 text-neutral-400">{c.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState title="No health checks recorded" description="Run a health check to record the first measurement." />
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {rollup.series.length ? (
          <DynBarChart
            title="Health rollup"
            description={`Recorded checks by day · last 14 days${rollup.okRate !== null ? ` · ${rollup.okRate}% healthy` : ""}`}
            data={rollup.series}
            xKey="day"
            series={[
              { key: "ok", label: "OK", color: CHART.emerald },
              { key: "degraded", label: "Degraded", color: CHART.amber },
              { key: "down", label: "Down", color: CHART.rose },
            ]}
            stacked
            height={220}
            footnote={`${rollup.total} recorded checks. Measured, not modeled.`}
          />
        ) : (
          <EmptyState title="No rollup yet" />
        )}
        <Card>
          <CardHeader>
            <CardTitle>Ticks & schedules</CardTitle>
            <CardDescription>How health checks and standing orders get triggered.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-neutral-400">
            <p>{healthOrders.length ? `${healthOrders.length} standing health check${healthOrders.length === 1 ? "" : "s"} active.` : "No standing health check."} <Link href="/app/automations" className="text-amber-400">Automations →</Link></p>
            <p className="text-xs leading-5">There is no always-on background worker on the current hosting plan. Schedules run when someone presses <span className="text-neutral-200">Run due now</span>, or when an external scheduler calls <code className="text-amber-400">POST /api/operate/tick</code> with the <code className="text-amber-400">OPERATE_TICK_TOKEN</code> bearer token.</p>
            <p className="text-xs leading-5">Approvals and runs waiting on a person are listed in your <Link href="/app/inbox" className="text-amber-400">Inbox</Link>.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent checks</CardTitle></CardHeader>
        <CardContent className="p-0">
          {checks.length === 0 ? <EmptyState className="m-5" title="None yet" /> : (
            <ul className="divide-y divide-neutral-900">
              {checks.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                  <span className="text-xs text-neutral-400">{formatDate(c.createdAt)} · {c.source.toLowerCase().replace(/_/g, " ")} · {c.latencyMs} ms</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-neutral-500">{c.components.filter((x) => x.status === "DEGRADED" || x.status === "DOWN").map((x) => x.label).join(", ") || "—"}</span>
                    <RunStatusBadge status={c.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
