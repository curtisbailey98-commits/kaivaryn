import Link from "next/link";
import { requireOrgAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { opCtxFromSession, listStandingOrders, listRuns, listPlaybooks, getRun, CADENCE_LABEL, safeJson, type Cadence } from "@/lib/operate";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { RunStatusBadge } from "@/components/operate/route-badge";
import { RunEvidence } from "@/components/operate/run-evidence";
import { DynBarChart } from "@/components/charts/dynamic";
import { CHART } from "@/components/charts/theme";
import { formatDate } from "@/lib/utils";
import { can } from "@/lib/rbac";
import { runIntelligence } from "../actions";
import {
  createStandingOrderAction,
  toggleStandingOrderAction,
  runStandingOrderAction,
  deleteStandingOrderAction,
  runDueAction,
  cancelRunAction,
} from "../operate-actions";

export const metadata = { title: "Automations" };

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { ANALYZE: "Analysis", STATUS: "Health check", DIGEST: "Digest", PLAYBOOK: "Playbook" };
const SOURCE_LABEL: Record<string, string> = { COMMAND: "Command", STANDING_ORDER: "Standing order", PLAYBOOK: "Playbook", MANUAL: "Manual" };

export default async function AutomationsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await requireOrgAccess();
  const ctx = opCtxFromSession(session);
  const [orders, runs, playbooks, focus, intel, imports] = await Promise.all([
    listStandingOrders(ctx),
    listRuns(ctx, { take: 40 }),
    listPlaybooks(ctx),
    searchParams.run ? getRun(ctx, searchParams.run) : Promise.resolve(null),
    prisma.intelligenceRun.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.importJob.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const canWrite = can(ctx.role, "write");
  const canRun = can(ctx.role, "run_intelligence");
  const pbName = new Map(playbooks.map((p) => [p.id, p.name]));
  const now = Date.now();
  const due = orders.filter((o) => o.enabled && o.nextRunAt && o.nextRunAt.getTime() <= now).length;

  // Run history by day (measured)
  const byDay = new Map<string, { day: string; succeeded: number; failed: number; waiting: number }>();
  for (const r of runs) {
    const day = r.createdAt.toISOString().slice(5, 10);
    const b = byDay.get(day) ?? { day, succeeded: 0, failed: 0, waiting: 0 };
    if (r.status === "SUCCEEDED") b.succeeded++;
    else if (r.status === "FAILED" || r.status === "CANCELLED") b.failed++;
    else b.waiting++;
    byDay.set(day, b);
  }
  const series = Array.from(byDay.values()).reverse();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Automations"
        title="Standing orders & run history"
        description="Recurring analysis, briefings, health checks, and playbooks — with a recorded run for every execution. There is no always-on worker on the current plan: due orders run when you press Run due, or when an external scheduler calls the authenticated tick."
        actions={
          canRun ? (
            <form action={runDueAction}>
              <Button type="submit">Run due now{due ? ` (${due})` : ""}</Button>
            </form>
          ) : undefined
        }
      />

      {focus ? (
        <Card className="border-amber-500/20" id="run">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">{focus.title} <RunStatusBadge status={focus.status} /></CardTitle>
              <CardDescription>
                {SOURCE_LABEL[focus.source] ?? focus.source} · started {focus.startedAt ? formatDate(focus.startedAt) : "—"}
                {focus.finishedAt ? ` · finished ${formatDate(focus.finishedAt)}` : ""}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {focus.status === "WAITING_APPROVAL" ? <Link href="/app/approvals" className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-neutral-950">Review approval</Link> : null}
              {canWrite && ["QUEUED", "WAITING_APPROVAL", "RUNNING"].includes(focus.status) ? (
                <form action={cancelRunAction.bind(null, focus.id)}><Button size="sm" variant="outline" type="submit">Cancel run</Button></form>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <RunEvidence stepsJson={focus.stepsJson} evidenceJson={focus.evidenceJson} status={focus.status} />
            {focus.error ? <p className="mt-3 text-xs text-red-300">Error: {focus.error}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Standing orders</CardTitle>
            <CardDescription>{orders.filter((o) => o.enabled).length} active · {due} due now</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <EmptyState className="m-5" title="No standing orders" description="Create one below, or tell Command “every day send me a digest”." />
            ) : (
              <ul className="divide-y divide-neutral-900">
                {orders.map((o) => {
                  const last = safeJson<{ runId?: string; error?: string }>(o.lastResultJson, {});
                  const isDue = o.enabled && o.nextRunAt && o.nextRunAt.getTime() <= now;
                  return (
                    <li key={o.id} className={`px-5 py-3 ${o.enabled ? "" : "opacity-60"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-100">{o.title}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {CADENCE_LABEL[o.cadence as Cadence] ?? o.cadence} · {KIND_LABEL[o.kind] ?? o.kind}
                            {o.playbookId ? ` · ${pbName.get(o.playbookId) ?? "playbook"}` : ""} · {o.runCount} run{o.runCount === 1 ? "" : "s"}
                            {o.failureCount ? ` · ${o.failureCount} failed` : ""}
                          </p>
                          <p className="mt-0.5 text-[11px] text-neutral-600">
                            {o.enabled ? (isDue ? <span className="text-amber-400">Due now</span> : `Next ${o.nextRunAt ? formatDate(o.nextRunAt) : "—"}`) : "Paused"}
                            {o.lastRunAt ? ` · last ${formatDate(o.lastRunAt)} ` : ""}
                            {o.lastStatus ? <RunStatusBadge status={o.lastStatus} className="ml-1" /> : null}
                            {last.runId ? <Link href={`/app/automations?run=${last.runId}`} className="ml-2 text-amber-400">run →</Link> : null}
                          </p>
                        </div>
                        {canWrite ? (
                          <div className="flex shrink-0 gap-1">
                            {canRun ? <form action={runStandingOrderAction.bind(null, o.id)}><Button size="sm" variant="secondary" type="submit">Run</Button></form> : null}
                            <form action={toggleStandingOrderAction.bind(null, o.id, !o.enabled)}><Button size="sm" variant="ghost" type="submit">{o.enabled ? "Pause" : "Resume"}</Button></form>
                            <form action={deleteStandingOrderAction.bind(null, o.id)}><Button size="sm" variant="ghost" type="submit" className="text-red-300">Remove</Button></form>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New standing order</CardTitle>
            <CardDescription>Pick a cadence and either a directive or a playbook.</CardDescription>
          </CardHeader>
          <CardContent>
            {canWrite ? (
              <form action={createStandingOrderAction} className="space-y-3">
                <label className="block text-xs text-neutral-400">
                  Cadence
                  <select name="cadence" defaultValue="DAILY" className="mt-1 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm">
                    <option value="HOURLY">Every hour</option>
                    <option value="DAILY">Every day</option>
                    <option value="WEEKLY">Every week</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Playbook (optional)
                  <select name="playbookId" defaultValue="" className="mt-1 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm">
                    <option value="">— none: use the directive —</option>
                    {playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Directive
                  <input name="directive" placeholder="e.g. executive digest · health check · analyze churn" className="mt-1 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm" />
                </label>
                <Button type="submit" className="w-full">Create standing order</Button>
              </form>
            ) : (
              <p className="text-sm text-neutral-500">Your role can view automations. Creating them needs Analyst or above.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {series.length ? (
        <DynBarChart
          title="Run outcomes"
          description="Recorded runs by day (last 40)"
          data={series}
          xKey="day"
          series={[
            { key: "succeeded", label: "Succeeded", color: CHART.emerald },
            { key: "waiting", label: "Waiting / queued", color: CHART.amber },
            { key: "failed", label: "Failed / cancelled", color: CHART.rose },
          ]}
          stacked
          height={200}
          footnote="Measured from recorded runs in this organization."
        />
      ) : null}

      <Card id="runs">
        <CardHeader>
          <CardTitle>Run history</CardTitle>
          <CardDescription>Command plans, playbooks, and standing orders. Each run records evidence per step.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <EmptyState className="m-5" title="No runs yet" description="Run a playbook or ask Command to analyze something." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-neutral-500">
                  <tr className="border-b border-neutral-900">
                    <th className="px-5 py-2 font-medium">Run</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Steps</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-5 py-2 font-medium">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => {
                    const total = (safeJson<unknown[]>(r.stepsJson, [])).length;
                    return (
                      <tr key={r.id} className={`border-b border-neutral-900/70 ${r.id === focus?.id ? "bg-amber-500/[0.04]" : ""}`}>
                        <td className="max-w-[280px] truncate px-5 py-2.5"><Link href={`/app/automations?run=${r.id}`} className="text-neutral-200 hover:text-amber-300">{r.title}</Link></td>
                        <td className="px-3 py-2.5 text-xs text-neutral-400">{SOURCE_LABEL[r.source] ?? r.source}</td>
                        <td className="px-3 py-2.5 text-xs text-neutral-400">{Math.min(r.currentStep, total)}/{total}</td>
                        <td className="px-3 py-2.5"><RunStatusBadge status={r.status} /></td>
                        <td className="px-5 py-2.5 text-xs text-neutral-500">{formatDate(r.startedAt ?? r.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Detection runs</CardTitle>
              <CardDescription>Rule-based detection across revenue and operations data.</CardDescription>
            </div>
            {canRun ? <form action={runIntelligence}><Button size="sm" variant="secondary" type="submit">Run detection</Button></form> : null}
          </CardHeader>
          <CardContent>
            {intel.length === 0 ? <EmptyState title="No detection runs" /> : (
              <ul className="space-y-2 text-sm">
                {intel.map((r) => (
                  <li key={r.id} className="flex items-center justify-between border-b border-neutral-900 py-1.5">
                    <span className="text-xs text-neutral-400">{formatDate(r.createdAt)} · {r.findingCount} open findings</span>
                    <RunStatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Import jobs</CardTitle>
            <CardDescription>CSV imports into your workspace. <Link href="/app/imports" className="text-amber-400">Import data →</Link></CardDescription>
          </CardHeader>
          <CardContent>
            {imports.length === 0 ? <EmptyState title="No imports" /> : (
              <ul className="space-y-2 text-sm">
                {imports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between border-b border-neutral-900 py-1.5">
                    <span className="truncate text-xs text-neutral-400">{r.kind} · {r.fileName} · {r.successCount}/{r.rowCount}</span>
                    <RunStatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
