import { prisma } from "@/lib/prisma";
import { recordLearningEvent, getLearningSummary, getLearnedAdjustment } from "@/lib/learning";

async function main() {
  const organization = await prisma.organization.findUnique({ where: { slug: "acme-demo" } });
  if (!organization) throw new Error("missing demo organization");
  await prisma.learningEvent.deleteMany({ where: { organizationId: organization.id } });
  await prisma.learningProfile.deleteMany({ where: { organizationId: organization.id } });
  for (let i = 0; i < 3; i++) await recordLearningEvent({ organizationId: organization.id, product: "REVENUE_RECOVERY", entityType: "Opportunity", entityId: `learning-positive-${i}`, outcome: "POSITIVE", features: { source: "billing", type: "failed_payments", department: "Finance", priority: "HIGH" } });
  for (let i = 0; i < 3; i++) await recordLearningEvent({ organizationId: organization.id, product: "REVENUE_RECOVERY", entityType: "Opportunity", entityId: `learning-negative-${i}`, outcome: "NEGATIVE", features: { source: "crm", type: "stalled_leads", department: "Sales", priority: "LOW" } });
  const summary = await getLearningSummary(organization.id);
  if (summary[0]?.sampleSize !== 6 || summary[0]?.confidence !== "LOW") throw new Error("profile aggregation failed");
  const positive = await getLearnedAdjustment(organization.id, "REVENUE_RECOVERY", { source: "billing", type: "failed_payments", department: "Finance", priority: "HIGH" });
  if (positive !== 0) throw new Error("low-confidence profile adjusted scoring");
  console.log("LEARNING LOOP PASSED: outcomes persisted, profile rebuilt, low-confidence guard held");
}
main().finally(() => prisma.$disconnect());
