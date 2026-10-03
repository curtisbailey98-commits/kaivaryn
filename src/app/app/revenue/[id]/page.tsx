import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  updateOpportunity,
  addOpportunityNote,
  assignOpportunity,
  recordRecovery,
  draftOpportunityEmail,
  createOpportunityTask,
  requestExternalAction,
} from "../actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge, PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { clientTitle, humanizeLabel } from "@/lib/labels";
import { classifyLeakageType } from "@/lib/leakage-taxonomy";
import { MONEY } from "@/lib/money-glossary";
import { RR_STATUSES } from "@/lib/enums";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  await requireEntitlement(ctx.organizationId, "REVENUE_RECOVERY");

  const opp = await prisma.opportunity.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: {
      notes: { include: { author: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } },
      assignee: { select: { id: true, name: true, email: true } },
      evidence: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!opp) notFound();

  const [members, history, drafts, tasks, approvals] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: ctx.organizationId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.statusHistory.findMany({
      where: { organizationId: ctx.organizationId, entityType: "Opportunity", entityId: params.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.emailDraft.findMany({
      where: { organizationId: ctx.organizationId, entityType: "Opportunity", entityId: params.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.task.findMany({
      where: { organizationId: ctx.organizationId, entityType: "Opportunity", entityId: params.id },
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

  const factors = opp.scoreFactorsJson ? JSON.parse(opp.scoreFactorsJson) : [];
  const showFactors = can(ctx.effectiveRole, "manage_settings") || can(ctx.effectiveRole, "approve");
  const canWrite = can(ctx.effectiveRole, "write");
  const canAssign = can(ctx.effectiveRole, "assign");
  const canRecord = can(ctx.effectiveRole, "record_financial");
  const estimate = opp.potentialAmount || opp.estimatedAmount;
  const openTask = tasks.find((t) => t.status === "OPEN");
  const latestApproval = approvals[0];
  const ownerName = opp.assignee?.name || opp.assignee?.email || null;
  const suggestedNext = !ownerName
    ? "Assign an owner"
    : ["IDENTIFIED", "NEW"].includes(opp.status)
      ? "Review the evidence"
      : opp.status === "UNDER_REVIEW"
        ? "Approve or dismiss"
        : opp.status === "APPROVED"
          ? "Start recovery"
          : ["RECOVERED", "PARTIALLY_RECOVERED"].includes(opp.status) && opp.verifiedAmount < opp.recoveredAmount
            ? "Verify recovered cash against evidence"
            : ["VERIFIED", "DISMISSED"].includes(opp.status)
              ? "No action needed"
              : "Record recovered cash";

  async function save(formData: FormData) {
    "use server";
    await updateOpportunity(params.id, formData);
  }
  async function note(formData: FormData) {
    "use server";
    await addOpportunityNote(params.id, formData);
  }
  async function assign(formData: FormData) {
    "use server";
    await assignOpportunity(params.id, formData);
  }
  async function recovery(formData: FormData) {
    "use server";
    await recordRecovery(params.id, formData);
  }
  async function draft(formData: FormData) {
    "use server";
    await draftOpportunityEmail(params.id, formData);
  }
  async function task(formData: FormData) {
    "use server";
    await createOpportunityTask(params.id, formData);
  }
  async function external(formData: FormData) {
    "use server";
    await requestExternalAction(params.id, formData);
  }

  return (
    <div className="max-w-5xl">
      <Link href="/app/revenue" className="text-xs text-neutral-500 hover:text-white">← Revenue Recovery</Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">{clientTitle(opp.title)}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge status={opp.status} />
        <PriorityBadge priority={opp.priority} />
        <Badge tone="default">Confidence {Math.round(opp.score)}</Badge>
        <span className="text-xs text-neutral-500">{[classifyLeakageType(opp.type).label, opp.department, opp.source ? humanizeLabel(opp.source) : null].filter(Boolean).join(" · ")} · identified {formatDate(opp.identifiedAt)}</span>
      </div>
      {opp.description ? <p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-300">{opp.description}</p> : null}

      {/* What is it worth — estimate vs recorded, never summed */}
      <section className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-neutral-800 bg-neutral-800 sm:grid-cols-4" aria-label="Value">
        <div className="bg-neutral-950 p-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Estimated value</p>
          <p className="mt-1.5 text-xl font-semibold text-amber-300 sm:text-2xl">{formatCurrency(estimate)}</p>
          <p className="mt-0.5 text-[10px] text-neutral-600">Estimate</p>
        </div>
        <div className="bg-neutral-950 p-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Approved for recovery</p>
          <p className="mt-1.5 text-xl font-semibold text-white sm:text-2xl">{formatCurrency(opp.approvedAmount)}</p>
          <p className="mt-0.5 text-[10px] text-neutral-600">{formatCurrency(opp.inProgressAmount)} in progress</p>
        </div>
        <div className="bg-neutral-950 p-4">
          <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">{MONEY.cashRecovered.label}</p>
          <p className="mt-1.5 text-xl font-semibold text-emerald-400 sm:text-2xl">{formatCurrency(opp.recoveredAmount)}</p>
          <p className="mt-0.5 text-[10px] text-neutral-600">{opp.recoveredAt ? `Recorded ${formatDate(opp.recoveredAt)}` : "Nothing recorded yet"}</p>
        </div>
        <div className="bg-neutral-950 p-4">
          <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">{MONEY.verifiedRecovered.label}</p>
          <p className="mt-1.5 text-xl font-semibold text-emerald-300 sm:text-2xl">{formatCurrency(opp.verifiedAmount)}</p>
          <p className="mt-0.5 text-[10px] text-neutral-600">{opp.verifiedAt ? `Verified ${formatDate(opp.verifiedAt)}` : "Not yet verified"}</p>
        </div>
      </section>
      <p className="mt-2 text-xs text-neutral-500">Estimates are never counted as recovered. Verified recovery is confirmed against evidence and cannot exceed cash recovered.</p>

      {/* Who owns it, what happens next, what was approved */}
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
            {opp.evidence.map((e) => (
              <li key={e.id} className="flex gap-2 rounded-md border border-neutral-900 px-3 py-2">
                <Badge className="shrink-0 self-start">{humanizeLabel(e.kind)}</Badge>
                <span className="text-neutral-300">{e.summary}</span>
              </li>
            ))}
            {!opp.evidence.length ? <li className="text-neutral-500">No evidence attached yet</li> : null}
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

      <section className="mt-8" aria-label="Notes">
        <p className="si-label">Notes</p>
        {can(ctx.effectiveRole, "comment") ? (
          <form action={note} className="mt-2 flex gap-2">
            <Input name="body" placeholder="Add a note…" className="flex-1" required />
            <Button type="submit" variant="secondary">Add</Button>
          </form>
        ) : null}
        <ul className="mt-3 space-y-3">
          {opp.notes.map((n) => (
            <li key={n.id} className="rounded-md border border-neutral-900 p-3 text-sm">
              <p className="text-neutral-200">{n.body}</p>
              <p className="mt-1 text-xs text-neutral-500">{n.author.name || n.author.email} · {formatDate(n.createdAt)}</p>
            </li>
          ))}
          {!opp.notes.length ? <li className="text-sm text-neutral-500">No notes yet</li> : null}
        </ul>
      </section>

      {tasks.length || drafts.length ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {tasks.length ? (
            <section className="text-sm" aria-label="Tasks">
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
          {drafts.length ? (
            <section className="text-sm" aria-label="Email drafts">
              <p className="si-label">Email drafts</p>
              <ul className="mt-2 space-y-2">
                {drafts.map((d) => (
                  <li key={d.id} className="rounded-md border border-neutral-900 px-3 py-2">
                    <Badge>Draft</Badge> {d.subject}
                    <p className="mt-1 text-xs text-neutral-500">Not sent · {formatDate(d.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      <section className="mt-10" aria-label="Take action">
        <p className="si-label">Take action</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {canAssign ? (
            <form action={assign} className="si-panel space-y-2 p-4 text-sm">
              <p className="font-medium text-white">Assign owner</p>
              <select name="assigneeId" defaultValue={opp.assigneeId ?? ""} aria-label="Owner" className="h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2">
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>{m.user.name || m.user.email}</option>
                ))}
              </select>
              <Button type="submit" variant="secondary">Assign</Button>
            </form>
          ) : null}
          {canRecord ? (
            <form action={recovery} className="si-panel space-y-2 p-4 text-sm">
              <p className="font-medium text-white">Record recovered cash</p>
              <Input name="recoveredAmount" type="number" step="0.01" min="0" placeholder="Amount recovered (USD)" aria-label="Amount recovered" required />
              <label className="flex items-center gap-2 text-xs text-neutral-400"><input type="checkbox" name="verified" /> Verified against evidence</label>
              <p className="text-[11px] text-neutral-500">Amounts above your approval limit are sent for approval first.</p>
              <Button type="submit" variant="secondary">Record</Button>
            </form>
          ) : (
            <div className="si-panel p-4 text-sm">
              <p className="font-medium text-white">Record recovered cash</p>
              <p className="mt-2 text-xs text-neutral-500">A manager or above records recovered and verified amounts.</p>
            </div>
          )}
          {canWrite ? (
            <form action={task} className="si-panel space-y-2 p-4 text-sm">
              <p className="font-medium text-white">Add a next step</p>
              <Input name="title" placeholder="What needs to happen next?" aria-label="Task" required />
              <Input name="dueAt" type="date" aria-label="Due date" />
              <Button type="submit" variant="secondary">Create task</Button>
            </form>
          ) : null}
          {canWrite ? (
            <form action={external} className="si-panel space-y-2 p-4 text-sm">
              <p className="font-medium text-white">Request approval for an outside action</p>
              <p className="text-[11px] text-neutral-500">Queues an approval. Nothing runs in your systems until it is approved and the system is connected.</p>
              <select name="provider" aria-label="System" className="h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2">
                <option value="billing_system">Billing system</option>
                <option value="erp_generic">ERP</option>
                <option value="claims_payer">Claims / payer portal</option>
              </select>
              <select name="action" aria-label="Action" defaultValue="sync_claim" className="h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2">
                <option value="sync_claim">Submit adjustment or appeal</option>
                <option value="issue_invoice">Issue corrected invoice</option>
                <option value="apply_credit">Apply credit or fee</option>
              </select>
              <Button type="submit" variant="secondary">Request approval</Button>
            </form>
          ) : null}
        </div>

        {canWrite ? (
          <details className="si-panel mt-4 p-4 text-sm">
            <summary className="cursor-pointer select-none font-medium text-neutral-300 hover:text-white">Draft an email (saved, never sent)</summary>
            <form action={draft} className="mt-3 space-y-2">
              <Input name="to" placeholder="To" aria-label="To" />
              <Input name="subject" defaultValue={`Regarding: ${clientTitle(opp.title)}`} aria-label="Subject" />
              <Textarea name="body" placeholder="Draft…" aria-label="Body" required />
              <Button type="submit" variant="secondary">Save draft</Button>
            </form>
          </details>
        ) : null}

        {canWrite ? (
          <details className="si-panel mt-4 p-4 text-sm">
            <summary className="cursor-pointer select-none font-medium text-neutral-300 hover:text-white">Edit details</summary>
            <form action={save} className="mt-3 space-y-3">
              <label className="block text-xs text-neutral-400">Title<Input name="title" defaultValue={opp.title} className="mt-1" /></label>
              <label className="block text-xs text-neutral-400">Description<Textarea name="description" defaultValue={opp.description ?? ""} className="mt-1" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-neutral-400">Status
                  <select name="status" defaultValue={opp.status} className="mt-1 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm text-neutral-100">
                    {RR_STATUSES.map((st) => <option key={st} value={st}>{humanizeLabel(st)}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">Priority
                  <select name="priority" defaultValue={opp.priority} className="mt-1 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm text-neutral-100">
                    {["CRITICAL","HIGH","MEDIUM","LOW"].map((pr) => <option key={pr} value={pr}>{humanizeLabel(pr)}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">Estimated value<Input name="potentialAmount" type="number" step="0.01" defaultValue={estimate} className="mt-1" /></label>
                <label className="block text-xs text-neutral-400">Approved for recovery<Input name="approvedAmount" type="number" step="0.01" defaultValue={opp.approvedAmount} className="mt-1" /></label>
                <label className="block text-xs text-neutral-400">In progress<Input name="inProgressAmount" type="number" step="0.01" defaultValue={opp.inProgressAmount} className="mt-1" /></label>
                <label className="block text-xs text-neutral-400">Cash recovered<Input name="recoveredAmount" type="number" step="0.01" defaultValue={opp.recoveredAmount} className="mt-1" /></label>
                <label className="block text-xs text-neutral-400">Verified recovery<Input name="verifiedAmount" type="number" step="0.01" defaultValue={opp.verifiedAmount} className="mt-1" /></label>
                <label className="block text-xs text-neutral-400">Source<Input name="source" defaultValue={opp.source ?? ""} className="mt-1" /></label>
                <label className="block text-xs text-neutral-400">Department<Input name="department" defaultValue={opp.department ?? ""} className="mt-1" /></label>
                <label className="block text-xs text-neutral-400">Type<Input name="type" defaultValue={opp.type ?? ""} className="mt-1" /></label>
                <label className="block text-xs text-neutral-400 sm:col-span-2">Reason for status change (optional)<Input name="statusNote" className="mt-1" /></label>
              </div>
              <Button type="submit">Save changes</Button>
            </form>
          </details>
        ) : null}

        {showFactors && Array.isArray(factors) && factors.length > 0 ? (
          <details className="si-panel mt-4 p-4 text-xs">
            <summary className="cursor-pointer select-none text-sm font-medium text-neutral-300 hover:text-white">How the confidence score was calculated</summary>
            <ul className="mt-3 space-y-1">
              {factors.map((f: { key: string; label: string; contribution: number; weight: number }) => (
                <li key={f.key} className="flex justify-between gap-2">
                  <span>{f.label}</span>
                  <span className="font-mono text-neutral-400">{f.contribution.toFixed(1)} (weight {f.weight.toFixed(2)})</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </div>
  );
}
