import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { opCtxFromSession, getInitiativeDetail, listPlaybooks } from "@/lib/operate";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { RunStatusBadge } from "@/components/operate/route-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MONEY } from "@/lib/money-glossary";
import { can } from "@/lib/rbac";
import { linkInitiativeAction, runPlaybookAction, setInitiativeStatusAction } from "../../operate-actions";
import { clientTitle } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function InitiativeDetailPage({ params }: { params: { id: string } }) {
  const ctx = opCtxFromSession(await requireOrgAccess());
  const detail = await getInitiativeDetail(ctx, params.id);
  if (!detail) notFound();
  const { initiative, opps, ineffs, runs, playbooks: linkedPlaybooks, totals } = detail;
  const linked = new Set(initiative.links.map((l) => `${l.entityType}:${l.entityId}`));
  const [candidatesOpp, candidatesIneff, playbooks] = await Promise.all([
    prisma.opportunity.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { score: "desc" }, take: 15, select: { id: true, title: true } }),
    prisma.inefficiency.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { score: "desc" }, take: 15, select: { id: true, title: true } }),
    listPlaybooks(ctx),
  ]);
  const canWrite = can(ctx.role, "write");
  const canRun = can(ctx.role, "run_intelligence");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Link href="/app/initiatives" className="hover:text-amber-300">Initiatives</Link>}
        title={initiative.name}
        description={initiative.description || undefined}
        actions={
          <>
            <StatusBadge status={initiative.status} />
            {canWrite
              ? (["ACTIVE", "PAUSED", "COMPLETED"] as const)
                  .filter((s) => s !== initiative.status)
                  .map((s) => (
                    <form key={s} action={setInitiativeStatusAction.bind(null, initiative.id, s)}>
                      <Button size="sm" variant="ghost" type="submit">{s === "ACTIVE" ? "Reactivate" : s === "PAUSED" ? "Pause" : "Mark complete"}</Button>
                    </form>
                  ))
              : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [MONEY.pipelinePotential.label, totals.pipelinePotential, "Estimate"],
          [MONEY.cashRecovered.label, totals.cashRecovered, "Recorded outcome"],
          [MONEY.projectedSavings.label, totals.projectedSavings, "Estimate"],
          [MONEY.realizedSavings.label, totals.realizedSavings, "Recorded outcome"],
        ].map(([label, value, nature]) => (
          <div key={String(label)} className={`rounded-xl border p-4 ${nature === "Recorded outcome" ? "border-emerald-800/60 bg-emerald-950/20" : "border-neutral-800 bg-neutral-950/60"}`}>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-white">{formatCurrency(Number(value))}</p>
            <p className={`text-[10px] ${nature === "Recorded outcome" ? "text-emerald-400" : "text-neutral-500"}`}>{nature} · linked items only</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Linked work</CardTitle><CardDescription>{opps.length} revenue · {ineffs.length} operations</CardDescription></CardHeader>
          <CardContent className="p-0">
            {opps.length + ineffs.length === 0 ? <EmptyState className="m-5" title="Nothing linked yet" /> : (
              <ul className="divide-y divide-neutral-900">
                {opps.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <Link href={`/app/revenue/${o.id}`} className="min-w-0 truncate text-neutral-200 hover:text-amber-300"><span className="mr-2 text-[10px] uppercase text-neutral-500">RR</span>{clientTitle(o.title)}</Link>
                    <span className="flex shrink-0 items-center gap-2"><PriorityBadge priority={o.priority} /><span className="text-xs text-neutral-500">{formatCurrency(o.potentialAmount)} est.</span></span>
                  </li>
                ))}
                {ineffs.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <Link href={`/app/operations/${i.id}`} className="min-w-0 truncate text-neutral-200 hover:text-amber-300"><span className="mr-2 text-[10px] uppercase text-neutral-500">OE</span>{clientTitle(i.title)}</Link>
                    <span className="flex shrink-0 items-center gap-2"><PriorityBadge priority={i.priority} /><span className="text-xs text-neutral-500">{formatCurrency(i.projectedSavings)} proj.</span></span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Runs & playbooks</CardTitle><CardDescription>Runs started inside this initiative are linked automatically.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {linkedPlaybooks.length ? <p className="text-xs text-neutral-400">Playbooks: {linkedPlaybooks.map((p) => p.name).join(", ")}</p> : null}
            {runs.length === 0 ? <p className="text-sm text-neutral-500">No runs yet.</p> : (
              <ul className="space-y-2">
                {runs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/app/automations?run=${r.id}`} className="min-w-0 truncate text-neutral-200 hover:text-amber-300">{r.title}</Link>
                    <span className="flex items-center gap-2"><RunStatusBadge status={r.status} /><span className="text-[11px] text-neutral-500">{formatDate(r.createdAt)}</span></span>
                  </li>
                ))}
              </ul>
            )}
            {canRun ? (
              <form action={runPlaybookAction} className="flex gap-2">
                <input type="hidden" name="initiativeId" value={initiative.id} />
                <input type="hidden" name="back" value={`/app/initiatives/${initiative.id}`} />
                <select name="playbookId" className="h-9 min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm">
                  {playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Button size="sm" type="submit">Run here</Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {canWrite ? (
        <Card>
          <CardHeader><CardTitle>Link work</CardTitle><CardDescription>Only items from your organization are listed and accepted.</CardDescription></CardHeader>
          <CardContent>
            <form action={linkInitiativeAction} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="initiativeId" value={initiative.id} />
              <select name="target" className="h-10 min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm">
                <optgroup label="Revenue Recovery">
                  {candidatesOpp.filter((o) => !linked.has(`OPPORTUNITY:${o.id}`)).map((o) => <option key={o.id} value={`OPPORTUNITY:${o.id}`}>{clientTitle(o.title)}</option>)}
                </optgroup>
                <optgroup label="Operations Efficiency">
                  {candidatesIneff.filter((i) => !linked.has(`INEFFICIENCY:${i.id}`)).map((i) => <option key={i.id} value={`INEFFICIENCY:${i.id}`}>{clientTitle(i.title)}</option>)}
                </optgroup>
                <optgroup label="Playbooks">
                  {playbooks.filter((p) => !linked.has(`PLAYBOOK:${p.id}`)).map((p) => <option key={p.id} value={`PLAYBOOK:${p.id}`}>{p.name}</option>)}
                </optgroup>
              </select>
              <Button type="submit">Link</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
