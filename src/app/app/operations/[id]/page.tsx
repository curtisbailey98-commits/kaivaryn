import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { updateInefficiency, addInefficiencyNote, recordSavings } from "../actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge, PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { clientTitle, humanizeLabel } from "@/lib/labels";
import { MONEY } from "@/lib/money-glossary";
import { OE_STATUSES } from "@/lib/enums";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function InefficiencyDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  await requireEntitlement(ctx.organizationId, "OPERATIONS_EFFICIENCY");
  const item = await prisma.inefficiency.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: {
      notes: { include: { author: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } },
      evidence: { orderBy: { createdAt: "desc" }, take: 20 },
      assignee: { select: { name: true, email: true } },
      process: { select: { name: true } },
    },
  });
  if (!item) notFound();

  const [history, tasks, approvals] = await Promise.all([
    prisma.statusHistory.findMany({
      where: { organizationId: ctx.organizationId, entityType: "Inefficiency", entityId: params.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.task.findMany({
      where: { organizationId: ctx.organizationId, entityType: "Inefficiency", entityId: params.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { assignee: { select: { name: true, email: true } } },
    }),
    prisma.approvalRequest.findMany({
      where: { organizationId: ctx.organizationId, payloadJson: { contains: params.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { decidedBy: { select: { name: true, email: true } }, requestedBy: { select: { name: true, email: true } } },
    }),
  ]);
  const factors = item.scoreFactorsJson ? JSON.parse(item.scoreFactorsJson) : [];
  const showFactors = can(ctx.effectiveRole, "manage_settings") || can(ctx.effectiveRole, "approve");
  const canWrite = can(ctx.effectiveRole, "write");
  const canRecord = can(ctx.effectiveRole, "record_financial");
  const projected = item.projectedSavings || item.estimatedWasteAnnual;
  const realized = item.realizedSavings || item.recoveredAnnual;
  const projectedHours = item.projectedHoursWeekly ?? item.hoursWastedWeekly;
  const openTask = tasks.find((t) => t.status === "OPEN");
  const latestApproval = approvals[0];
  const ownerName = item.assignee?.name || item.assignee?.email || null;
  const suggestedNext = !ownerName
    ? "Assign an owner"
    : ["IDENTIFIED", "NEW"].includes(item.status)
      ? "Review the evidence"
      : item.status === "ANALYZING"
        ? "Agree the fix and request approval"
        : item.status === "APPROVED"
          ? "Start the fix"
          : ["REALIZED", "VERIFIED", "RESOLVED", "DISMISSED"].includes(item.status)
            ? "No action needed"
            : "Record realized savings";

  async function save(formData: FormData) {
    "use server";
    await updateInefficiency(params.id, formData);
  }
  async function note(formData: FormData) {
    "use server";
    await addInefficiencyNote(params.id, formData);
  }
  async function savings(formData: FormData) {
    "use server";
    await recordSavings(params.id, formData);
  }

  return (
    <div className="max-w-5xl">
      <Link href="/app/operations" className="text-xs text-neutral-500 hover:text-white">← Operations Efficiency</Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">{clientTitle(item.title)}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge status={item.status} />
        <PriorityBadge priority={item.priority} />
        <Badge tone="default">Confidence {Math.round(item.score)}</Badge>
        {item.automationCandidate ? <Badge tone="info">Automation candidate</Badge> : null}
        <span className="text-xs text-neutral-500">{[item.department, item.type ? humanizeLabel(item.type) : null, item.process?.name].filter(Boolean).join(" · ")} · identified {formatDate(item.identifiedAt)}</span>
      </div>
      {item.description ? <p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-300">{item.description}</p> : null}

      {/* What is it worth — projected vs realized, never summed */}
      <section className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-neutral-800 bg-neutral-800 sm:grid-cols-4" aria-label="Value">
        <div className="bg-neutral-950 p-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Annual cost</p>
          <p className="mt-1.5 text-xl font-semibold text-white sm:text-2xl">{formatCurrency(item.estimatedWasteAnnual)}</p>
          <p className="mt-0.5 text-[10px] text-neutral-600">Estimate · per year</p>
        </div>
        <div className="bg-neutral-950 p-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">{MONEY.projectedSavings.label}</p>
          <p className="mt-1.5 text-xl font-semibold text-amber-300 sm:text-2xl">{formatCurrency(projected)}</p>
          <p className="mt-0.5 text-[10px] text-neutral-600">Projection · per year</p>
        </div>
        <div className="bg-neutral-950 p-4">
          <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">{MONEY.realizedSavings.label}</p>
          <p className="mt-1.5 text-xl font-semibold text-emerald-400 sm:text-2xl">{formatCurrency(realized)}</p>
          <p className="mt-0.5 text-[10px] text-neutral-600">{item.verifiedAt ? `Recorded ${formatDate(item.verifiedAt)}` : realized > 0 ? "Recorded" : "Nothing recorded yet"}</p>
        </div>
        <div className="bg-neutral-950 p-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Hours / week</p>
          <p className="mt-1.5 text-xl font-semibold text-white sm:text-2xl">{projectedHours ?? "—"}<span className="text-sm font-normal text-neutral-500"> wasted</span></p>
          <p className="mt-0.5 text-[10px] text-neutral-600">{item.realizedHoursWeekly != null ? `${item.realizedHoursWeekly} h/wk recovered` : "None recovered yet"}</p>
        </div>
      </section>
      <p className="mt-2 text-xs text-neutral-500">Projected savings are never counted as realized. Automation and high-value savings require approval.</p>

      <section className="mt-6 grid gap-3 md:grid-cols-3" aria-label="Accountability">
        <div className="si-panel p-4">
          <p className="si-label">Owner</p>
          <p className="mt-2 text-sm font-medium text-white">{ownerName ?? <span className="text-amber-400">Unassigned</span>}</p>
        </div>
        <div className="si-panel p-4">
          <p className="si-label">Next action</p>
          <p className="mt-2 text-sm font-medium text-white">{openTask ? openTask.title : suggestedNext}</p>
          {openTask ? (
            <p className="mt-1 text-xs text-neutral-500">{[openTask.assignee?.name || openTask.assignee?.email, openTask.dueAt ? `due ${formatDate(openTask.dueAt)}` : null].filter(Boolean).join(" · ")}</p>
          ) : (
            <p className="mt-1 text-xs text-neutral-500">Suggested from current status</p>
          )}
        </div>
        <div className="si-panel p-4">
          <p className="si-label">Approval</p>
          {latestApproval ? (
            <>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-white">
                <Badge tone={latestApproval.status === "APPROVED" ? "success" : latestApproval.status === "PENDING" ? "warning" : "default"}>{humanizeLabel(latestApproval.status)}</Badge>
                <span className="text-xs text-neutral-400">{humanizeLabel(latestApproval.type)}</span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {latestApproval.status === "PENDING"
                  ? `Requested by ${latestApproval.requestedBy.name || latestApproval.requestedBy.email}`
                  : `${latestApproval.decidedBy?.name || latestApproval.decidedBy?.email || "Decided"}${latestApproval.decidedAt ? ` · ${formatDate(latestApproval.decidedAt)}` : ""}`}
              </p>
              {latestApproval.decisionNote ? <p className="mt-1 text-xs italic text-neutral-400">“{latestApproval.decisionNote}”</p> : null}
              <Link href={latestApproval.status === "PENDING" ? "/app/approvals" : "/app/approvals?view=all"} className="mt-2 inline-block text-xs text-amber-400 hover:text-amber-300">Open in Approvals →</Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-neutral-400">No approval requested yet</p>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-label="Evidence">
          <p className="si-label">Evidence</p>
          <ul className="mt-2 space-y-2 text-sm">
            {item.evidence.map((e) => (
              <li key={e.id} className="flex gap-2 rounded-md border border-neutral-900 px-3 py-2">
                <Badge className="shrink-0 self-start">{humanizeLabel(e.kind)}</Badge>
                <span className="text-neutral-300">{e.summary}</span>
              </li>
            ))}
            {!item.evidence.length ? <li className="text-neutral-500">No evidence attached yet</li> : null}
          </ul>
        </section>
        <section aria-label="Status history">
          <p className="si-label">Status history</p>
          <ol className="mt-2 space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="rounded-md border border-neutral-900 px-3 py-2">
                <p className="text-neutral-200">{h.fromStatus ? `${humanizeLabel(h.fromStatus)} → ` : ""}{humanizeLabel(h.toStatus)}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{h.actor?.name || h.actor?.email || "System"} · {formatDate(h.createdAt)}{h.note ? ` · ${h.note}` : ""}</p>
              </li>
            ))}
            {!history.length ? <li className="text-neutral-500">No status changes yet</li> : null}
          </ol>
        </section>
      </div>

      {tasks.length ? (
        <section className="mt-8 text-sm" aria-label="Tasks">
          <p className="si-label">Tasks</p>
          <ul className="mt-2 space-y-2">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-900 px-3 py-2">
                <StatusBadge status={t.status} /> <span className="text-neutral-200">{t.title}</span>
                <span className="text-xs text-neutral-500">{[t.assignee?.name || t.assignee?.email, t.dueAt ? `due ${formatDate(t.dueAt)}` : null].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8" aria-label="Notes">
        <p className="si-label">Notes</p>
        {can(ctx.effectiveRole, "comment") ? (
          <form action={note} className="mt-2 flex gap-2">
            <Input name="body" placeholder="Add a note…" className="flex-1" required />
            <Button type="submit" variant="secondary">Add</Button>
          </form>
        ) : null}
        <ul className="mt-3 space-y-3">
          {item.notes.map((n) => (
            <li key={n.id} className="rounded-md border border-neutral-900 p-3 text-sm">
              <p className="text-neutral-200">{n.body}</p>
              <p className="mt-1 text-xs text-neutral-500">{n.author.name || n.author.email} · {formatDate(n.createdAt)}</p>
            </li>
          ))}
          {!item.notes.length ? <li className="text-sm text-neutral-500">No notes yet</li> : null}
        </ul>
      </section>

      <section className="mt-10" aria-label="Take action">
        <p className="si-label">Take action</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {canRecord ? (
            <form action={savings} className="si-panel space-y-2 p-4 text-sm">
              <p className="font-medium text-white">Record realized savings</p>
              <Input name="realizedSavings" type="number" step="0.01" min="0" placeholder="Annualized savings realized (USD)" aria-label="Realized savings" required />
              <label className="flex items-center gap-2 text-xs text-neutral-400"><input type="checkbox" name="verified" /> Verified</label>
              <p className="text-[11px] text-neutral-500">Amounts above your approval limit are sent for approval first.</p>
              <Button type="submit" variant="secondary">Record</Button>
            </form>
          ) : (
            <div className="si-panel p-4 text-sm">
              <p className="font-medium text-white">Record realized savings</p>
              <p className="mt-2 text-xs text-neutral-500">A manager or above records realized savings.</p>
            </div>
          )}
        </div>

        {canWrite ? (
          <details className="si-panel mt-4 p-4 text-sm">
            <summary className="cursor-pointer select-none font-medium text-neutral-300 hover:text-white">Edit details</summary>
            <form action={save} className="mt-3 space-y-3">
              <label className="block text-xs text-neutral-400">Title<Input name="title" defaultValue={item.title} className="mt-1" /></label>
              <label className="block text-xs text-neutral-400">Description<Textarea name="description" defaultValue={item.description ?? ""} className="mt-1" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-neutral-400">Status
                  <select name="status" defaultValue={item.status} className="mt-1 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm text-neutral-100">
                    {OE_STATUSES.map((st) => <option key={st} value={st}>{humanizeLabel(st)}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">Priority
                  <select name="priority" defaultValue={item.priority} className="mt-1 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm text-neutral-100">
                    {["CRITICAL","HIGH","MEDIUM","LOW"].map((pr) => <option key={pr} value={pr}>{humanizeLabel(pr)}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">Projected savings / yr<Input name="projectedSavings" type="number" step="0.01" defaultValue={projected} className="mt-1" /></label>
                <label className="block text-xs text-neutral-400">Realized savings / yr<Input name="realizedSavings" type="number" step="0.01" defaultValue={realized} className="mt-1" /></label>
                <label className="block text-xs text-neutral-400">Hours wasted / week<Input name="hoursWastedWeekly" type="number" step="0.1" defaultValue={item.hoursWastedWeekly ?? ""} className="mt-1" /></label>
                <label className="block text-xs text-neutral-400">Reason for status change (optional)<Input name="statusNote" className="mt-1" /></label>
                <label className="col-span-full flex items-center gap-2 text-xs text-neutral-400">
                  <input type="checkbox" name="automationCandidate" defaultChecked={item.automationCandidate} /> Automation candidate
                </label>
              </div>
              <Button type="submit">Save changes</Button>
            </form>
          </details>
        ) : null}

        {showFactors && Array.isArray(factors) && factors.length > 0 ? (
          <details className="si-panel mt-4 p-4 text-xs">
            <summary className="cursor-pointer select-none text-sm font-medium text-neutral-300 hover:text-white">How the confidence score was calculated</summary>
            <ul className="mt-3 space-y-1">
              {factors.map((f: { key: string; label: string; contribution: number }) => (
                <li key={f.key} className="flex justify-between"><span>{f.label}</span><span className="font-mono text-neutral-400">{f.contribution.toFixed(1)}</span></li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </div>
  );
}
