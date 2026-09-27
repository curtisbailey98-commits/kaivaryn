"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART, tooltipStyle } from "./theme";

export function Sparkline({
  data,
  dataKey = "value",
  color = CHART.rose,
  label = "Trend",
  height = 48,
  className,
}: {
  data: Record<string, string | number>[];
  dataKey?: string;
  color?: string;
  label?: string;
  height?: number;
  className?: string;
}) {
  const id = `spark-${dataKey}-${color.replace("#", "")}`;
  if (!data.length) {
    return <div className={className} style={{ height }} aria-label={`${label}: no data`} />;
  }
  return (
    <div className={className} style={{ height }} aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            {...tooltipStyle}
            contentStyle={{ ...tooltipStyle.contentStyle, padding: "6px 10px" }}
            formatter={(v: number) => [v, label]}
            labelFormatter={() => ""}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={`url(#${id})`}
            strokeWidth={1.8}
            isAnimationActive
            animationDuration={800}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
