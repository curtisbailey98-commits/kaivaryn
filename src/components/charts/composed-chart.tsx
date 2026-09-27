"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart as RComposed,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartShell } from "./chart-shell";
import { CHART, formatMoneyTick, tooltipStyle } from "./theme";

export type ComposedBar = { key: string; label: string; color?: string };
export type ComposedLine = { key: string; label: string; color?: string };

export function AnimatedComposedChart({
  title,
  description,
  footnote,
  data,
  xKey = "label",
  bars,
  lines,
  money = false,
  height = 260,
  className,
  stagger = 0,
}: {
  title: string;
  description?: string;
  footnote?: string;
  data: Record<string, string | number>[];
  xKey?: string;
  bars: ComposedBar[];
  lines: ComposedLine[];
  money?: boolean;
  height?: number;
  className?: string;
  stagger?: number;
}) {
  const keys = [...bars.map((b) => b.key), ...lines.map((l) => l.key)];
  const empty = !data.length || keys.every((k) => data.every((d) => !Number(d[k])));
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
        <RComposed data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          {bars.map((b, i) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.label}
              fill={b.color || CHART.series[i % CHART.series.length]}
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
              isAnimationActive
              animationDuration={900}
              animationBegin={i * 100}
            />
          ))}
          {lines.map((l, i) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color || CHART.series[(bars.length + i) % CHART.series.length]}
              strokeWidth={2.2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive
              animationDuration={1100}
              animationBegin={200 + i * 120}
            />
          ))}
        </RComposed>
      </ResponsiveContainer>
    </ChartShell>
  );
}
