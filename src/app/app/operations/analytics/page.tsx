import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { requireEntitlement } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function OpsAnalyticsPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  await requireEntitlement(ctx.organizationId, "OPERATIONS_EFFICIENCY");
  const items = await prisma.inefficiency.findMany({ where: { organizationId: ctx.organizationId } });
  if (!items.length) {
    return <><Link href="/app/operations" className="text-xs text-neutral-500">← Ops</Link><EmptyState className="mt-6" title="No data" /></>;
  }
  const byDept: Record<string, { waste: number; recovered: number }> = {};
  for (const i of items) {
    const d = i.department || "Unspecified";
    byDept[d] ??= { waste: 0, recovered: 0 };
    byDept[d].waste += i.estimatedWasteAnnual;
    byDept[d].recovered += i.recoveredAnnual;
  }
  return (
    <div>
      <Link href="/app/operations" className="text-xs text-neutral-500">← Operations</Link>
      <h1 className="mt-3 text-xl font-semibold">Operations analytics</h1>
      {ctx.organization?.isDemo ? <Badge tone="demo" className="mt-2">DEMO</Badge> : null}
      <Card className="mt-6">
        <CardHeader><CardTitle>By department</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {Object.entries(byDept).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-neutral-900 py-1">
              <span>{k}</span>
              <span className="text-neutral-400">waste {formatCurrency(v.waste)} / recovered {formatCurrency(v.recovered)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
