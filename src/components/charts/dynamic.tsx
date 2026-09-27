"use client";

/**
 * Client-only chart entrypoints for Server Components.
 *
 * Do NOT export raw `next/dynamic(..., { ssr: false })` results for Server
 * Components to render — Next.js 14 serializes those as functions and throws
 * digest errors ("Functions cannot be passed directly to Client Components"
 * / missing React Client Manifest entries for re-exported values like CHART).
 *
 * Pattern: thin client function wrappers own the dynamic() call; pages import
 * the wrappers (and import CHART from ./theme, never from this file).
 */

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

const LazyLineChart = dynamic(
  () => import("./line-chart").then((m) => m.AnimatedLineChart),
  { ssr: false, loading: () => <LoadingBox /> }
);
const LazyAreaChart = dynamic(
  () => import("./area-chart").then((m) => m.AnimatedAreaChart),
  { ssr: false, loading: () => <LoadingBox /> }
);
const LazyBarChart = dynamic(
  () => import("./bar-chart").then((m) => m.AnimatedBarChart),
  { ssr: false, loading: () => <LoadingBox /> }
);
const LazyDonutChart = dynamic(
  () => import("./donut-chart").then((m) => m.AnimatedDonutChart),
  { ssr: false, loading: () => <LoadingBox /> }
);
const LazyComposedChart = dynamic(
  () => import("./composed-chart").then((m) => m.AnimatedComposedChart),
  { ssr: false, loading: () => <LoadingBox /> }
);
const LazyRadarChart = dynamic(
  () => import("./radar-chart").then((m) => m.AnimatedRadarChart),
  { ssr: false, loading: () => <LoadingBox /> }
);
const LazyWaterfallChart = dynamic(
  () => import("./waterfall-chart").then((m) => m.AnimatedWaterfallChart),
  { ssr: false, loading: () => <LoadingBox /> }
);
const LazyStepChart = dynamic(
  () => import("./step-chart").then((m) => m.AnimatedStepChart),
  { ssr: false, loading: () => <LoadingBox height={240} /> }
);

export function DynLineChart(props: ComponentProps<typeof LazyLineChart>) {
  return <LazyLineChart {...props} />;
}
export function DynAreaChart(props: ComponentProps<typeof LazyAreaChart>) {
  return <LazyAreaChart {...props} />;
}
export function DynBarChart(props: ComponentProps<typeof LazyBarChart>) {
  return <LazyBarChart {...props} />;
}
export function DynDonutChart(props: ComponentProps<typeof LazyDonutChart>) {
  return <LazyDonutChart {...props} />;
}
export function DynComposedChart(props: ComponentProps<typeof LazyComposedChart>) {
  return <LazyComposedChart {...props} />;
}
export function DynRadarChart(props: ComponentProps<typeof LazyRadarChart>) {
  return <LazyRadarChart {...props} />;
}
export function DynWaterfallChart(props: ComponentProps<typeof LazyWaterfallChart>) {
  return <LazyWaterfallChart {...props} />;
}
export function DynStepChart(props: ComponentProps<typeof LazyStepChart>) {
  return <LazyStepChart {...props} />;
}

export { AnimatedFunnelBars, AnimatedGaugeBar, Sparkline, KpiSpark, PulseSpark };
export type DynLineProps = ComponentProps<typeof DynLineChart>;
export type DynAreaProps = ComponentProps<typeof DynAreaChart>;
export type DynBarProps = ComponentProps<typeof DynBarChart>;
export type DynDonutProps = ComponentProps<typeof DynDonutChart>;
export type DynComposedProps = ComponentProps<typeof DynComposedChart>;
export type DynRadarProps = ComponentProps<typeof DynRadarChart>;
export type DynWaterfallProps = ComponentProps<typeof DynWaterfallChart>;
export type DynStepProps = ComponentProps<typeof DynStepChart>;
