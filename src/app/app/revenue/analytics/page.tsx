import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { getRevenueChartData } from "@/lib/chart-data";
import { EmptyState } from "@/components/ui/states";
import { ExampleDataTag } from "@/components/ui/badge";
import { DynAreaChart, DynBarChart, DynDonutChart } from "@/components/charts/dynamic";
import { CHART } from "@/components/charts/theme";
import { getProductIntelligenceDashboard } from "@/lib/si/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Revenue analytics" };

export const dynamic = "force-dynamic";

export default async function RevenueAnalyticsPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  await requireEntitlement(ctx.organizationId, "REVENUE_RECOVERY");

  const chartData = await getRevenueChartData(ctx.organizationId);
  const si = await getProductIntelligenceDashboard(ctx.organizationId, "REVENUE_RECOVERY");
  if (!chartData.funnel.some((s) => s.count > 0) && !chartData.trend.some((t) => t.projected || t.recovered)) {
    return (
      <div>
        <Link href="/app/revenue" className="text-xs text-neutral-500">← Revenue</Link>
        <EmptyState className="mt-6" title="No data for analytics" description="Add opportunities or import data to see analytics." />
      </div>
    );
  }

  return (
    <div>
      <Link href="/app/revenue" className="text-xs text-neutral-500 hover:text-white">← Revenue</Link>
      <h1 className="mt-3 text-xl font-semibold">Revenue analytics</h1>
      {ctx.organization?.isDemo ? <ExampleDataTag className="mt-2" /> : null}
      <p className="mt-2 text-xs text-neutral-500">{chartData.sourceNote}</p>
      <Card className="mt-6 border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-base">Improvement cycles</CardTitle>
          <CardDescription>
            {si.kpis.cycles_succeeded} completed analysis cycle{si.kpis.cycles_succeeded === 1 ? "" : "s"} · learning confidence {String(si.kpis.learning_confidence).toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/app/intelligence" className="text-sm text-amber-400 hover:text-amber-300">
            Open Client Intelligence dashboard →
          </Link>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <DynAreaChart
          title="Recovered vs projected over time"
          data={chartData.trend}
          series={[
            { key: "projected", label: "Projected", color: CHART.amber },
            { key: "recovered", label: "Recovered", color: CHART.emerald },
          ]}
          footnote={chartData.sourceNote}
        />
        <DynDonutChart
          title="Leakage taxonomy"
          data={chartData.taxonomy}
          footnote={chartData.sourceNote}
        />
        <DynBarChart
          title="Funnel stage counts"
          data={chartData.funnel.map((s) => ({ label: s.label, count: s.count }))}
          series={[{ key: "count", label: "Count", color: CHART.amber }]}
          className="lg:col-span-2"
          height={240}
        />
      </div>
    </div>
  );
}
