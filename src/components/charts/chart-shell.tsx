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
}: {
  title: string;
  description?: string;
  footnote?: string;
  className?: string;
  children: React.ReactNode;
  empty?: boolean;
  height?: number;
}) {
  return (
    <section
      className={cn(
        "si-glass overflow-hidden p-4 sm:p-5 chart-enter",
        className
      )}
      aria-label={title}
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-neutral-500">{description}</p> : null}
        </div>
      </div>
      {empty ? (
        <div
          className="flex items-center justify-center rounded-lg border border-dashed border-neutral-800 text-xs text-neutral-500"
          style={{ height }}
        >
          No data yet for this chart
        </div>
      ) : (
        <div style={{ height }} className="w-full">
          {children}
        </div>
      )}
      {footnote ? <p className="mt-2 text-[10px] leading-4 text-neutral-600">{footnote}</p> : null}
    </section>
  );
}
