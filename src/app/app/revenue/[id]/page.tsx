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
import { Badge } from "@/components/ui/badge";
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

  const [members, history, drafts, tasks] = await Promise.all([
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
    }),
  ]);

  const factors = opp.scoreFactorsJson ? JSON.parse(opp.scoreFactorsJson) : [];
  const showFactors = can(ctx.effectiveRole, "manage_settings") || can(ctx.effectiveRole, "approve");

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
    <div className="max-w-3xl">
      <Link href="/app/revenue" className="text-xs text-neutral-500 hover:text-white">← Revenue</Link>
      <h1 className="mt-3 text-xl font-semibold">{opp.title}</h1>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge>{opp.status}</Badge>
        <Badge tone="warning">{opp.priority}</Badge>
        <Badge tone="info">score {Math.round(opp.score)}</Badge>
      </div>
      <p className="mt-4 text-sm text-neutral-400">{opp.description}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>Potential: <span className="text-amber-400">{formatCurrency(opp.potentialAmount || opp.estimatedAmount)}</span></div>
        <div>Approved: <span className="text-neutral-200">{formatCurrency(opp.approvedAmount)}</span></div>
        <div>In progress: <span className="text-neutral-200">{formatCurrency(opp.inProgressAmount)}</span></div>
        <div>Recovered: <span className="text-emerald-400">{formatCurrency(opp.recoveredAmount)}</span></div>
        <div>Verified: <span className="text-emerald-300">{formatCurrency(opp.verifiedAmount)}</span></div>
        <div>Assignee: {opp.assignee?.name || opp.assignee?.email || "—"}</div>
      </div>
      <p className="mt-2 text-xs text-neutral-500">Estimates ≠ recovered. Financial engine only — never LLM.</p>

      {showFactors && Array.isArray(factors) && factors.length > 0 ? (
        <div className="si-glass mt-4 p-3 text-xs">
          <p className="si-label">Score factors (admin)</p>
          <ul className="mt-2 space-y-1">
            {factors.map((f: { key: string; label: string; contribution: number; weight: number }) => (
              <li key={f.key} className="flex justify-between gap-2">
                <span>{f.label}</span>
                <span className="font-mono text-neutral-400">{f.contribution.toFixed(1)} (w {f.weight.toFixed(2)})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={save} className="si-panel mt-8 space-y-3 p-4">
        <p className="si-label">Update</p>
        <Input name="title" defaultValue={opp.title} />
        <Textarea name="description" defaultValue={opp.description ?? ""} />
        <div className="grid grid-cols-2 gap-3">
          <select name="status" defaultValue={opp.status} className="h-10 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm">
            {RR_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select name="priority" defaultValue={opp.priority} className="h-10 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm">
            {["CRITICAL","HIGH","MEDIUM","LOW"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <Input name="potentialAmount" type="number" step="0.01" defaultValue={opp.potentialAmount || opp.estimatedAmount} />
          <Input name="approvedAmount" type="number" step="0.01" defaultValue={opp.approvedAmount} />
          <Input name="inProgressAmount" type="number" step="0.01" defaultValue={opp.inProgressAmount} />
          <Input name="recoveredAmount" type="number" step="0.01" defaultValue={opp.recoveredAmount} />
          <Input name="verifiedAmount" type="number" step="0.01" defaultValue={opp.verifiedAmount} />
          <Input name="source" defaultValue={opp.source ?? ""} placeholder="Source" />
          <Input name="department" defaultValue={opp.department ?? ""} placeholder="Department" />
          <Input name="type" defaultValue={opp.type ?? ""} placeholder="Type" />
          <Input name="statusNote" placeholder="Status change note (optional)" />
        </div>
        <Button type="submit">Save</Button>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <form action={assign} className="si-panel space-y-2 p-3 text-sm">
          <p className="si-label">Assign</p>
          <select name="assigneeId" defaultValue={opp.assigneeId ?? ""} className="h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2">
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>{m.user.name || m.user.email}</option>
            ))}
          </select>
          <Button type="submit" variant="secondary">Assign</Button>
        </form>
        <form action={recovery} className="si-panel space-y-2 p-3 text-sm">
          <p className="si-label">Record recovery</p>
          <Input name="recoveredAmount" type="number" step="0.01" placeholder="Amount recovered" required />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="verified" /> Mark verified</label>
          <Button type="submit" variant="secondary">Record</Button>
        </form>
        <form action={draft} className="si-panel space-y-2 p-3 text-sm sm:col-span-2">
          <p className="si-label">Draft email (no send)</p>
          <Input name="to" placeholder="To" />
          <Input name="subject" defaultValue={`Regarding: ${opp.title}`} />
          <Textarea name="body" placeholder="Draft body…" required />
          <Button type="submit" variant="secondary">Save draft</Button>
        </form>
        <form action={task} className="si-panel space-y-2 p-3 text-sm">
          <p className="si-label">Task / reminder</p>
          <Input name="title" placeholder="Task title" required />
          <Input name="dueAt" type="date" />
          <Button type="submit" variant="secondary">Create task</Button>
        </form>
        <form action={external} className="si-panel space-y-2 p-3 text-sm">
          <p className="si-label">External action → approval</p>
          <select name="provider" className="h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2">
            <option value="billing_system">billing_system</option>
            <option value="erp_generic">erp_generic</option>
            <option value="claims_payer">claims_payer</option>
          </select>
          <Input name="action" defaultValue="sync_claim" />
          <Button type="submit" variant="secondary">Queue approval</Button>
        </form>
      </div>

      {drafts.length ? (
        <div className="mt-6 text-sm">
          <p className="si-label">Email drafts</p>
          <ul className="mt-2 space-y-2">
            {drafts.map((d) => (
              <li key={d.id} className="rounded border border-neutral-900 p-2">
                <Badge>DRAFT</Badge> {d.subject}
                <p className="mt-1 text-xs text-neutral-500">Never sent · {formatDate(d.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tasks.length ? (
        <div className="mt-6 text-sm">
          <p className="si-label">Tasks</p>
          <ul className="mt-2 space-y-1">
            {tasks.map((t) => (
              <li key={t.id}><Badge>{t.status}</Badge> {t.title} {t.dueAt ? `· due ${formatDate(t.dueAt)}` : ""}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8">
        <p className="si-label">Evidence</p>
        <ul className="mt-2 space-y-2 text-sm">
          {opp.evidence.map((e) => (
            <li key={e.id} className="border-b border-neutral-900 py-1">
              <Badge>{e.kind}</Badge> {e.summary}
            </li>
          ))}
          {!opp.evidence.length ? <li className="text-neutral-500">No evidence yet</li> : null}
        </ul>
      </div>

      <div className="mt-8">
        <p className="si-label">Status history</p>
        <ul className="mt-2 space-y-2 text-xs text-neutral-400">
          {history.map((h) => (
            <li key={h.id} className="font-mono">
              {h.fromStatus || "∅"} → {h.toStatus} · {h.actor?.name || h.actor?.email || "system"} · {formatDate(h.createdAt)}
              {h.note ? <span className="block text-neutral-500">{h.note}</span> : null}
            </li>
          ))}
          {!history.length ? <li>No transitions yet</li> : null}
        </ul>
      </div>

      <div className="mt-8">
        <p className="si-label">Notes</p>
        <form action={note} className="mt-2 flex gap-2">
          <Input name="body" placeholder="Add note…" className="flex-1" required />
          <Button type="submit" variant="secondary">Add</Button>
        </form>
        <ul className="mt-4 space-y-3">
          {opp.notes.map((n) => (
            <li key={n.id} className="rounded-md border border-neutral-900 p-3 text-sm">
              <p className="text-neutral-200">{n.body}</p>
              <p className="mt-1 text-xs text-neutral-500">{n.author.name || n.author.email} · {formatDate(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
