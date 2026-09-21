import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { updateInefficiency } from "../actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function InefficiencyDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  await requireEntitlement(ctx.organizationId, "OPERATIONS_EFFICIENCY");
  const item = await prisma.inefficiency.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
  });
  if (!item) notFound();

  async function save(formData: FormData) {
    "use server";
    await updateInefficiency(params.id, formData);
  }

  return (
    <div className="max-w-3xl">
      <Link href="/app/operations" className="text-xs text-neutral-500">← Operations</Link>
      <h1 className="mt-3 text-xl font-semibold">{item.title}</h1>
      <div className="mt-2 flex gap-2">
        <Badge>{item.status}</Badge>
        <Badge tone="warning">{item.priority}</Badge>
        {item.automationCandidate ? <Badge tone="info">Automation candidate</Badge> : null}
      </div>
      <p className="mt-4 text-sm text-neutral-400">{item.description}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>Est. waste/yr: <span className="text-amber-400">{formatCurrency(item.estimatedWasteAnnual)}</span></div>
        <div>Recovered: <span className="text-emerald-400">{formatCurrency(item.recoveredAnnual)}</span></div>
        <div>Hours/week: {item.hoursWastedWeekly ?? "—"}</div>
        <div>Identified: {formatDate(item.identifiedAt)}</div>
      </div>
      <form action={save} className="si-panel mt-8 space-y-3 p-4">
        <Input name="title" defaultValue={item.title} />
        <Textarea name="description" defaultValue={item.description ?? ""} />
        <div className="grid grid-cols-2 gap-3">
          <select name="status" defaultValue={item.status} className="h-10 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm">
            {["NEW","IN_PROGRESS","RESOLVED","DISMISSED"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select name="priority" defaultValue={item.priority} className="h-10 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm">
            {["CRITICAL","HIGH","MEDIUM","LOW"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <Input name="estimatedWasteAnnual" type="number" defaultValue={item.estimatedWasteAnnual} />
          <Input name="recoveredAnnual" type="number" defaultValue={item.recoveredAnnual} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="automationCandidate" defaultChecked={item.automationCandidate} value="true" />
          Automation candidate
        </label>
        <Button type="submit">Save</Button>
      </form>
    </div>
  );
}
