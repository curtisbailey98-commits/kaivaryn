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
import { Badge } from "@/components/ui/badge";
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
    },
  });
  if (!item) notFound();

  const history = await prisma.statusHistory.findMany({
    where: { organizationId: ctx.organizationId, entityType: "Inefficiency", entityId: params.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { actor: { select: { name: true, email: true } } },
  });
  const factors = item.scoreFactorsJson ? JSON.parse(item.scoreFactorsJson) : [];
  const showFactors = can(ctx.effectiveRole, "manage_settings") || can(ctx.effectiveRole, "approve");

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
    <div className="max-w-3xl">
      <Link href="/app/operations" className="text-xs text-neutral-500">← Operations</Link>
      <h1 className="mt-3 text-xl font-semibold">{item.title}</h1>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge>{item.status}</Badge>
        <Badge tone="warning">{item.priority}</Badge>
        <Badge tone="info">score {Math.round(item.score)}</Badge>
        {item.automationCandidate ? <Badge tone="info">Automation candidate</Badge> : null}
      </div>
      <p className="mt-4 text-sm text-neutral-400">{item.description}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>Projected savings/yr: <span className="text-amber-400">{formatCurrency(item.projectedSavings || item.estimatedWasteAnnual)}</span></div>
        <div>Realized: <span className="text-emerald-400">{formatCurrency(item.realizedSavings || item.recoveredAnnual)}</span></div>
        <div>Projected hrs/wk: {item.projectedHoursWeekly ?? item.hoursWastedWeekly ?? "—"}</div>
        <div>Realized hrs/wk: {item.realizedHoursWeekly ?? "—"}</div>
        <div>Assignee: {item.assignee?.name || item.assignee?.email || "—"}</div>
        <div>Identified: {formatDate(item.identifiedAt)}</div>
      </div>
      <p className="mt-2 text-xs text-neutral-500">Projected ≠ realized. Automation is approval-gated.</p>

      {showFactors && Array.isArray(factors) && factors.length > 0 ? (
        <div className="si-glass mt-4 p-3 text-xs">
          <p className="si-label">Score factors (admin)</p>
          <ul className="mt-2 space-y-1">
            {factors.map((f: { key: string; label: string; contribution: number }) => (
              <li key={f.key} className="flex justify-between"><span>{f.label}</span><span>{f.contribution.toFixed(1)}</span></li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={save} className="si-panel mt-8 space-y-3 p-4">
        <Input name="title" defaultValue={item.title} />
        <Textarea name="description" defaultValue={item.description ?? ""} />
        <div className="grid grid-cols-2 gap-3">
          <select name="status" defaultValue={item.status} className="h-10 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm">
            {OE_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select name="priority" defaultValue={item.priority} className="h-10 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm">
            {["CRITICAL","HIGH","MEDIUM","LOW"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <Input name="projectedSavings" type="number" step="0.01" defaultValue={item.projectedSavings || item.estimatedWasteAnnual} />
          <Input name="realizedSavings" type="number" step="0.01" defaultValue={item.realizedSavings || item.recoveredAnnual} />
          <Input name="hoursWastedWeekly" type="number" step="0.1" defaultValue={item.hoursWastedWeekly ?? ""} />
          <Input name="statusNote" placeholder="Status note" />
          <label className="flex items-center gap-2 text-xs col-span-2">
            <input type="checkbox" name="automationCandidate" defaultChecked={item.automationCandidate} /> Automation candidate
          </label>
        </div>
        <Button type="submit">Save</Button>
      </form>

      <form action={savings} className="si-panel mt-4 space-y-2 p-3 text-sm">
        <p className="si-label">Record realized savings</p>
        <Input name="realizedSavings" type="number" step="0.01" required />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="verified" /> Verified</label>
        <Button type="submit" variant="secondary">Record</Button>
      </form>

      <div className="mt-8">
        <p className="si-label">Evidence</p>
        <ul className="mt-2 space-y-2 text-sm">
          {item.evidence.map((e) => (
            <li key={e.id} className="border-b border-neutral-900 py-1"><Badge>{e.kind}</Badge> {e.summary}</li>
          ))}
          {!item.evidence.length ? <li className="text-neutral-500">None</li> : null}
        </ul>
      </div>

      <div className="mt-8">
        <p className="si-label">Status history</p>
        <ul className="mt-2 space-y-2 text-xs text-neutral-400">
          {history.map((h) => (
            <li key={h.id} className="font-mono">
              {h.fromStatus || "∅"} → {h.toStatus} · {h.actor?.name || h.actor?.email || "system"} · {formatDate(h.createdAt)}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <p className="si-label">Notes</p>
        <form action={note} className="mt-2 flex gap-2">
          <Input name="body" placeholder="Add note…" className="flex-1" required />
          <Button type="submit" variant="secondary">Add</Button>
        </form>
        <ul className="mt-4 space-y-3">
          {item.notes.map((n) => (
            <li key={n.id} className="rounded-md border border-neutral-900 p-3 text-sm">
              <p>{n.body}</p>
              <p className="mt-1 text-xs text-neutral-500">{n.author.name || n.author.email} · {formatDate(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
