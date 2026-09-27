import Link from "next/link";
import { requirePermission, assertOrgId } from "@/lib/tenant";
import { buildReport, REPORT_LABELS, type ReportType } from "@/lib/reports";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { queueWeeklyDigest } from "../operations/actions";

export const dynamic = "force-dynamic";

const TYPES: ReportType[] = ["rr_summary", "ops_summary", "weekly_brief", "monthly_impact"];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const ctx = await requirePermission("export");
  assertOrgId(ctx.organizationId);
  const type = (TYPES.includes(searchParams.type as ReportType)
    ? searchParams.type
    : "rr_summary") as ReportType;
  const report = await buildReport(ctx.organizationId, type);

  return (
    <div>
      <p className="si-label text-amber-500">Executive reports</p>
      <h1 className="mt-1 text-2xl font-semibold">Reports</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Live DB aggregates for your organization. Download CSV or open printable HTML (browser Print → PDF).
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <Link
            key={t}
            href={`/app/reports?type=${t}`}
            className={`rounded-md px-3 py-1.5 text-xs ${
              t === type ? "bg-amber-500 text-neutral-950" : "border border-neutral-800 text-neutral-400"
            }`}
          >
            {REPORT_LABELS[t]}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <a
          href={`/api/reports?type=${type}&format=csv`}
          className="rounded-md border border-neutral-700 px-3 py-2 hover:border-amber-600"
        >
          Download CSV
        </a>
        <a
          href={`/api/reports?type=${type}&format=html`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-neutral-700 px-3 py-2 hover:border-amber-600"
        >
          Printable HTML / PDF
        </a>
        <form action={queueWeeklyDigest}>
          <Button type="submit" variant="secondary" size="sm">Queue weekly digest draft</Button>
        </form>
      </div>
      <p className="mt-2 text-xs text-neutral-600">Weekly digest creates an EmailDraft + in-app notice. SMTP send is never faked.</p>
      {searchParams.ok ? <p className="mt-2 text-sm text-emerald-400">{searchParams.msg || "Queued"}</p> : null}

      <div className="si-panel mt-8 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{report.title}</h2>
          <Badge>{report.orgName}</Badge>
        </div>
        <p className="mt-1 text-xs text-neutral-500">{report.generatedAt}</p>
        <p className="mt-2 text-xs text-amber-200/80">{report.note}</p>

        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          {Object.entries(report.metrics).map(([k, v]) => (
            <div key={k} className="rounded border border-neutral-900 p-3">
              <dt className="text-[10px] uppercase tracking-wider text-neutral-500">{k}</dt>
              <dd className="mt-1 text-amber-300">
                {typeof v === "number" &&
                /amount|potential|recovered|verified|savings|projected|realized|pipeline/i.test(k)
                  ? formatCurrency(v)
                  : String(v)}
              </dd>
            </div>
          ))}
        </dl>

        {report.sections.map((section) => (
          <div key={section.name} className="mt-8">
            <p className="si-label">{section.name}</p>
            {!section.rows.length ? (
              <p className="mt-2 text-sm text-neutral-500">None</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-neutral-500">
                    <tr>
                      {Object.keys(section.rows[0]).map((k) => (
                        <th key={k} className="px-2 py-1 font-medium">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, i) => (
                      <tr key={i} className="border-t border-neutral-900">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-2 py-1.5 text-neutral-300">
                            {typeof v === "number" ? String(v) : String(v ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
