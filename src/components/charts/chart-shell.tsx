"use client";

import { cn } from "@/lib/utils";

export function ChartShell({
  title,
  description,
  footnote,
  className,
  children,
  empty,
  height = 260,
  stagger = 0,
  badge,
  emptyLabel = "No data yet for this chart",
}: {
  title: string;
  description?: string;
  footnote?: string;
  className?: string;
  children: React.ReactNode;
  empty?: boolean;
  height?: number;
  /** Index for staggered entrance (×70ms). */
  stagger?: number;
  /** Small label pinned top-right, e.g. "Estimated" vs "Realized" — keeps value types visually distinct. */
  badge?: { label: string; tone?: "estimate" | "realized" | "neutral" };
  emptyLabel?: string;
}) {
  const badgeTone =
    badge?.tone === "estimate"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
      : badge?.tone === "realized"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : "border-neutral-700 bg-neutral-900 text-neutral-300";
  return (
    <section
      className={cn(
        "si-glass app-card-lift relative overflow-hidden p-4 sm:p-5 chart-enter",
        className
      )}
      style={{ animationDelay: `${Math.max(0, stagger) * 70}ms` }}
      aria-label={title}
    >
      <div className="relative z-[1] mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-neutral-500">{description}</p> : null}
        </div>
        {badge ? (
          <span className={cn("shrink-0 self-start rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", badgeTone)}>
            {badge.label}
          </span>
        ) : null}
      </div>
      {empty ? (
        <div
          className="relative z-[1] flex items-center justify-center rounded-lg border border-dashed border-neutral-800 text-xs text-neutral-500"
          style={{ height }}
        >
          {emptyLabel}
        </div>
      ) : (
        <div style={{ height }} className="relative z-[1] w-full chart-draw">
          {children}
        </div>
      )}
      {footnote ? <p className="relative z-[1] mt-2 text-[10px] leading-4 text-neutral-600">{footnote}</p> : null}
    </section>
  );
}
