import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { GuidedImport } from "@/components/integrations/guided-import";
import { getTemplate } from "@/lib/integrations/templates";

export const metadata = { title: "Imports" };

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = { CSV_UPLOAD: "File", GOOGLE_SHEETS: "Google Sheets", WEBHOOK: "Inbound API" };

export default async function ImportsPage({ searchParams }: { searchParams: { template?: string; ok?: string; error?: string; msg?: string } }) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const jobs = await prisma.importJob.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const msg = searchParams.msg ? String(searchParams.msg).slice(0, 300) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Data"
        title="Import data"
        description="Bring in an export from your billing, payer, contract, AR, or time-tracking system. Pick a template, upload or paste, check the columns, import. Imported amounts are estimates until you record them as recovered or realized."
      />
      {msg ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${searchParams.error ? "border-red-900 bg-red-950/40 text-red-200" : "border-emerald-900 bg-emerald-950/40 text-emerald-200"}`}>{msg}</div>
      ) : null}

      <GuidedImport canImport={can(ctx.effectiveRole, "import")} initialTemplate={searchParams.template} />

      <p className="text-xs text-neutral-500">
        Prefer a live link or an automatic feed? Use <Link href="/app/integrations#sheets" className="text-amber-400 hover:text-amber-300">Google Sheets</Link> or the <Link href="/app/integrations#inbound" className="text-amber-400 hover:text-amber-300">Inbound API</Link>.
      </p>

      <div>
        <p className="si-label">History</p>
        {jobs.length === 0 ? (
          <EmptyState className="mt-4" title="No imports yet" description="Your first import will appear here." />
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-900 py-2">
                <div className="min-w-0">
                  <span className="font-medium">{j.fileName || j.kind}</span>
                  <span className="ml-2 text-neutral-500">{getTemplate(j.template)?.name ?? j.kind}</span>
                  <span className="ml-2 text-[11px] text-neutral-600">{SOURCE_LABEL[j.source ?? "CSV_UPLOAD"] ?? "File"}</span>
                  <div className="text-xs text-neutral-500">
                    {j.successCount} new of {j.rowCount} rows{j.skippedCount ? ` · ${j.skippedCount} skipped` : ""} · {j.errorCount} errors · {formatDate(j.createdAt)}
                  </div>
                  {j.errorJson ? (
                    <pre className="mt-1 max-h-24 max-w-full overflow-auto whitespace-pre-wrap break-all text-[10px] text-red-400">{j.errorJson.slice(0, 500)}</pre>
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
