import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { getLearningSummary } from "@/lib/learning";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { MONEY, MONEY_GLOSSARY_FOOTNOTE } from "@/lib/money-glossary";
import { humanizeLabel } from "@/lib/labels";

export const metadata = { title: "Learning" };

export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const [learning, rrAgg, oeAgg, openHigh, openCritical] = await Promise.all([
    getLearningSummary(ctx.organizationId),
    prisma.opportunity.aggregate({
      where: { organizationId: ctx.organizationId },
      _sum: { recoveredAmount: true, verifiedAmount: true },
      _count: { _all: true },
    }),
    prisma.inefficiency.aggregate({
      where: { organizationId: ctx.organizationId },
      _sum: { realizedSavings: true },
      _count: { _all: true },
    }),
    prisma.opportunity.count({
      where: { organizationId: ctx.organizationId, score: { gte: 70 }, status: { notIn: ["RECOVERED", "VERIFIED", "DISMISSED"] } },
    }),
    prisma.inefficiency.count({
      where: { organizationId: ctx.organizationId, priority: "CRITICAL", status: { notIn: ["REALIZED", "VERIFIED", "RESOLVED", "DISMISSED"] } },
    }),
  ]);

  const cashRecovered = rrAgg._sum.recoveredAmount ?? 0;
  const verifiedRecovered = rrAgg._sum.verifiedAmount ?? 0;
  const realizedSavings = oeAgg._sum.realizedSavings ?? 0;
  const totalOutcomes = learning.reduce((n, p) => n + p.sampleSize, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governed learning"
        title="What improved / what's next"
        description="Patterns are built only from recorded outcomes inside this tenant. Ledger figures below match Revenue Recovery and Operations Efficiency."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{MONEY.cashRecovered.label}</CardDescription>
            <CardTitle className="text-xl tabular-nums text-emerald-300">{formatCurrency(cashRecovered)}</CardTitle>
            {verifiedRecovered > 0 ? (
              <p className="text-[10px] text-neutral-500">{MONEY.verifiedRecovered.short}: {formatCurrency(verifiedRecovered)}</p>
            ) : null}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{MONEY.realizedSavings.label}</CardDescription>
            <CardTitle className="text-xl tabular-nums text-emerald-300">{formatCurrency(realizedSavings)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Verified outcomes</CardDescription>
            <CardTitle className="text-xl tabular-nums text-amber-200">{totalOutcomes}</CardTitle>
            <p className="text-[10px] text-neutral-500">Learning events recorded</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>What&apos;s next</CardDescription>
            <CardTitle className="text-base leading-snug text-neutral-100">
              {openHigh + openCritical > 0
                ? `${openHigh} high-confidence · ${openCritical} critical open`
                : "Queue clear — import data or run detection"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      <p className="text-xs text-neutral-500">{MONEY_GLOSSARY_FOOTNOTE}</p>

      {learning.length === 0 ? (
        <EmptyState
          title="No verified outcomes yet"
          description="As the team records cash recovered or realized savings, Kaivaryn will surface which sources, types, and priorities tend to convert."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {learning.map((profile) => (
            <Card key={profile.product}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{profile.product === "REVENUE_RECOVERY" ? "Revenue Recovery" : "Operations Efficiency"}</CardTitle>
                  <Badge tone={profile.confidence === "HIGH" ? "success" : profile.confidence === "MEDIUM" ? "warning" : "default"}>
                    {humanizeLabel(profile.confidence)} confidence
                  </Badge>
                </div>
                <CardDescription>
                  {profile.sampleSize} recorded outcomes · {profile.positiveCount} positive · {profile.negativeCount} negative
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profile.patterns.length === 0 ? (
                  <p className="text-sm text-neutral-500">Not enough repeated features to publish a pattern.</p>
                ) : (
                  <ul className="space-y-2">
                    {profile.patterns.slice(0, 8).map((pattern) => (
                      <li key={pattern.feature} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 px-3 py-2 text-sm">
                        <span className="truncate text-neutral-200">
                          {pattern.feature
                            .split(":")
                            .map((part) => humanizeLabel(part))
                            .join(" · ")}
                        </span>
                        <span className="shrink-0 text-xs text-neutral-500">
                          {pattern.successRate}% · n={pattern.sampleSize}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-neutral-600">
        Learning never writes money amounts. Financial impact still comes from recorded estimates and verified results.{" "}
        <Link href="/app" className="text-amber-400 hover:text-amber-300">
          Return to command center
        </Link>
      </p>
    </div>
  );
}
