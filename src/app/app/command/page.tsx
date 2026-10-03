import Link from "next/link";
import { requireOrgAccess } from "@/lib/tenant";
import { opCtxFromSession, listCommandHistory, COMMAND_EXAMPLES, COMMAND_HELP, safeJson, type CommandLink } from "@/lib/operate";
import type { NlAnswer } from "@/lib/nl-query";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { CommandBar } from "@/components/operate/command-bar";
import { RouteBadge, RunStatusBadge } from "@/components/operate/route-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { can } from "@/lib/rbac";
import { formatInZone } from "@/lib/operate";
import { confirmPromptAutomationAction } from "../operate-actions";

type AutomationPreviewData = {
  prompt: string;
  ok: boolean;
  title: string;
  schedule: string | null;
  timezone: string;
  actions: string[];
  condition: string | null;
  deliveryNote: string | null;
  nextRuns: string[];
  assumptions: string[];
  unparsed: string[];
  problems: string[];
};

function AutomationConfirm({ p, canWrite, saved }: { p: AutomationPreviewData; canWrite: boolean; saved: boolean }) {
  return (
    <div className="mt-4 rounded-xl border border-amber-500/25 bg-neutral-950/70 p-4">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {[
          ["Schedule", p.schedule ?? "Not understood"],
          ["Time zone", p.timezone],
          ["Action", p.actions.join(" → ") || "Not understood"],
          ["Threshold", p.condition ?? "None"],
          ["Delivery", p.deliveryNote ? `Inbox — ${p.deliveryNote}` : "Kaivaryn Inbox"],
          ["Next run", p.nextRuns[0] ? formatInZone(new Date(p.nextRuns[0]), p.timezone) : "—"],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wider text-neutral-500">{k}</dt>
            <dd className={`mt-0.5 break-words ${v === "Not understood" ? "text-red-300" : "text-neutral-100"}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {p.assumptions.length ? <p className="mt-3 text-xs leading-5 text-amber-300/90">Assumptions: {p.assumptions.join(" ")}</p> : null}
      {p.unparsed.length ? <p className="mt-1 text-xs leading-5 text-red-300">Not understood (ignored): {p.unparsed.map((w) => `“${w}”`).join(", ")}</p> : null}
      {p.problems.length ? <ul className="mt-2 list-disc pl-5 text-xs leading-5 text-red-300">{p.problems.map((x) => <li key={x}>{x}</li>)}</ul> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {saved ? (
          <span className="text-xs text-emerald-300">Saved — see Automations.</span>
        ) : p.ok && canWrite ? (
          <form action={confirmPromptAutomationAction}>
            <input type="hidden" name="prompt" value={p.prompt} />
            <button type="submit" className="inline-flex h-10 items-center rounded-md bg-amber-500 px-4 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400">Confirm &amp; schedule</button>
          </form>
        ) : null}
        <Link href={`/app/automations?prompt=${encodeURIComponent(p.prompt)}#preview`} className="inline-flex h-10 items-center rounded-md border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-amber-500/60 hover:text-amber-300">
          {p.ok ? "Edit first" : "Finish in Automations"}
        </Link>
      </div>
    </div>
  );
}

export const metadata = { title: "Command" };

export const dynamic = "force-dynamic";

function AnswerTable({ answer }: { answer: NlAnswer }) {
  const metrics = Object.entries(answer.metrics || {});
  return (
    <div className="mt-4 space-y-3">
      {metrics.length ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.slice(0, 8).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">{k.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}</p>
              <p className="mt-1 text-lg font-semibold text-white">{typeof v === "number" && Math.abs(v) >= 100 && /amount|recovered|potential|savings|value|pipeline|cash/i.test(k) ? formatCurrency(v) : String(v)}</p>
            </div>
          ))}
        </div>
      ) : null}
      {answer.rows?.length ? (
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/60 text-neutral-500">
              <tr>{Object.keys(answer.rows[0]!).map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {answer.rows.slice(0, 10).map((r, i) => (
                <tr key={i} className="border-t border-neutral-900">
                  {Object.entries(r).map(([k, v]) => <td key={k} className="px-3 py-2 text-neutral-300">{typeof v === "number" && /amount|value|savings/i.test(k) ? formatCurrency(v) : String(v ?? "—")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default async function CommandPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await requireOrgAccess();
  const ctx = opCtxFromSession(session);
  const [history, focus] = await Promise.all([
    listCommandHistory(ctx, 20),
    searchParams.c ? prisma.opCommand.findFirst({ where: { id: searchParams.c, organizationId: ctx.organizationId } }) : Promise.resolve(null),
  ]);
  const focusData = focus ? safeJson<Record<string, unknown>>(focus.resultJson, {}) : null;
  const focusLinks = focus ? safeJson<CommandLink[]>(focus.linksJson, []) : [];
  const answer = focusData?.answer as NlAnswer | undefined;
  const runId = focusData?.runId as string | undefined;
  const run = runId ? await prisma.opRun.findFirst({ where: { id: runId, organizationId: ctx.organizationId }, select: { id: true, status: true, title: true } }) : null;
  const canRun = can(ctx.role, "run_intelligence");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Command"
        title="Direct the operating intelligence"
        description="One bar for every ask. Kaivaryn routes it — analysis, answer, plan, briefing, schedule, or playbook — and leaves a record. Rule-based and auditable; no generative AI model is called."
      />

      <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/70 to-neutral-950 p-4 sm:p-6">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" aria-hidden />
        <CommandBar defaultValue={searchParams.q} examples={COMMAND_EXAMPLES} autoFocus />
        {!canRun ? <p className="mt-3 text-xs text-neutral-500">Your role ({ctx.role}) can ask questions, check status, and read briefings. Analysis and plans need Analyst or above.</p> : null}
      </div>

      {focus ? (
        <Card className="border-amber-500/20">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <RouteBadge route={focus.route} />
              <RunStatusBadge status={focus.status} />
              <span className="truncate text-sm text-neutral-300">“{focus.text}”</span>
            </div>
            <span className="text-[11px] text-neutral-500">{formatDate(focus.createdAt)} · routed by {focus.routeReason.replace(/_/g, " ")}</span>
          </CardHeader>
          <CardContent>
            <p className="text-[15px] leading-7 text-neutral-100">{focus.message}</p>
            {answer ? <AnswerTable answer={answer} /> : null}
            {focus.route === "STANDING" && focusData?.automationPreview ? (
              <AutomationConfirm p={focusData.automationPreview as AutomationPreviewData} canWrite={can(ctx.role, "write")} saved={false} />
            ) : null}
            {run ? (
              <p className="mt-3 text-xs text-neutral-400">
                Run <Link className="text-amber-400 hover:text-amber-300" href={`/app/automations?run=${run.id}`}>{run.title}</Link> · <RunStatusBadge status={run.status} />
              </p>
            ) : null}
            {focus.route === "HELP" ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {COMMAND_HELP.map((h) => (
                  <div key={h.route} className="rounded-lg border border-neutral-800 p-3">
                    <div className="flex items-center gap-2"><RouteBadge route={h.route} /><span className="text-[11px] text-neutral-500">{h.triggers}</span></div>
                    <p className="mt-2 text-xs leading-5 text-neutral-400">{h.does}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {focusLinks.length && !(focus.route === "STANDING" && focusData?.automationPreview) ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {focusLinks.map((l) => (
                  <Link key={l.href + l.label} href={l.href} className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 transition hover:border-amber-500/60 hover:text-amber-300">
                    {l.label} →
                  </Link>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Command record</CardTitle>
            <CardDescription>Every ask in this organization, newest first. Not a chat transcript — a log of what was routed and what happened.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {history.length === 0 ? (
              <EmptyState className="m-5" title="No commands yet" description="Try “Brief me on what changed” or “Analyze revenue leakage”." />
            ) : (
              <ul className="divide-y divide-neutral-900">
                {history.map((c) => (
                  <li key={c.id}>
                    <Link href={`/app/command?c=${c.id}`} className={`flex flex-col gap-1 px-5 py-3 transition hover:bg-neutral-900/50 ${c.id === focus?.id ? "bg-amber-500/[0.04]" : ""}`}>
                      <div className="flex items-center gap-2">
                        <RouteBadge route={c.route} />
                        {c.status !== "OK" ? <RunStatusBadge status={c.status} /> : null}
                        <span className="truncate text-sm text-neutral-200">{c.text}</span>
                      </div>
                      <p className="line-clamp-1 text-xs text-neutral-500">{c.message}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>How routing works</CardTitle>
            <CardDescription>Keyword rules, evaluated in order. Unrecognized directives default to an analysis cycle, so every ask does something real.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {COMMAND_HELP.slice(0, 8).map((h) => (
              <div key={h.route} className="flex gap-3">
                <RouteBadge route={h.route} className="mt-0.5 shrink-0" />
                <p className="text-xs leading-5 text-neutral-400">{h.does}</p>
              </div>
            ))}
            <Link href="/app/command?q=help" className="inline-block text-xs text-amber-400 hover:text-amber-300">Full reference →</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
