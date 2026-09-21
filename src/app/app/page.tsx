import Link from "next/link";
import { requireOrgAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { assertOrgId } from "@/lib/tenant";

export default async function AppHomePage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const entitlements = await prisma.entitlement.findMany({
    where: { organizationId: ctx.organizationId, active: true },
  });
  const hasRevenue = entitlements.some((e) => e.product === "REVENUE_RECOVERY");
  const hasOps = entitlements.some((e) => e.product === "OPERATIONS_EFFICIENCY");

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Command center</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Choose a product. {ctx.organization?.isDemo ? <Badge tone="demo">DEMO org</Badge> : null}
          </p>
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className={!hasRevenue ? "opacity-60" : undefined}>
          <CardHeader>
            <CardTitle>Revenue Recovery</CardTitle>
            <CardDescription>
              {hasRevenue ? "Entitlement active" : "No active entitlement — activate via engagement"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasRevenue ? (
              <Link href="/app/revenue" className="text-sm text-amber-400 hover:text-amber-300">
                Open Revenue Recovery →
              </Link>
            ) : (
              <Link href="/pricing" className="text-sm text-neutral-400 hover:text-white">
                View pricing →
              </Link>
            )}
          </CardContent>
        </Card>
        <Card className={!hasOps ? "opacity-60" : undefined}>
          <CardHeader>
            <CardTitle>Operations Efficiency</CardTitle>
            <CardDescription>
              {hasOps ? "Entitlement active" : "No active entitlement — activate via engagement"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasOps ? (
              <Link href="/app/operations" className="text-sm text-amber-400 hover:text-amber-300">
                Open Operations Efficiency →
              </Link>
            ) : (
              <Link href="/pricing" className="text-sm text-neutral-400 hover:text-white">
                View pricing →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 flex flex-wrap gap-4 text-sm text-neutral-400">
        <Link href="/app/integrations" className="hover:text-white">Integrations</Link>
        <Link href="/app/approvals" className="hover:text-white">Approvals</Link>
        <Link href="/app/onboarding" className="hover:text-white">Onboarding</Link>
      </div>
    </div>
  );
}
