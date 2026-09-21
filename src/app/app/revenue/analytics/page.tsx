import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function RevenueAnalyticsPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  await requireEntitlement(ctx.organizationId, "REVENUE_RECOVERY");

  const opps = await prisma.opportunity.findMany({ where: { organizationId: ctx.organizationId } });
  if (opps.length === 0) {
    return (
      <div>
        <Link href="/app/revenue" className="text-xs text-neutral-500">← Revenue</Link>
        <EmptyState className="mt-6" title="No data for analytics" description="Add opportunities or use the DEMO org seed." />
      </div>
    );
  }

  const byStatus: Record<string, { count: number; estimated: number; recovered: number }> = {};
  const byDept: Record<string, { estimated: number; recovered: number }> = {};
  for (const o of opps) {
    byStatus[o.status] ??= { count: 0, estimated: 0, recovered: 0 };
    byStatus[o.status].count++;
    byStatus[o.status].estimated += o.estimatedAmount;
    byStatus[o.status].recovered += o.recoveredAmount;
    const d = o.department || "Unspecified";
    byDept[d] ??= { estimated: 0, recovered: 0 };
    byDept[d].estimated += o.estimatedAmount;
    byDept[d].recovered += o.recoveredAmount;
  }

  return (
    <div>
      <Link href="/app/revenue" className="text-xs text-neutral-500 hover:text-white">← Revenue</Link>
      <h1 className="mt-3 text-xl font-semibold">Revenue analytics</h1>
      {ctx.organization?.isDemo ? <Badge tone="demo" className="mt-2">DEMO</Badge> : null}
      <p className="mt-2 text-xs text-neutral-500">From live Opportunity queries — estimated vs recovered separated.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>By status</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(byStatus).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-neutral-900 py-1">
                <span>{k} ({v.count})</span>
                <span className="text-neutral-400">est {formatCurrency(v.estimated)} / rec {formatCurrency(v.recovered)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>By department</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(byDept).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-neutral-900 py-1">
                <span>{k}</span>
                <span className="text-neutral-400">est {formatCurrency(v.estimated)} / rec {formatCurrency(v.recovered)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
