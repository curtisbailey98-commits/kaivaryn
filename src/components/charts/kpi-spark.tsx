"use client";

import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";
import { CHART } from "./theme";

/** Mini KPI tile: label, value, delta badge, sparkline. */
export function KpiSpark({
  label,
  value,
  delta,
  deltaLabel,
  data,
  dataKey = "value",
  color = CHART.amber,
  className,
  footnote,
  stagger = 0,
}: {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  data: Record<string, string | number>[];
  dataKey?: string;
  color?: string;
  className?: string;
  footnote?: string;
  stagger?: number;
}) {
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  const flat = delta != null && delta === 0;
  return (
    <section
      className={cn("si-glass chart-enter overflow-hidden p-4", className)}
      style={{ animationDelay: `${stagger * 70}ms` }}
      aria-label={label}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-white tabular-nums">{value}</p>
        </div>
        {delta != null ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
              up && "bg-emerald-500/15 text-emerald-300",
              down && "bg-rose-500/15 text-rose-300",
              flat && "bg-neutral-800 text-neutral-400"
            )}
          >
            {up ? "+" : ""}
            {delta}
            {deltaLabel ? ` ${deltaLabel}` : ""}
          </span>
        ) : null}
      </div>
      <Sparkline data={data} dataKey={dataKey} color={color} label={label} height={44} className="mt-3" />
      {footnote ? <p className="mt-2 text-[10px] text-neutral-600">{footnote}</p> : null}
    </section>
  );
}
