import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { getLearningSummary } from "@/lib/learning";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const learning = await getLearningSummary(ctx.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governed learning"
        title="What the workspace has learned"
        description="Patterns are built only from recorded outcomes inside this tenant. No external model invents a result."
      />

      {learning.length === 0 ? (
        <EmptyState
          title="No verified outcomes yet"
          description="As the team records recovered value or realized savings, Kaivaryn will surface which sources, types, and priorities tend to convert."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {learning.map((profile) => (
            <Card key={profile.product}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{profile.product === "REVENUE_RECOVERY" ? "Revenue Recovery" : "Operations Efficiency"}</CardTitle>
                  <Badge tone={profile.confidence === "HIGH" ? "success" : profile.confidence === "MEDIUM" ? "warning" : "default"}>
                    {profile.confidence} confidence
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
                        <span className="truncate text-neutral-200">{pattern.feature.replace(":", " · ")}</span>
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
