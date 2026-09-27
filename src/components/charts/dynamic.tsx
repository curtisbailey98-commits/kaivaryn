"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { AnimatedFunnelBars } from "./funnel-bars";
import { AnimatedGaugeBar } from "./gauge-bar";
import { Sparkline } from "./sparkline";
import { KpiSpark } from "./kpi-spark";
import { PulseSpark } from "./pulse-spark";

const LoadingBox = ({ height = 260 }: { height?: number }) => (
  <div className="si-glass animate-pulse rounded-xl" style={{ height }} aria-hidden />
);

export const DynLineChart = dynamic(
  () => import("./line-chart").then((m) => m.AnimatedLineChart),
  { ssr: false, loading: () => <LoadingBox /> }
);
export const DynAreaChart = dynamic(
  () => import("./area-chart").then((m) => m.AnimatedAreaChart),
  { ssr: false, loading: () => <LoadingBox /> }
);
export const DynBarChart = dynamic(
  () => import("./bar-chart").then((m) => m.AnimatedBarChart),
  { ssr: false, loading: () => <LoadingBox /> }
);
export const DynDonutChart = dynamic(
  () => import("./donut-chart").then((m) => m.AnimatedDonutChart),
  { ssr: false, loading: () => <LoadingBox /> }
);
export const DynComposedChart = dynamic(
  () => import("./composed-chart").then((m) => m.AnimatedComposedChart),
  { ssr: false, loading: () => <LoadingBox /> }
);
export const DynRadarChart = dynamic(
  () => import("./radar-chart").then((m) => m.AnimatedRadarChart),
  { ssr: false, loading: () => <LoadingBox /> }
);
export const DynWaterfallChart = dynamic(
  () => import("./waterfall-chart").then((m) => m.AnimatedWaterfallChart),
  { ssr: false, loading: () => <LoadingBox /> }
);
export const DynStepChart = dynamic(
  () => import("./step-chart").then((m) => m.AnimatedStepChart),
  { ssr: false, loading: () => <LoadingBox height={240} /> }
);

export { AnimatedFunnelBars, AnimatedGaugeBar, Sparkline, KpiSpark, PulseSpark };
export { CHART } from "./theme";
export type DynLineProps = ComponentProps<typeof DynLineChart>;
export type DynAreaProps = ComponentProps<typeof DynAreaChart>;
export type DynBarProps = ComponentProps<typeof DynBarChart>;
export type DynDonutProps = ComponentProps<typeof DynDonutChart>;
export type DynComposedProps = ComponentProps<typeof DynComposedChart>;
export type DynRadarProps = ComponentProps<typeof DynRadarChart>;
export type DynWaterfallProps = ComponentProps<typeof DynWaterfallChart>;
export type DynStepProps = ComponentProps<typeof DynStepChart>;
