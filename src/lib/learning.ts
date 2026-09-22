import { prisma } from "./prisma";

export type LearningProduct = "REVENUE_RECOVERY" | "OPERATIONS_EFFICIENCY";
export type LearningOutcome = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

type FeatureMap = { source?: string | null; type?: string | null; department?: string | null; priority?: string | null; ruleId?: string | null };

function key(value: string | null | undefined) {
  return value?.trim() || "unknown";
}

function confidenceFor(sampleSize: number) {
  return sampleSize >= 30 ? "HIGH" : sampleSize >= 10 ? "MEDIUM" : "LOW";
}

export async function rebuildLearningProfile(organizationId: string, product: LearningProduct) {
  const events = await prisma.learningEvent.findMany({
    where: { organizationId, product },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const positiveCount = events.filter((event) => event.outcome === "POSITIVE").length;
  const negativeCount = events.filter((event) => event.outcome === "NEGATIVE").length;
  const featureBuckets: Record<string, { sampleSize: number; positive: number; negative: number }> = {};
  for (const event of events) {
    const features = JSON.parse(event.featureJson || "{}") as FeatureMap;
    for (const [dimension, raw] of Object.entries(features)) {
      const bucket = `${dimension}:${key(raw)}`;
      featureBuckets[bucket] ||= { sampleSize: 0, positive: 0, negative: 0 };
      featureBuckets[bucket].sampleSize += 1;
      if (event.outcome === "POSITIVE") featureBuckets[bucket].positive += 1;
      if (event.outcome === "NEGATIVE") featureBuckets[bucket].negative += 1;
    }
  }
  const patterns = Object.entries(featureBuckets)
    .filter(([, value]) => value.sampleSize >= 2)
    .map(([feature, value]) => ({ feature, sampleSize: value.sampleSize, successRate: Math.round((value.positive / value.sampleSize) * 100), positive: value.positive, negative: value.negative }))
    .sort((a, b) => b.sampleSize - a.sampleSize || b.successRate - a.successRate)
    .slice(0, 40);
  const profile = await prisma.learningProfile.upsert({
    where: { organizationId_product: { organizationId, product } },
    update: { sampleSize: events.length, positiveCount, negativeCount, confidence: confidenceFor(events.length), profileJson: JSON.stringify({ patterns, learningPolicy: "outcomes_only", lastEventAt: events[0]?.createdAt || null }), lastLearnedAt: new Date() },
    create: { organizationId, product, sampleSize: events.length, positiveCount, negativeCount, confidence: confidenceFor(events.length), profileJson: JSON.stringify({ patterns, learningPolicy: "outcomes_only" }), lastLearnedAt: new Date() },
  });
  return { ...profile, patterns };
}

export async function recordLearningEvent(input: {
  organizationId: string;
  actorId?: string;
  product: LearningProduct;
  entityType: "Opportunity" | "Inefficiency";
  entityId: string;
  outcome: LearningOutcome;
  features: FeatureMap;
  note?: string;
}) {
  await prisma.learningEvent.create({ data: { organizationId: input.organizationId, actorId: input.actorId, product: input.product, entityType: input.entityType, entityId: input.entityId, eventType: "OUTCOME", outcome: input.outcome, featureJson: JSON.stringify(input.features), note: input.note } });
  return rebuildLearningProfile(input.organizationId, input.product);
}

export async function getLearningSummary(organizationId: string) {
  const profiles = await prisma.learningProfile.findMany({ where: { organizationId }, orderBy: { product: "asc" } });
  return profiles.map((profile) => ({ product: profile.product, sampleSize: profile.sampleSize, positiveCount: profile.positiveCount, negativeCount: profile.negativeCount, confidence: profile.confidence, lastLearnedAt: profile.lastLearnedAt, patterns: (JSON.parse(profile.profileJson || "{}").patterns || []) as Array<{ feature: string; sampleSize: number; successRate: number; positive: number; negative: number }> }));
}

export async function getLearnedAdjustment(organizationId: string, product: LearningProduct, features: FeatureMap) {
  const profile = await prisma.learningProfile.findUnique({ where: { organizationId_product: { organizationId, product } } });
  if (!profile || !["MEDIUM", "HIGH"].includes(profile.confidence)) return 0;
  const patterns = (JSON.parse(profile.profileJson || "{}").patterns || []) as Array<{ feature: string; sampleSize: number; successRate: number }>;
  let adjustment = 0;
  for (const [dimension, raw] of Object.entries(features)) {
    const pattern = patterns.find((item) => item.feature === `${dimension}:${key(raw)}` && item.sampleSize >= 3);
    if (!pattern) continue;
    if (pattern.successRate >= 70) adjustment += 2;
    if (pattern.successRate <= 30) adjustment -= 2;
  }
  return Math.max(-5, Math.min(5, adjustment));
}
