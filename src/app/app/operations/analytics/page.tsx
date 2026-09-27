import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { getOperationsChartData, getReadinessRadarData, trendToCumulativeRecovered } from "@/lib/chart-data";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { DynAreaChart, DynBarChart, DynRadarChart, DynStepChart, AnimatedGaugeBar, CHART } from "@/components/charts/dynamic";

export const dynamic = "force-dynamic";

export default async function OpsAnalyticsPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  await requireEntitlement(ctx.organizationId, "OPERATIONS_EFFICIENCY");
  const [chartData, radar] = await Promise.all([
    getOperationsChartData(ctx.organizationId),
    getReadinessRadarData(ctx.organizationId),
  ]);
  if (!chartData.heat.length && !chartData.trend.some((t) => t.projected || t.realized)) {
    return <><Link href="/app/operations" className="text-xs text-neutral-500">← Ops</Link><EmptyState className="mt-6" title="No data" /></>;
  }
  return (
    <div>
      <Link href="/app/operations" className="text-xs text-neutral-500">← Operations</Link>
      <h1 className="mt-3 text-xl font-semibold">Operations analytics</h1>
      {ctx.organization?.isDemo ? <Badge tone="demo" className="mt-2">DEMO</Badge> : null}
      <p className="mt-2 text-xs text-neutral-500">{chartData.sourceNote}</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <DynAreaChart
          className="lg:col-span-2"
          title="Projected vs realized savings"
          data={chartData.trend}
          series={[
            { key: "projected", label: "Projected", color: CHART.amber },
            { key: "realized", label: "Realized", color: CHART.emerald },
          ]}
          stacked
          footnote={chartData.sourceNote}
          stagger={0}
        />
        <AnimatedGaugeBar
          title="Automation readiness"
          value={chartData.readiness}
          footnote="Average readiness across inefficiencies"
        />
        <DynBarChart
          className="lg:col-span-3"
          title="Department heat ranking"
          data={chartData.heat}
          series={[{ key: "waste", label: "Waste / yr", color: CHART.violet }]}
          money
          layout="vertical"
          height={280}
          stagger={2}
        />
        <DynRadarChart
          className="lg:col-span-1"
          title="Automation readiness dimensions"
          description="Multi-factor readiness · not a promise automation ran"
          data={radar.points}
          footnote={radar.sourceNote}
          height={300}
          stagger={3}
        />
        <DynStepChart
          className="lg:col-span-2"
          title="Cumulative realized savings"
          description="Step accumulation of realized amounts"
          data={trendToCumulativeRecovered(chartData.trend.map((t) => ({ label: t.label, realized: t.realized })))}
          series={[
            { key: "cumulative", label: "Cumulative realized", color: CHART.emerald },
            { key: "weekly", label: "Weekly realized", color: CHART.amber },
          ]}
          money
          height={300}
          footnote="Realized only · projected excluded"
          stagger={4}
        />
      </div>
    </div>
  );
}
