import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { updateOpportunity, addOpportunityNote } from "../actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    },
  });
  if (!opp) notFound();

  const members = await prisma.membership.findMany({
    where: { organizationId: ctx.organizationId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  async function save(formData: FormData) {
    "use server";
    await updateOpportunity(params.id, formData);
  }
  async function note(formData: FormData) {
    "use server";
    await addOpportunityNote(params.id, formData);
  }

  return (
    <div className="max-w-3xl">
      <Link href="/app/revenue" className="text-xs text-neutral-500 hover:text-white">← Revenue</Link>
      <h1 className="mt-3 text-xl font-semibold">{opp.title}</h1>
      <div className="mt-2 flex gap-2">
        <Badge>{opp.status}</Badge>
        <Badge tone="warning">{opp.priority}</Badge>
      </div>
      <p className="mt-4 text-sm text-neutral-400">{opp.description}</p>
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>Estimated: <span className="text-amber-400">{formatCurrency(opp.estimatedAmount)}</span></div>
        <div>Recovered: <span className="text-emerald-400">{formatCurrency(opp.recoveredAmount)}</span></div>
        <div>Identified: {formatDate(opp.identifiedAt)}</div>
        <div>Assignee: {opp.assignee?.name || opp.assignee?.email || "—"}</div>
      </div>

      <form action={save} className="si-panel mt-8 space-y-3 p-4">
        <p className="si-label">Update</p>
        <Input name="title" defaultValue={opp.title} />
        <Textarea name="description" defaultValue={opp.description ?? ""} />
        <div className="grid grid-cols-2 gap-3">
          <select name="status" defaultValue={opp.status} className="h-10 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm">
            {["NEW","IN_PROGRESS","RECOVERED","DISMISSED"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select name="priority" defaultValue={opp.priority} className="h-10 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm">
            {["CRITICAL","HIGH","MEDIUM","LOW"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <Input name="estimatedAmount" type="number" step="0.01" defaultValue={opp.estimatedAmount} />
          <Input name="recoveredAmount" type="number" step="0.01" defaultValue={opp.recoveredAmount} />
          <Input name="source" defaultValue={opp.source ?? ""} placeholder="Source" />
          <Input name="department" defaultValue={opp.department ?? ""} placeholder="Department" />
          <Input name="type" defaultValue={opp.type ?? ""} placeholder="Type" />
          <select name="assigneeId" defaultValue={opp.assigneeId ?? ""} className="h-10 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm">
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>{m.user.name || m.user.email}</option>
            ))}
          </select>
        </div>
        <Button type="submit">Save</Button>
      </form>

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
