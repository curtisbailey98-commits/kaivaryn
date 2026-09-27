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
}) {
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
      </div>
      {empty ? (
        <div
          className="relative z-[1] flex items-center justify-center rounded-lg border border-dashed border-neutral-800 text-xs text-neutral-500"
          style={{ height }}
        >
          No data yet for this chart
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
