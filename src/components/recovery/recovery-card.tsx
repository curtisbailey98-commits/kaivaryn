import Link from "next/link";
import { ArrowRight, CircleDollarSign } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { RecoveryTracker } from "@/lib/recovery/tracker";

/** Compact "Money recovered" card for the /app home. Same numbers as /app/recovery (one data layer). */
export function RecoveryCard({ tracker }: { tracker: RecoveryTracker }) {
  const latest = tracker.items.find((i) => i.stage === "WON_BACK");
  const wonCount = tracker.revenue.wonBackCount + tracker.operations.wonBackCount;
  return (
    <Link
      href="/app/recovery"
      data-testid="recovery-card"
      className="group block rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.05] via-neutral-950 to-neutral-950 p-4 transition hover:border-emerald-500/40 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <CircleDollarSign className="h-4 w-4 text-emerald-400" /> Money recovered
          <span className="text-[11px] font-normal text-neutral-500">· proof of value</span>
        </p>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 group-hover:text-amber-300">
          {tracker.hasData ? "See every recorded dollar" : "How this works"} <ArrowRight className="h-3 w-3" />
        </span>
      </div>
      {!tracker.hasData ? (
        <p className="mt-3 text-sm text-neutral-400">
          No numbers yet. Once you import a file or connect a system, what Kaivaryn finds and what your team wins back will show here — separately, item by item.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">Won back · recorded</p>
            <p className="mt-1 text-lg font-semibold text-emerald-400">
              {formatCurrency(tracker.revenue.wonBack)}<span className="text-xs font-normal text-neutral-400"> cash</span>
            </p>
            {tracker.operations.itemCount > 0 ? (
              <p className="text-sm font-semibold text-emerald-400">
                {formatCurrency(tracker.operations.wonBack)}<span className="text-xs font-normal text-neutral-400"> / yr savings</span>
              </p>
            ) : null}
            <p className="text-[10px] text-neutral-600">{wonCount} item{wonCount === 1 ? "" : "s"} recorded by your team</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Found · estimated</p>
            <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(tracker.revenue.found)}<span className="text-xs font-normal text-neutral-400"> revenue</span></p>
            {tracker.operations.itemCount > 0 ? (
              <p className="text-sm font-semibold text-white">{formatCurrency(tracker.operations.found)}<span className="text-xs font-normal text-neutral-400"> / yr savings</span></p>
            ) : null}
            <p className="text-[10px] text-neutral-600">
              {tracker.revenue.found > 0 ? `${tracker.revenue.conversionRate}% of found revenue won back so far` : "Estimates, not cash"}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Most recent</p>
            {latest ? (
              <>
                <p className="mt-1 line-clamp-2 text-sm font-medium text-white">{latest.title}</p>
                <p className="text-[11px] text-neutral-500">
                  {formatCurrency(latest.realizedAmount)}{latest.unit === "per_year" ? " / yr" : ""}
                  {latest.realizedAt ? ` · ${formatDate(latest.realizedAt)}` : ""}
                  {latest.confirmation?.byName ? ` · by ${latest.confirmation.byName}` : ""}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-neutral-400">Nothing recorded as won back yet.</p>
            )}
          </div>
        </div>
      )}
    </Link>
  );
}
