"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RRadar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ChartShell } from "./chart-shell";
import { CHART, tooltipStyle } from "./theme";

export type RadarPoint = { subject: string; value: number; fullMark?: number };

export function AnimatedRadarChart({
  title,
  description,
  footnote,
  data,
  height = 280,
  className,
  color = CHART.sky,
  stagger = 0,
}: {
  title: string;
  description?: string;
  footnote?: string;
  data: RadarPoint[];
  height?: number;
  className?: string;
  color?: string;
  stagger?: number;
}) {
  const empty = !data.length || data.every((d) => !d.value);
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
        <RRadar data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke={CHART.grid} />
          <PolarAngleAxis dataKey="subject" tick={{ fill: CHART.axis, fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} />
          <Radar
            name="Score"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.28}
            isAnimationActive
            animationDuration={1100}
          />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}/100`, "Score"]} />
        </RRadar>
      </ResponsiveContainer>
    </ChartShell>
  );
}
