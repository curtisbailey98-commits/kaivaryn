"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatMoneyTick } from "./theme";

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  value?: number;
  /** Potential still attributed to items at this stage (even when value shows cash). */
  potentialAtStage?: number;
  cashRecovered?: number;
  href?: string;
};

export function AnimatedFunnelBars({
  title,
  description,
  footnote,
  stages,
  money = true,
  className,
}: {
  title: string;
  description?: string;
  footnote?: string;
  stages: FunnelStage[];
  money?: boolean;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const max = Math.max(1, ...stages.map((s) => s.count || s.value || 0));
  const empty = stages.every((s) => !s.count && !s.value);

  return (
    <section className={cn("si-glass chart-enter p-4 sm:p-5", className)} aria-label={title}>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {description ? <p className="mt-0.5 text-xs text-neutral-500">{description}</p> : null}
      {empty ? (
        <p className="mt-6 text-center text-xs text-neutral-500">No funnel stages yet</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {stages.map((s, i) => {
            const metric = s.count || s.value || 0;
            const pct = Math.max(6, Math.round((metric / max) * 100));
            const width = mounted ? `${pct}%` : "0%";
            const Inner = (
              <>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="text-neutral-300">{s.label}</span>
                  <span className="tabular-nums text-neutral-400">
                    {s.count}
                    {money && s.value != null ? ` · ${formatMoneyTick(s.value)}` : ""}
                    {s.key === "recovered" && s.potentialAtStage != null
                      ? ` · ${formatMoneyTick(s.potentialAtStage)} potential`
                      : ""}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-neutral-900">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700 ease-out"
                    style={{ width, transitionDelay: `${i * 90}ms` }}
                  />
                </div>
              </>
            );
            return (
              <li key={s.key}>
                {s.href ? (
                  <a href={s.href} className="block rounded-md outline-none ring-amber-500/40 hover:opacity-90 focus-visible:ring-2">
                    {Inner}
                  </a>
                ) : (
                  Inner
                )}
              </li>
            );
          })}
        </ul>
      )}
      {footnote ? <p className="mt-3 text-[10px] text-neutral-600">{footnote}</p> : null}
    </section>
  );
}
