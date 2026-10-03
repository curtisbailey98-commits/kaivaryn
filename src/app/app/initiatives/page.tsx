import Link from "next/link";
import { requireOrgAccess } from "@/lib/tenant";
import { opCtxFromSession, listInitiatives } from "@/lib/operate";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { can } from "@/lib/rbac";
import { createInitiativeAction } from "../operate-actions";

export const metadata = { title: "Initiatives" };

export const dynamic = "force-dynamic";

export default async function InitiativesPage() {
  const ctx = opCtxFromSession(await requireOrgAccess());
  const initiatives = await listInitiatives(ctx);
  const canWrite = can(ctx.role, "write");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Initiatives"
        title="Group the work that moves a number"
        description="An initiative collects revenue items, operations items, playbooks, and runs under one owner and one outcome — so a quarter’s recovery effort reads as one story."
      />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          {initiatives.length === 0 ? (
            <EmptyState title="No initiatives yet" description="Create one, or tell Command “initiative create Q4 billing cleanup”." />
          ) : (
            initiatives.map((i) => (
              <Link key={i.id} href={`/app/initiatives/${i.id}`} className="block">
                <Card className="transition hover:border-amber-500/40">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{i.name}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-neutral-500">{i.description || "No description"}</p>
                      <p className="mt-1 text-[11px] text-neutral-600">{i._count.links} linked · updated {formatDate(i.updatedAt)}</p>
                    </div>
                    <StatusBadge status={i.status} />
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>New initiative</CardTitle>
            <CardDescription>Name it after the outcome you want to see.</CardDescription>
          </CardHeader>
          <CardContent>
            {canWrite ? (
              <form action={createInitiativeAction} className="space-y-3">
                <input name="name" required placeholder="Q4 billing leakage cleanup" className="h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm" />
                <textarea name="description" rows={3} placeholder="What does done look like?" className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
                <select name="product" defaultValue="BOTH" className="h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm">
                  <option value="REVENUE_RECOVERY">Revenue Recovery</option>
                  <option value="OPERATIONS_EFFICIENCY">Operations Efficiency</option>
                  <option value="BOTH">Both</option>
                </select>
                <Button type="submit" className="w-full">Create initiative</Button>
              </form>
            ) : (
              <p className="text-sm text-neutral-500">Creating initiatives needs Analyst or above.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
