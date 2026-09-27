"use client";

import {
  Area,
  AreaChart as RAreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartShell } from "./chart-shell";
import { CHART, formatMoneyTick, tooltipStyle } from "./theme";

export type AreaSeries = { key: string; label: string; color?: string; muted?: string };

export function AnimatedAreaChart({
  title,
  description,
  footnote,
  data,
  xKey = "label",
  series,
  money = true,
  height = 260,
  className,
  stacked = false,
  stagger = 0,
}: {
  title: string;
  description?: string;
  footnote?: string;
  data: Record<string, string | number>[];
  xKey?: string;
  series: AreaSeries[];
  money?: boolean;
  height?: number;
  className?: string;
  stacked?: boolean;
  stagger?: number;
}) {
  const empty = !data.length || series.every((s) => data.every((d) => !Number(d[s.key])));
  const gradId = (key: string) => `area-grad-${key}`;
  return (
    <ChartShell title={title} description={description} footnote={footnote} empty={empty} height={height} className={className} stagger={stagger}>
      <ResponsiveContainer width="100%" height="100%">
        <RAreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s, i) => {
              const color = s.color || CHART.series[i % CHART.series.length];
              return (
                <linearGradient key={s.key} id={gradId(s.key)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
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
          {series.map((s, i) => {
            const color = s.color || CHART.series[i % CHART.series.length];
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                fill={`url(#${gradId(s.key)})`}
                strokeWidth={2}
                stackId={stacked ? "stack" : undefined}
                isAnimationActive
                animationDuration={1100}
                animationBegin={i * 140}
              />
            );
          })}
        </RAreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
