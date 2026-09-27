"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CHART } from "./theme";

export function AnimatedGaugeBar({
  title,
  description,
  value,
  max = 100,
  footnote,
  className,
  suffix = "/100",
}: {
  title: string;
  description?: string;
  value: number;
  max?: number;
  footnote?: string;
  className?: string;
  suffix?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const clamped = Math.max(0, Math.min(max, value));
  const pct = max > 0 ? (clamped / max) * 100 : 0;
  const color = pct >= 70 ? CHART.emerald : pct >= 40 ? CHART.amber : CHART.rose;

  return (
    <section className={cn("si-glass p-4 sm:p-5", className)} aria-label={title}>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {description ? <p className="mt-0.5 text-xs text-neutral-500">{description}</p> : null}
      <p className="mt-4 text-3xl font-semibold text-white">
        {Math.round(clamped)}
        <span className="text-base text-neutral-500">{suffix}</span>
      </p>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-900" role="meter" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={max}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: mounted ? `${pct}%` : "0%", background: color }}
        />
      </div>
      {footnote ? <p className="mt-3 text-[10px] text-neutral-600">{footnote}</p> : null}
    </section>
  );
}
