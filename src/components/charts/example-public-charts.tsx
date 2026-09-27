"use client";

import dynamic from "next/dynamic";
import {
  EXAMPLE_PRICING_SERIES,
  EXAMPLE_HOW_IT_WORKS_STEPS,
  EXAMPLE_RECOVERY_WATERFALL,
} from "@/lib/chart-data";
import { CHART } from "./theme";

const Loading = ({ h = 240 }: { h?: number }) => (
  <div className="animate-pulse rounded-xl bg-white/[0.03]" style={{ height: h }} aria-hidden />
);

const DynComposedChart = dynamic(
  () => import("./composed-chart").then((m) => m.AnimatedComposedChart),
  { ssr: false, loading: () => <Loading /> }
);
const DynStepChart = dynamic(
  () => import("./step-chart").then((m) => m.AnimatedStepChart),
  { ssr: false, loading: () => <Loading /> }
);
const DynWaterfallChart = dynamic(
  () => import("./waterfall-chart").then((m) => m.AnimatedWaterfallChart),
  { ssr: false, loading: () => <Loading h={280} /> }
);
const DynBarChart = dynamic(
  () => import("./bar-chart").then((m) => m.AnimatedBarChart),
  { ssr: false, loading: () => <Loading /> }
);

/** Pricing page — labeled example engagement motion, not live seats. */
export function ExamplePricingMotion({ className }: { className?: string }) {
  return (
    <DynComposedChart
      className={className}
      title="Example engagement motion"
      description="Illustrative seats vs modeled value index — not customer KPIs or realized revenue."
      footnote="Example framework · illustrative only · projected ≠ realized"
      data={EXAMPLE_PRICING_SERIES}
      bars={[{ key: "seats", label: "Example seats", color: CHART.amber }]}
      lines={[{ key: "value", label: "Modeled value index", color: CHART.emerald }]}
      money={false}
      height={260}
    />
  );
}

/** How-it-works — step maturity illustration. */
export function ExampleHowItWorksChart({ className }: { className?: string }) {
  return (
    <DynStepChart
      className={className}
      title="Example operating maturity"
      description="Illustrative step progression through the six-stage loop — not a customer scorecard."
      footnote="Example framework · illustrative series only"
      data={EXAMPLE_HOW_IT_WORKS_STEPS}
      series={[{ key: "maturity", label: "Maturity index", color: CHART.sky }]}
      money={false}
      height={240}
    />
  );
}

/** Thank-you — small ranking of example next steps. */
export function ExampleThankYouChart({ className }: { className?: string }) {
  const data = [
    { label: "Schedule Zoom", score: 100 },
    { label: "Prep signals", score: 72 },
    { label: "Review pricing", score: 55 },
  ];
  return (
    <DynBarChart
      className={className}
      title="Example next-step ranking"
      description="Suggested prep order after a demo request — illustrative, not a commitment."
      footnote="Example framework · not a live pipeline"
      data={data}
      series={[{ key: "score", label: "Priority", color: CHART.amber }]}
      layout="vertical"
      money={false}
      height={200}
    />
  );
}

/** Value page — labeled recovery waterfall example. */
export function ExampleRecoveryWaterfall({ className }: { className?: string }) {
  return (
    <DynWaterfallChart
      className={className}
      title="Example recovery path"
      description="Illustrative filter → verified path. Not a customer case study and not realized cash."
      footnote="Example framework · verified bar is illustrative, not banked recovery"
      stages={EXAMPLE_RECOVERY_WATERFALL}
      money={false}
      height={280}
    />
  );
}
