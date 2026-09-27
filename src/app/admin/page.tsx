import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminDemoFunnelData } from "@/lib/chart-data";
import { DynBarChart, AnimatedFunnelBars, CHART } from "@/components/charts/dynamic";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [orgs, users, demos, audits, funnel] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.demoRequest.count(),
    prisma.auditLog.count(),
    getAdminDemoFunnelData(),
  ]);
  return (
    <div>
      <h1 className="text-2xl font-semibold">Kaivaryn console</h1>
      <p className="mt-1 text-sm text-neutral-400">SUPER_ADMIN only · cross-tenant</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ["Organizations", orgs],
          ["Users", users],
          ["Demo leads", demos],
          ["Audit entries", audits],
        ].map(([l, n]) => (
          <Card key={String(l)}>
            <CardHeader><CardTitle>{l}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{n as number}</CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <AnimatedFunnelBars
          title="Demo pipeline"
          description="Live DemoRequest status counts"
          stages={funnel.stages}
          money={false}
          footnote={funnel.sourceNote}
        />
        <DynBarChart
          title="Lead inflow"
          description="New demo requests by week"
          data={funnel.inflow}
          series={[{ key: "leads", label: "Leads", color: CHART.amber }]}
          height={260}
          footnote={funnel.sourceNote}
        />
      </div>
    </div>
  );
}
