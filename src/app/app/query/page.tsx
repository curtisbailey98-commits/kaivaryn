import Link from "next/link";
import { requirePermission, assertOrgId } from "@/lib/tenant";
import { interpretExecutiveQuery } from "@/lib/nl-query";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const EXAMPLES = [
  "How much revenue have we recovered?",
  "What is still in the open pipeline?",
  "Top opportunities",
  "How much projected vs realized savings?",
  "Pending approvals",
  "High-value items",
  "Weekly impact",
  "Unassigned work",
];

export default async function QueryPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const ctx = await requirePermission("read");
  assertOrgId(ctx.organizationId);
  const q = (searchParams.q || "").trim();
  const answer = q ? await interpretExecutiveQuery(ctx.organizationId, q) : null;

  return (
    <div>
      <p className="si-label text-amber-500">Executive NL query</p>
      <h1 className="mt-1 text-2xl font-semibold">Ask</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-400">
        Deterministic, tenant-scoped interpreters — no LLM required. Results never leave your organization
        and respect the same RBAC as the rest of the app (read+).
      </p>

      <form className="mt-6 flex flex-col gap-2 sm:flex-row">
        <input
          name="q"
          defaultValue={q}
          placeholder='e.g. "How much revenue have we recovered?"'
          className="h-11 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm"
        />
        <button type="submit" className="h-11 rounded-md bg-amber-500 px-5 text-sm font-semibold text-neutral-950">
          Ask
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <Link
            key={ex}
            href={`/app/query?q=${encodeURIComponent(ex)}`}
            className="rounded-full border border-neutral-800 px-3 py-1 text-[11px] text-neutral-400 hover:border-amber-700 hover:text-amber-300"
          >
            {ex}
          </Link>
        ))}
      </div>

      {!q ? (
        <EmptyState
          className="mt-10"
          title="Ask an executive question"
          description="Examples above map to structured DB aggregates. Keyword fallback still stays tenant-scoped."
        />
      ) : answer ? (
        <div className="mt-8 space-y-4">
          <div className="si-panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">{answer.intent}</Badge>
              <span className="text-xs text-neutral-500">{answer.interpretedAs}</span>
            </div>
            <p className="mt-3 text-sm text-neutral-200">{answer.summary}</p>
            {Object.keys(answer.metrics).length ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {Object.entries(answer.metrics).map(([k, v]) => (
                  <div key={k} className="rounded border border-neutral-900 p-2">
                    <dt className="text-[10px] uppercase tracking-wider text-neutral-500">{k}</dt>
                    <dd className="mt-1 font-medium text-amber-300">
                      {typeof v === "number" && /amount|potential|recovered|verified|savings|projected|realized/i.test(k)
                        ? formatCurrency(v)
                        : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {answer.rows?.length ? (
            <div className="overflow-x-auto rounded-lg border border-neutral-900">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-900/60 text-xs text-neutral-500">
                  <tr>
                    {Object.keys(answer.rows[0]).map((k) => (
                      <th key={k} className="px-3 py-2 font-medium">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {answer.rows.map((row, i) => (
                    <tr key={i} className="border-t border-neutral-900">
                      {Object.entries(row).map(([k, v]) => (
                        <td key={k} className="px-3 py-2 text-neutral-300">
                          {k === "href" && typeof v === "string" ? (
                            <Link href={v} className="text-amber-400 hover:underline">
                              open
                            </Link>
                          ) : typeof v === "number" && /amount|potential|recovered|projected|realized/i.test(k) ? (
                            formatCurrency(v)
                          ) : (
                            String(v ?? "—")
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {answer.links?.length ? (
            <ul className="flex flex-wrap gap-3 text-sm">
              {answer.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="text-amber-400 hover:underline">
                    {l.label} →
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
