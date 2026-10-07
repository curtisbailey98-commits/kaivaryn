import { Store } from "lucide-react";
import type { SpotOnSummary } from "@/lib/integrations/spoton/summary";
import { formatInZone } from "@/lib/operate";
import { SpotOnImportForm } from "./spoton-import-form";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const SPOTON_EXPORT_STEPS = [
  "Sign in to the SpotOn Dashboard for your location and open Reports → Custom Views.",
  "Create New Custom View → choose the Orders Per Day template → set the date range to the last 90 days.",
  "Click Download CSV. (Keep Sales, Voids, Discounts, Refunds, Taxes, and Net Sales visible; Edit Columns controls what's shown.)",
  "Choose that file below and check the matched columns, then import. Re-import any time; days already imported are updated, not duplicated.",
];

/**
 * SpotOn POS card. Honest states only:
 * - "Sales imported from SpotOn export" once real rows exist (it is an import, never a live connection);
 * - "Not connected" before that. A direct SpotOn connection needs SpotOn partner approval and is not live.
 */
export function SpotOnCard({ summary, lastImportAt, canImport, tz, isDemo }: { summary: SpotOnSummary | null; lastImportAt: Date | null; canImport: boolean; tz: string; isDemo?: boolean }) {
  const has = Boolean(summary && summary.rows > 0);
  const pill = has
    ? { label: "Sales imported from SpotOn export", cls: "border-emerald-800 bg-emerald-950/60 text-emerald-300", dot: "bg-emerald-400" }
    : { label: "Not connected · import a SpotOn export", cls: "border-neutral-700 bg-neutral-900 text-neutral-300", dot: "bg-neutral-500" };
  return (
    <section id="spoton" data-testid="spoton-card" data-state={has ? "imported" : "not_connected"} className="rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/60 to-neutral-950 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400"><Store className="h-4 w-4" /></span>
          <div>
            <h2 className="text-[15px] font-semibold text-white">SpotOn POS</h2>
            <p className="text-[11px] text-neutral-500">Sales, voids, discounts, comps, and refunds from your SpotOn reports. Kaivaryn only reads the file you give it.</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${pill.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
          {pill.label}
        </span>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3 text-xs leading-5 text-neutral-400">
          {has && summary ? (
            <>
              <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                <div><dt className="inline text-neutral-500">Last import: </dt><dd className="inline text-neutral-200">{lastImportAt ? formatInZone(lastImportAt, tz) : "—"}</dd></div>
                <div><dt className="inline text-neutral-500">Days covered: </dt><dd className="inline text-neutral-200">{summary.firstAt && summary.lastAt ? `${summary.firstAt.toISOString().slice(0, 10)} → ${summary.lastAt.toISOString().slice(0, 10)}` : "—"}</dd></div>
              </dl>
              <SpotOnNumbers summary={summary} isDemo={isDemo} />
            </>
          ) : (
            <p>Bring in your SpotOn sales history with one CSV download from the SpotOn Dashboard. Kaivaryn compares your last 30 days with your own prior 60 days and flags comps, discounts, voids, and refunds that run above your usual rate — as estimates for you to review.</p>
          )}
          <div className="rounded-lg border border-neutral-800 p-3 text-[11px] leading-5 text-neutral-500">
            <p className="font-semibold text-neutral-300">Direct SpotOn connection: not available yet</p>
            <p className="mt-1">SpotOn doesn&apos;t offer an open API. Live connections are limited to integration partners SpotOn approves, and Kaivaryn is not a SpotOn integration partner today. Until then, the CSV export is the way in, and nothing here is shown as connected.</p>
          </div>
        </div>
        <div className="space-y-3">
          <ol className="space-y-1.5">
            {SPOTON_EXPORT_STEPS.map((s, i) => (
              <li key={s} className="flex gap-2 text-xs leading-5 text-neutral-400">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-neutral-700 text-[9px] text-neutral-400">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <SpotOnImportForm canImport={canImport} />
          <p className="text-[11px] leading-5 text-neutral-500">SpotOn doesn&apos;t publish the exact column names of its exports, so Kaivaryn matches them by name and shows you each match before anything is imported. A check-level export (one row per check) works too.</p>
        </div>
      </div>
    </section>
  );
}

function SpotOnNumbers({ summary, isDemo }: { summary: SpotOnSummary; isDemo?: boolean }) {
  const t = summary.totals;
  const days = summary.byDay.slice(0, 10);
  return (
    <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3" data-testid="spoton-numbers">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">From your SpotOn export · last {summary.days} days{isDemo ? " · sample data" : ""}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Net sales" value={money(t.netSales)} sub={`${t.orders.toLocaleString("en-US")} orders · avg ${money(summary.averageCheck)}`} />
        <Stat label="Sales (before discounts)" value={money(t.grossSales)} />
        <Stat label="Discounts" value={money(t.discounts)} />
        <Stat label="Comps" value={money(t.comps)} />
        <Stat label="Voids" value={money(t.voids)} />
        <Stat label="Refunds" value={money(t.refunds)} sub={`${t.refundCount} ${t.refundCount === 1 ? "refund" : "refunds"}`} />
      </div>
      {days.length ? (
        <table className="w-full text-left text-[11px]">
          <thead className="text-neutral-500"><tr><th className="py-1 font-normal">Day</th><th className="py-1 font-normal">Location</th><th className="py-1 text-right font-normal">Orders</th><th className="py-1 text-right font-normal">Net sales</th></tr></thead>
          <tbody className="divide-y divide-neutral-900 text-neutral-300">
            {days.map((d) => <tr key={`${d.day}-${d.locationName}`}><td className="py-1">{d.day}</td><td className="py-1">{d.locationName}</td><td className="py-1 text-right">{d.orders}</td><td className="py-1 text-right">{money(d.netSales)}</td></tr>)}
          </tbody>
        </table>
      ) : null}
      <p className="text-[11px] text-neutral-500">These are the numbers in the SpotOn export. Anything Kaivaryn flags from them shows up as an estimate in Revenue Recovery — never as money recovered.</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-900 p-2">
      <p className="text-[10px] text-neutral-500">{label}</p>
      <p className="text-sm font-semibold text-neutral-100">{value}</p>
      {sub ? <p className="text-[10px] text-neutral-500">{sub}</p> : null}
    </div>
  );
}
