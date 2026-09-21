import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { tenantSearch } from "@/lib/search";
import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const q = searchParams.q || "";
  const results = q ? await tenantSearch(ctx.organizationId, q) : null;

  return (
    <div>
      <p className="si-label text-amber-500">Tenant search</p>
      <h1 className="mt-1 text-2xl font-semibold">Search</h1>
      <form className="mt-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search opportunities, ops, customers, findings…"
          className="h-10 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm"
        />
        <button type="submit" className="rounded-md bg-amber-500 px-4 text-sm font-semibold text-neutral-950">
          Search
        </button>
      </form>
      {!q ? (
        <EmptyState className="mt-8" title="Enter a query" description="Results are scoped to your organization only." />
      ) : results &&
        !results.opportunities.length &&
        !results.inefficiencies.length &&
        !results.customers.length &&
        !results.findings.length ? (
        <EmptyState className="mt-8" title="No matches" />
      ) : results ? (
        <div className="mt-8 space-y-8 text-sm">
          <section>
            <p className="si-label">Opportunities ({results.opportunities.length})</p>
            <ul className="mt-2 space-y-1">
              {results.opportunities.map((o) => (
                <li key={o.id}>
                  <Link href={`/app/revenue/${o.id}`} className="text-amber-400 hover:underline">{o.title}</Link>
                  <Badge className="ml-2">{o.status}</Badge>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p className="si-label">Inefficiencies ({results.inefficiencies.length})</p>
            <ul className="mt-2 space-y-1">
              {results.inefficiencies.map((o) => (
                <li key={o.id}>
                  <Link href={`/app/operations/${o.id}`} className="text-amber-400 hover:underline">{o.title}</Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p className="si-label">Customers ({results.customers.length})</p>
            <ul className="mt-2 space-y-1">
              {results.customers.map((c) => (
                <li key={c.id}>{c.name} {c.email ? <span className="text-neutral-500">· {c.email}</span> : null}</li>
              ))}
            </ul>
          </section>
          <section>
            <p className="si-label">Findings ({results.findings.length})</p>
            <ul className="mt-2 space-y-1">
              {results.findings.map((f) => (
                <li key={f.id}>
                  <Link href="/app/findings" className="text-amber-400 hover:underline">{f.ruleId || f.id}</Link>
                  <span className="ml-2 text-neutral-500">{f.evidenceSummary?.slice(0, 80)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
