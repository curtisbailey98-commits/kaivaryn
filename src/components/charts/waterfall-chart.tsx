"use client";

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartShell } from "./chart-shell";
import { CHART, formatMoneyTick, tooltipStyle } from "./theme";

export type WaterfallStage = {
  label: string;
  /** Signed delta for this stage (positive adds, negative subtracts). Last may be total. */
  value: number;
  isTotal?: boolean;
};

/**
 * Classic waterfall via invisible base + visible delta stack.
 * Stages should be recovery funnel deltas or labeled example steps.
 */
export function AnimatedWaterfallChart({
  title,
  description,
  footnote,
  stages,
  money = true,
  height = 280,
  className,
  stagger = 0,
}: {
  title: string;
  description?: string;
  footnote?: string;
  stages: WaterfallStage[];
  money?: boolean;
  height?: number;
  className?: string;
  stagger?: number;
}) {
  let running = 0;
  const data = stages.map((s) => {
    if (s.isTotal) {
      const total = running;
      return { label: s.label, base: 0, delta: total, display: total, isTotal: true, negative: false };
    }
    const start = running;
    running += s.value;
    if (s.value >= 0) {
      return { label: s.label, base: start, delta: s.value, display: s.value, isTotal: false, negative: false };
    }
    return { label: s.label, base: running, delta: Math.abs(s.value), display: s.value, isTotal: false, negative: true };
  });
  const empty = !stages.length || stages.every((s) => !s.value && !s.isTotal);

  return (
    <ChartShell
      title={title}
      description={description}
      footnote={footnote}
      empty={empty}
      height={height}
      className={className}
      stagger={stagger}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: CHART.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={money ? formatMoneyTick : undefined}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(_v: number, _n: string, item: { payload?: { display?: number } }) => {
              const d = item?.payload?.display ?? 0;
              return [money ? formatMoneyTick(d) : d, "Amount"];
            }}
          />
          <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="delta" stackId="wf" radius={[4, 4, 0, 0]} maxBarSize={42} isAnimationActive animationDuration={900}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.isTotal ? CHART.emerald : d.negative ? CHART.rose : CHART.amber}
              />
            ))}
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
