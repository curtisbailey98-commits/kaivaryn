"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { AnimatedFunnelBars } from "./funnel-bars";
import { AnimatedGaugeBar } from "./gauge-bar";
import { Sparkline } from "./sparkline";

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

export { AnimatedFunnelBars, AnimatedGaugeBar, Sparkline };
export { CHART } from "./theme";
export type DynLineProps = ComponentProps<typeof DynLineChart>;
export type DynAreaProps = ComponentProps<typeof DynAreaChart>;
export type DynBarProps = ComponentProps<typeof DynBarChart>;
export type DynDonutProps = ComponentProps<typeof DynDonutChart>;
