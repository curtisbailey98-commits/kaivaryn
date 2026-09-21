import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { submitImport } from "./actions";
import { EmptyState } from "@/components/ui/states";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const jobs = await prisma.importJob.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <p className="si-label text-amber-500">Data</p>
      <h1 className="mt-1 text-2xl font-semibold">CSV Imports</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Upload opportunities, customers, processes, or inefficiencies. Mapping + validation + error history.
        Jobs run in-process on this service.
      </p>

      <form action={submitImport} className="si-panel mt-6 space-y-3 p-4 text-sm" encType="multipart/form-data">
        <label className="block">
          <span className="text-xs text-neutral-500">Kind</span>
          <select name="kind" className="mt-1 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2">
            <option value="opportunities">Opportunities</option>
            <option value="customers">Customers</option>
            <option value="processes">Processes</option>
            <option value="inefficiencies">Inefficiencies</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-neutral-500">CSV file</span>
          <input type="file" name="file" accept=".csv,text/csv" required className="mt-1 block w-full text-sm" />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="map_title" placeholder="Map: title column (default title)" className="h-9 rounded-md border border-neutral-700 bg-neutral-950 px-2" />
          <input name="map_name" placeholder="Map: name column (customers/processes)" className="h-9 rounded-md border border-neutral-700 bg-neutral-950 px-2" />
          <input name="map_estimatedAmount" placeholder="Map: estimatedAmount" className="h-9 rounded-md border border-neutral-700 bg-neutral-950 px-2" />
          <input name="map_estimatedWasteAnnual" placeholder="Map: estimatedWasteAnnual" className="h-9 rounded-md border border-neutral-700 bg-neutral-950 px-2" />
        </div>
        <Button type="submit">Upload &amp; import</Button>
      </form>

      <div className="mt-8">
        <p className="si-label">History</p>
        {jobs.length === 0 ? (
          <EmptyState className="mt-4" title="No imports yet" description="Upload a CSV to begin." />
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-900 py-2">
                <div>
                  <span className="font-medium">{j.fileName || j.kind}</span>
                  <span className="ml-2 text-neutral-500">{j.kind}</span>
                  <div className="text-xs text-neutral-500">
                    {j.successCount}/{j.rowCount} ok · {j.errorCount} errors · {formatDate(j.createdAt)}
                  </div>
                  {j.errorJson ? (
                    <pre className="mt-1 max-h-24 overflow-auto text-[10px] text-red-400">{j.errorJson.slice(0, 500)}</pre>
                  ) : null}
                </div>
                <Badge tone={j.status === "SUCCEEDED" ? "info" : j.status === "FAILED" ? "danger" : "warning"}>{j.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
