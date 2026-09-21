import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { runIntelligence } from "../actions";
import { EmptyState } from "@/components/ui/states";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const [intel, imports] = await Promise.all([
    prisma.intelligenceRun.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.importJob.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="si-label text-amber-500">Queue</p>
          <h1 className="mt-1 text-2xl font-semibold">Jobs</h1>
          <p className="mt-2 text-sm text-neutral-400">In-process queue (free Render). Import + intelligence.</p>
        </div>
        <form action={runIntelligence}>
          <Button type="submit">Run detection + intelligence</Button>
        </form>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <p className="si-label">Intelligence runs</p>
          {intel.length === 0 ? (
            <EmptyState className="mt-3" title="No runs" />
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {intel.map((r) => (
                <li key={r.id} className="flex justify-between border-b border-neutral-900 py-2">
                  <div>
                    <div className="font-mono text-xs text-neutral-500">{r.id.slice(0, 10)}…</div>
                    <div className="text-xs text-neutral-400">{r.findingCount} findings · {formatDate(r.createdAt)}</div>
                  </div>
                  <Badge tone={r.status === "SUCCEEDED" ? "info" : r.status === "FAILED" ? "danger" : "warning"}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <p className="si-label">Import jobs</p>
          {imports.length === 0 ? (
            <EmptyState className="mt-3" title="No imports" />
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {imports.map((r) => (
                <li key={r.id} className="flex justify-between border-b border-neutral-900 py-2">
                  <div>
                    <div>{r.kind} · {r.fileName}</div>
                    <div className="text-xs text-neutral-400">{r.successCount}/{r.rowCount} · {formatDate(r.createdAt)}</div>
                  </div>
                  <Badge>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
