"use client";

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartShell } from "./chart-shell";
import { CHART, formatMoneyTick, tooltipStyle } from "./theme";

export type BarSeries = { key: string; label: string; color?: string };

export function AnimatedBarChart({
  title,
  description,
  footnote,
  data,
  xKey = "label",
  series,
  money = false,
  height = 260,
  className,
  layout = "horizontal",
  colorByIndex = false,
  stacked = false,
  stagger = 0,
}: {
  title: string;
  description?: string;
  footnote?: string;
  data: Record<string, string | number>[];
  xKey?: string;
  series: BarSeries[];
  money?: boolean;
  height?: number;
  className?: string;
  layout?: "horizontal" | "vertical";
  colorByIndex?: boolean;
  stacked?: boolean;
  stagger?: number;
}) {
  const empty = !data.length || series.every((s) => data.every((d) => !Number(d[s.key])));
  const vertical = layout === "vertical";
  return (
    <ChartShell title={title} description={description} footnote={footnote} empty={empty} height={height} className={className} stagger={stagger}>
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart
          data={data}
          layout={vertical ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 8, left: vertical ? 8 : 0, bottom: 0 }}
        >
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" horizontal={!vertical} vertical={vertical} />
          {vertical ? (
            <>
              <XAxis type="number" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={money ? formatMoneyTick : undefined} />
              <YAxis type="category" dataKey={xKey} width={88} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={48} tickFormatter={money ? formatMoneyTick : undefined} />
            </>
          )}
          <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [money ? formatMoneyTick(v) : v, name]} />
          {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11, color: CHART.axis }} /> : null}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color || CHART.series[i % CHART.series.length]}
              stackId={stacked ? "stack" : undefined}
              radius={stacked ? [2, 2, 0, 0] : vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]}
              maxBarSize={42}
              isAnimationActive
              animationDuration={850}
              animationBegin={i * 100}
            >
              {colorByIndex && series.length === 1
                ? data.map((_, idx) => <Cell key={idx} fill={CHART.series[idx % CHART.series.length]} />)
                : null}
            </Bar>
          ))}
        </RBarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
