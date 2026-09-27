"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartShell } from "./chart-shell";
import { CHART, formatMoneyTick, tooltipStyle } from "./theme";

export type LineSeries = { key: string; label: string; color?: string };

export function AnimatedLineChart({
  title,
  description,
  footnote,
  data,
  xKey = "label",
  series,
  money = false,
  height = 260,
  className,
}: {
  title: string;
  description?: string;
  footnote?: string;
  data: Record<string, string | number>[];
  xKey?: string;
  series: LineSeries[];
  money?: boolean;
  height?: number;
  className?: string;
}) {
  const empty = !data.length || series.every((s) => data.every((d) => !Number(d[s.key])));
  return (
    <ChartShell title={title} description={description} footnote={footnote} empty={empty} height={height} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: CHART.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={money ? formatMoneyTick : undefined}
          />
          <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [money ? formatMoneyTick(v) : v, name]} />
          <Legend wrapperStyle={{ fontSize: 11, color: CHART.axis }} />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color || CHART.series[i % CHART.series.length]}
              strokeWidth={2.2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive
              animationDuration={900}
              animationBegin={i * 120}
            />
          ))}
        </RLineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
