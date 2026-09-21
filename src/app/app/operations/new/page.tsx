import { redirect } from "next/navigation";
import Link from "next/link";
import { createInefficiency } from "../actions";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default async function NewInefficiencyPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  await requireEntitlement(ctx.organizationId, "OPERATIONS_EFFICIENCY");

  async function action(formData: FormData) {
    "use server";
    const res = await createInefficiency(formData);
    if (res.id) redirect(`/app/operations/${res.id}`);
  }

  return (
    <div className="max-w-xl">
      <Link href="/app/operations" className="text-xs text-neutral-500">← Operations</Link>
      <h1 className="mt-3 text-xl font-semibold">New inefficiency</h1>
      <form action={action} className="mt-6 space-y-4">
        <label className="block text-xs text-neutral-400">Title *<Input name="title" required className="mt-1" /></label>
        <label className="block text-xs text-neutral-400">Description<Textarea name="description" className="mt-1" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-neutral-400">Source<Input name="source" className="mt-1" /></label>
          <label className="block text-xs text-neutral-400">Department<Input name="department" className="mt-1" /></label>
          <label className="block text-xs text-neutral-400">Type<Input name="type" className="mt-1" /></label>
          <label className="block text-xs text-neutral-400">Priority
            <select name="priority" className="mt-1 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm">
              <option>MEDIUM</option><option>CRITICAL</option><option>HIGH</option><option>LOW</option>
            </select>
          </label>
          <label className="block text-xs text-neutral-400">Est. annual waste<Input name="estimatedWasteAnnual" type="number" defaultValue={0} className="mt-1" /></label>
          <label className="block text-xs text-neutral-400">Hours wasted / week<Input name="hoursWastedWeekly" type="number" className="mt-1" /></label>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" name="automationCandidate" /> Automation candidate (creates approval request)
        </label>
        <Button type="submit">Create</Button>
      </form>
    </div>
  );
}
