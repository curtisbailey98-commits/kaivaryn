"use client";

import dynamic from "next/dynamic";
import { EXAMPLE_FRAMEWORK_SERIES } from "@/lib/chart-data";
import { CHART } from "./theme";

const DynAreaChart = dynamic(
  () => import("./area-chart").then((m) => m.AnimatedAreaChart),
  { ssr: false, loading: () => <div className="h-[240px] animate-pulse rounded-xl bg-white/[0.03]" /> }
);

/** Public-site illustration — explicitly not customer live data. */
export function ExampleFrameworkChart({ className }: { className?: string }) {
  return (
    <DynAreaChart
      className={className}
      title="Example framework"
      description="Illustrative progression from signal to verified outcome — not a customer’s live KPIs."
      footnote="Example framework · illustrative series only"
      data={EXAMPLE_FRAMEWORK_SERIES}
      series={[
        { key: "projected", label: "Modeled opportunity", color: CHART.amber },
        { key: "verified", label: "Verified result", color: CHART.emerald },
      ]}
      money={false}
      height={240}
    />
  );
}
