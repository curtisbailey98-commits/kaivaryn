import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FindingsPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const findings = await prisma.finding.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="si-label text-amber-500">Intelligence</p>
          <h1 className="mt-1 text-2xl font-semibold">Findings</h1>
          <p className="mt-2 text-sm text-neutral-400">Evidence · Analysis · Recommendation · Decision. Export via CSV.</p>
        </div>
        <Link href="/api/export?type=findings" className="rounded-md border border-neutral-700 px-3 py-2 text-sm">
          Export CSV
        </Link>
      </div>
      {findings.length === 0 ? (
        <EmptyState className="mt-8" title="No findings" description="Run detection from Jobs, or wait for imports." />
      ) : (
        <ul className="mt-6 space-y-4">
          {findings.map((f) => (
            <li key={f.id} className="si-glass p-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge>{f.product}</Badge>
                <Badge tone={f.status === "INSUFFICIENT_DATA" ? "warning" : "info"}>{f.status}</Badge>
                {f.ruleId ? <Badge tone="default">{f.ruleId}</Badge> : null}
                <span className="text-xs text-neutral-500">{f.confidence} · {formatDate(f.createdAt)}</span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div>
                  <p className="si-label">Evidence</p>
                  <p className="mt-1 text-neutral-300">{f.evidenceSummary || "—"}</p>
                </div>
                <div>
                  <p className="si-label">Analysis</p>
                  <p className="mt-1 text-neutral-300">{f.analysis || "—"}</p>
                </div>
                <div>
                  <p className="si-label">Recommendation</p>
                  <p className="mt-1 text-neutral-300">{f.recommendation || "—"}</p>
                </div>
                <div>
                  <p className="si-label">Decision</p>
                  <p className="mt-1 text-neutral-300">{f.decision || "—"}</p>
                  {f.impactEstimate != null ? (
                    <p className="mt-1 text-xs text-amber-400/90">Impact est. {formatCurrency(f.impactEstimate)} (engine, not LLM)</p>
                  ) : null}
                </div>
              </div>
              {f.opportunityId ? (
                <Link href={`/app/revenue/${f.opportunityId}`} className="mt-2 inline-block text-xs text-amber-400">Opportunity →</Link>
              ) : null}
              {f.inefficiencyId ? (
                <Link href={`/app/operations/${f.inefficiencyId}`} className="mt-2 inline-block text-xs text-amber-400">Inefficiency →</Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
