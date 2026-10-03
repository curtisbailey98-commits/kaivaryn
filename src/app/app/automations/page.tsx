import Link from "next/link";
import { requireOrgAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import {
  opCtxFromSession,
  listStandingOrders,
  listRuns,
  listPlaybooks,
  getRun,
  safeJson,
  previewAutomationPrompt,
  describeOrderSchedule,
  orderSchedule,
  orderCondition,
  describeCondition,
  formatInZone,
  relativeTime,
  tickTokenConfigured,
  lastSchedulerTick,
  orgTimezone,
  COMMON_TIMEZONES,
  METRIC_LABEL,
  METRIC_IS_MONEY,
  type MetricKey,
} from "@/lib/operate";
import { AutomationPromptBar } from "@/components/operate/automation-prompt-bar";
import { AutomationForm, type AutomationFormDefaults } from "@/components/operate/automation-form";
import { CheckCircle2, AlertTriangle, HelpCircle, Clock3 } from "lucide-react";
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
  toggleStandingOrderAction,
  runStandingOrderAction,
  deleteStandingOrderAction,
  runDueAction,
  cancelRunAction,
} from "../operate-actions";

export const metadata = { title: "Automations" };

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { ANALYZE: "Analysis", STATUS: "Health check", DIGEST: "Briefing", PLAYBOOK: "Playbook", DETECT: "Detection", RECALL: "Recall", WATCH: "Threshold watch", MULTI: "Multi-step" };
const METRICS = (Object.keys(METRIC_LABEL) as MetricKey[]).map((k) => ({ key: k, label: METRIC_LABEL[k], money: METRIC_IS_MONEY[k] }));
const TRIGGER_LABEL: Record<string, string> = { TICK: "automatic", RUN_DUE: "run due", MANUAL: "manual" };
const SOURCE_LABEL: Record<string, string> = { COMMAND: "Command", STANDING_ORDER: "Standing order", PLAYBOOK: "Playbook", MANUAL: "Manual" };

export default async function AutomationsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await requireOrgAccess();
  const ctx = opCtxFromSession(session);
  const prompt = (searchParams.prompt ?? "").trim().slice(0, 600);
  const [orders, runs, playbooks, focus, intel, imports, preview, tz, lastTick] = await Promise.all([
    listStandingOrders(ctx),
    listRuns(ctx, { take: 40 }),
    listPlaybooks(ctx),
    searchParams.run ? getRun(ctx, searchParams.run) : Promise.resolve(null),
    prisma.intelligenceRun.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.importJob.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" }, take: 8 }),
    prompt ? previewAutomationPrompt(ctx, prompt) : Promise.resolve(null),
    orgTimezone(ctx.organizationId),
    lastSchedulerTick(),
  ]);
  const schedulerOn = tickTokenConfigured();
  const created = searchParams.created ? orders.find((o) => o.id === searchParams.created) ?? null : null;
  const d = preview?.draft;
  const formDefaults: AutomationFormDefaults = d
    ? {
        prompt,
        cadence: d.schedule?.cadence,
        everyHours: d.schedule?.everyHours,
        time: d.schedule ? `${String(d.schedule.hour).padStart(2, "0")}:${String(d.schedule.minute).padStart(2, "0")}` : undefined,
        daysOfWeek: d.schedule?.daysOfWeek,
        dayOfMonth: d.schedule?.dayOfMonth,
        timezone: d.timezone,
        actions: d.actions.map((a) => (a.kind === "ANALYZE" ? `ANALYZE:${a.product ?? "BOTH"}` : a.kind === "PLAYBOOK" ? `PLAYBOOK:${a.playbookSlug}` : a.kind)),
        metric: d.condition?.metric,
        op: d.condition?.op,
        amount: d.condition ? String(d.condition.amount) : undefined,
      }
    : { timezone: tz, cadence: "WEEKLY", daysOfWeek: [1], time: "08:00", actions: ["DIGEST"] };
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
        title="Tell Kaivaryn what to run, and when"
        description="Describe an automation in plain English. Kaivaryn shows you exactly what it will set up — schedule, time zone, action, threshold, and next run — before anything is saved. Every run is recorded below."
        actions={
          canRun ? (
            <form action={runDueAction}>
              <Button type="submit" variant="outline">Run due now{due ? ` (${due})` : ""}</Button>
            </form>
          ) : undefined
        }
      />

      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-2.5 text-xs ${schedulerOn ? "border-emerald-900/60 bg-emerald-950/20 text-neutral-300" : "border-neutral-800 bg-neutral-950/60 text-neutral-400"}`}>
        <span className="flex items-center gap-2 font-medium">
          <span className={`h-2 w-2 rounded-full ${schedulerOn ? "bg-emerald-400" : "bg-neutral-600"}`} />
          {schedulerOn ? "Scheduler on" : "Scheduler not configured"}
        </span>
        <span className="text-neutral-500">
          {schedulerOn
            ? `Checks for due automations about every 15 minutes (external scheduler; GitHub can delay a check).${lastTick ? ` Last check ${formatInZone(lastTick.startedAt, tz)} (${relativeTime(lastTick.startedAt)}).` : " No check recorded yet."}`
            : "Due automations run only when someone presses Run due now."}
        </span>
        <Link href="/app/operate" className="text-amber-400 hover:text-amber-300">Health →</Link>
      </div>

      {created ? (
        <Card className="border-emerald-800/60 bg-emerald-950/10" id="created">
          <CardContent className="flex flex-wrap items-start gap-3 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Scheduled: {created.title}</p>
              <p className="mt-1 text-xs leading-5 text-neutral-400">
                {describeOrderSchedule(created)} · next run{" "}
                <span className="text-neutral-200">{created.nextRunAt ? `${formatInZone(created.nextRunAt, created.timezone ?? tz)} (${relativeTime(created.nextRunAt)})` : "—"}</span>
                {schedulerOn ? " · runs automatically" : " · press Run due now when it is due"}
              </p>
              {created.prompt ? <p className="mt-1 text-[11px] text-neutral-500">From: “{created.prompt}”</p> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/70 to-neutral-950 p-4 sm:p-6">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" aria-hidden />
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-500/90">New automation</p>
        <AutomationPromptBar defaultValue={prompt} />
        <p className="mt-3 text-[11px] leading-5 text-neutral-500">
          Understands schedules (hourly, every 2 hours, daily at 7, weekdays at 9, every Monday and Thursday, the 1st or last day of the month), time zones (ET, CT, MT, PT, UTC),
          actions (briefing, analysis of Revenue Recovery / Operations Efficiency / both, detection, health check, any playbook by name), and thresholds (“alert me if leakage is over $50k”).
          Rule-based — no generative AI model is called.
        </p>
      </div>

      {preview && d ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]" id="preview">
          <Card className={d.ok ? "border-amber-500/30" : "border-red-900/60"}>
            <CardHeader>
              <CardTitle>{d.ok ? "Here’s what I’ll set up" : "I need a bit more"}</CardTitle>
              <CardDescription>“{prompt}”</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-2 text-sm">
                {[
                  ["Schedule", preview.scheduleText ?? "Not understood — choose one in the form"],
                  ["Time zone", d.timezone],
                  ["Action", preview.actionsText.length ? preview.actionsText.join(" → ") : "Not understood — choose one in the form"],
                  ["Threshold", preview.conditionText ?? "None"],
                  ["Delivery", d.deliveryNote ? `Inbox — ${d.deliveryNote}` : "Kaivaryn Inbox"],
                  ["Next runs", preview.nextRuns.length ? preview.nextRuns.map((n) => formatInZone(n, d.timezone)).join("  ·  ") : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[92px_1fr] gap-3 border-b border-neutral-900 pb-2 last:border-0">
                    <dt className="text-[11px] uppercase tracking-wider text-neutral-500">{k}</dt>
                    <dd className={`min-w-0 break-words ${String(v).startsWith("Not understood") ? "text-red-300" : "text-neutral-100"}`}>{v}</dd>
                  </div>
                ))}
              </dl>
              {preview.nextRuns[0] ? (
                <p className="flex items-center gap-2 text-xs text-neutral-400"><Clock3 className="h-3.5 w-3.5 text-amber-400" /> First run {relativeTime(preview.nextRuns[0])}{schedulerOn ? ", automatically." : " — press Run due now when it is due (scheduler not configured)."}</p>
              ) : null}
              {d.recognized.length ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-neutral-500">Understood</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {d.recognized.map((r, i) => (
                      <li key={i} className="rounded-md border border-neutral-800 bg-neutral-950/70 px-2 py-1 text-[11px] text-neutral-400"><span className="text-neutral-200">“{r.text}”</span> → {r.meaning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {d.assumptions.length ? (
                <div className="rounded-lg border border-amber-900/50 bg-amber-950/10 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400"><HelpCircle className="h-3.5 w-3.5" /> Assumptions — change them in the form</p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs leading-5 text-neutral-300">{d.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
                </div>
              ) : null}
              {d.unparsed.length ? (
                <div className="rounded-lg border border-red-900/50 bg-red-950/10 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-red-300"><AlertTriangle className="h-3.5 w-3.5" /> Not understood — ignored</p>
                  <p className="mt-1.5 text-xs text-neutral-300">{d.unparsed.map((w) => `“${w}”`).join(", ")}</p>
                </div>
              ) : null}
              {d.problems.length ? (
                <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-red-300"><AlertTriangle className="h-3.5 w-3.5" /> Needs your input</p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs leading-5 text-neutral-200">{d.problems.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{d.ok ? "Confirm or adjust" : "Fill in the missing parts"}</CardTitle>
              <CardDescription>Prefilled from your prompt. Nothing is saved until you confirm.</CardDescription>
            </CardHeader>
            <CardContent>
              {canWrite ? (
                <AutomationForm defaults={formDefaults} playbooks={playbooks.map((p) => ({ slug: p.slug, name: p.name }))} timezones={COMMON_TIMEZONES} metrics={METRICS} />
              ) : (
                <p className="text-sm text-neutral-500">Your role can preview automations. Saving them needs Analyst or above.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

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
            <CardTitle>Your automations</CardTitle>
            <CardDescription>{orders.filter((o) => o.enabled).length} active · {due} due now · times shown in each automation&apos;s time zone</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <EmptyState className="m-5" title="No automations yet" description="Describe one above — e.g. “Every Monday at 8am send me a briefing”." />
            ) : (
              <ul className="divide-y divide-neutral-900">
                {orders.map((o) => {
                  const last = safeJson<{ runId?: string; error?: string; trigger?: string }>(o.lastResultJson, {});
                  const zone = orderSchedule(o)?.timezone ?? tz;
                  const cond = orderCondition(o);
                  const isDue = o.enabled && o.nextRunAt && o.nextRunAt.getTime() <= now;
                  return (
                    <li key={o.id} className={`px-5 py-3 ${o.enabled ? "" : "opacity-60"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-100">{o.title}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {describeOrderSchedule(o)} · {KIND_LABEL[o.kind] ?? o.kind}
                            {o.playbookId ? ` · ${pbName.get(o.playbookId) ?? "playbook"}` : ""}
                            {cond ? ` · ${describeCondition(cond)}` : ""} · {o.runCount} run{o.runCount === 1 ? "" : "s"}
                            {o.failureCount ? ` · ${o.failureCount} failed` : ""}
                          </p>
                          {o.prompt ? <p className="mt-0.5 truncate text-[11px] italic text-neutral-600">“{o.prompt}”</p> : null}
                          <p className="mt-0.5 text-[11px] text-neutral-500">
                            {o.enabled ? (isDue ? <span className="text-amber-400">Due now</span> : <>Next <span className="text-neutral-300">{o.nextRunAt ? formatInZone(o.nextRunAt, zone) : "—"}</span>{o.nextRunAt ? ` (${relativeTime(o.nextRunAt)})` : ""}</>) : "Paused"}
                            {o.lastRunAt ? ` · last ${formatInZone(o.lastRunAt, zone)}${last.trigger ? ` (${TRIGGER_LABEL[last.trigger] ?? last.trigger})` : ""} ` : ""}
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
            <CardTitle>Set one up by hand</CardTitle>
            <CardDescription>Same result as a prompt — pick the schedule, action, and an optional threshold.</CardDescription>
          </CardHeader>
          <CardContent>
            {canWrite ? (
              <AutomationForm defaults={preview ? { timezone: tz, cadence: "WEEKLY", daysOfWeek: [1], time: "08:00", actions: ["DIGEST"] } : formDefaults} playbooks={playbooks.map((p) => ({ slug: p.slug, name: p.name }))} timezones={COMMON_TIMEZONES} metrics={METRICS} submitText="Create automation" />
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
