"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartShell } from "./chart-shell";
import { CHART, formatMoneyTick, tooltipStyle } from "./theme";

export type DonutSlice = { name: string; value: number; color?: string };

export function AnimatedDonutChart({
  title,
  description,
  footnote,
  data,
  money = true,
  height = 260,
  className,
  centerLabel,
  centerValue,
}: {
  title: string;
  description?: string;
  footnote?: string;
  data: DonutSlice[];
  money?: boolean;
  height?: number;
  className?: string;
  centerLabel?: string;
  centerValue?: string;
}) {
  const filtered = data.filter((d) => d.value > 0);
  const empty = filtered.length === 0;
  const total = filtered.reduce((n, d) => n + d.value, 0);
  return (
    <ChartShell title={title} description={description} footnote={footnote} empty={empty} height={height} className={className}>
      <div className="relative h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filtered}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="48%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              isAnimationActive
              animationDuration={1000}
            >
              {filtered.map((d, i) => (
                <Cell key={d.name} fill={d.color || CHART.series[i % CHART.series.length]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              {...tooltipStyle}
              formatter={(v: number, name: string) => [
                money ? `${formatMoneyTick(v)} (${total ? Math.round((v / total) * 100) : 0}%)` : v,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        {(centerLabel || centerValue) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
            {centerValue ? <p className="text-lg font-semibold text-white">{centerValue}</p> : null}
            {centerLabel ? <p className="text-[10px] uppercase tracking-wider text-neutral-500">{centerLabel}</p> : null}
          </div>
        )}
        <ul className="absolute bottom-0 left-0 right-0 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-neutral-400">
          {filtered.slice(0, 6).map((d, i) => (
            <li key={d.name} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: d.color || CHART.series[i % CHART.series.length] }}
              />
              {d.name}
            </li>
          ))}
        </ul>
      </div>
    </ChartShell>
  );
}
