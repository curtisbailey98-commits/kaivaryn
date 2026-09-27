"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { CHART } from "./theme";

/**
 * Live “pulse” demo spark — CSS + interval refresh of a small demo series.
 * Not money / not a KPI claim; labeled as activity pulse.
 */
export function PulseSpark({
  title = "Activity pulse",
  description = "Demo streaming feel · not a financial metric",
  className,
  color = CHART.emerald,
  baseSeries,
}: {
  title?: string;
  description?: string;
  className?: string;
  color?: string;
  /** Optional seed from real open-count spark; otherwise demo wave. */
  baseSeries?: { label: string; value: number }[];
}) {
  const seed = useMemo(() => {
    if (baseSeries?.length) return baseSeries.map((d) => d.value);
    return [4, 6, 5, 8, 7, 9, 6, 10, 8, 11, 9, 12];
  }, [baseSeries]);

  const [tick, setTick] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1800);
    return () => window.clearInterval(id);
  }, [reduced]);

  const data = useMemo(() => {
    const len = seed.length;
    return seed.map((v, i) => {
      const wave = Math.sin((i + tick) * 0.55) * 1.4;
      return { i, value: Math.max(0, Math.round(v + wave)) };
    }).slice(0, len);
  }, [seed, tick]);

  const gradId = `pulse-${color.replace("#", "")}`;

  return (
    <section className={cn("si-glass chart-enter relative overflow-hidden p-4", className)} aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="chart-pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
      </div>
      <div className="h-14 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={`url(#${gradId})`}
              strokeWidth={1.8}
              isAnimationActive={!reduced}
              animationDuration={700}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10px] text-neutral-600">Pulse refreshes for presence · not recovered dollars</p>
    </section>
  );
}
