/**
 * Champion / challenger method registry for RR recovery + OE workflow changes.
 * Challengers must validate against measured outcomes before promotion.
 */
import { prisma } from "@/lib/prisma";
import type { SiProduct } from "./stages";

export async function ensureDefaultMethods(organizationId: string, product: SiProduct) {
  const defaults =
    product === "REVENUE_RECOVERY"
      ? [
          {
            methodKey: "rr.priority_critical_first",
            role: "champion",
            description: "Work Critical/High recovery opportunities first by score.",
            paramsJson: JSON.stringify({ orderBy: ["priority", "score"], minPriority: "HIGH" }),
          },
          {
            methodKey: "rr.source_cluster_billing",
            role: "challenger",
            description: "Cluster failed-payment billing sources before CRM stalls.",
            paramsJson: JSON.stringify({ preferSources: ["billing", "claims"] }),
          },
        ]
      : [
          {
            methodKey: "oe.hours_waste_first",
            role: "champion",
            description: "Prioritize inefficiencies by projected hours × waste.",
            paramsJson: JSON.stringify({ orderBy: ["hoursWeekly", "projectedSavings"] }),
          },
          {
            methodKey: "oe.automation_gate_first",
            role: "challenger",
            description: "Route automation candidates through approval before other fixes.",
            paramsJson: JSON.stringify({ preferAutomationCandidate: true }),
          },
        ];

  for (const d of defaults) {
    const existing = await prisma.siMethodRegistry.findFirst({
      where: { organizationId, product, methodKey: d.methodKey, version: 1 },
    });
    if (!existing) {
      await prisma.siMethodRegistry.create({
        data: {
          organizationId,
          product,
          methodKey: d.methodKey,
          role: d.role,
          version: 1,
          description: d.description,
          paramsJson: d.paramsJson,
          status: d.role === "champion" ? "active" : "proposed",
          empiricalJson: JSON.stringify({ sampleSize: 0, successRate: null, avgDelta: null }),
        },
      });
    }
  }
}

export async function getChampion(organizationId: string, product: SiProduct) {
  await ensureDefaultMethods(organizationId, product);
  return prisma.siMethodRegistry.findFirst({
    where: { organizationId, product, role: "champion", status: "active" },
    orderBy: { version: "desc" },
  });
}

export async function getChallenger(organizationId: string, product: SiProduct) {
  await ensureDefaultMethods(organizationId, product);
  return prisma.siMethodRegistry.findFirst({
    where: { organizationId, product, role: "challenger", status: { in: ["proposed", "active"] } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function recordMethodOutcome(input: {
  organizationId: string;
  product: SiProduct;
  methodKey: string;
  positive: boolean;
  delta: number;
}) {
  const method = await prisma.siMethodRegistry.findFirst({
    where: {
      organizationId: input.organizationId,
      product: input.product,
      methodKey: input.methodKey,
    },
    orderBy: { version: "desc" },
  });
  if (!method) return null;
  const stats = JSON.parse(method.empiricalJson || "{}") as {
    sampleSize?: number;
    positives?: number;
    negatives?: number;
    avgDelta?: number | null;
    successRate?: number | null;
  };
  const sampleSize = (stats.sampleSize ?? 0) + 1;
  const positives = (stats.positives ?? 0) + (input.positive ? 1 : 0);
  const negatives = (stats.negatives ?? 0) + (input.positive ? 0 : 1);
  const prevAvg = stats.avgDelta ?? 0;
  const avgDelta = prevAvg + (input.delta - prevAvg) / sampleSize;
  const successRate = sampleSize > 0 ? positives / sampleSize : null;
  return prisma.siMethodRegistry.update({
    where: { id: method.id },
    data: {
      empiricalJson: JSON.stringify({ sampleSize, positives, negatives, avgDelta, successRate }),
      updatedAt: new Date(),
    },
  });
}

/**
 * Promote challenger → champion only when measured outcomes beat champion
 * with minimum sample size. Never promote on narrative alone.
 */
export async function tryPromoteChallenger(organizationId: string, product: SiProduct) {
  const champion = await getChampion(organizationId, product);
  const challenger = await getChallenger(organizationId, product);
  if (!champion || !challenger || champion.id === challenger.id) {
    return { promoted: false as const, reason: "missing_pair" };
  }
  const cStats = JSON.parse(challenger.empiricalJson || "{}") as {
    sampleSize?: number;
    successRate?: number | null;
    avgDelta?: number | null;
  };
  const hStats = JSON.parse(champion.empiricalJson || "{}") as {
    sampleSize?: number;
    successRate?: number | null;
    avgDelta?: number | null;
  };
  if ((cStats.sampleSize ?? 0) < 5) {
    return { promoted: false as const, reason: "insufficient_challenger_samples", sampleSize: cStats.sampleSize ?? 0 };
  }
  const cRate = cStats.successRate ?? 0;
  const hRate = hStats.successRate ?? 0;
  const cDelta = cStats.avgDelta ?? 0;
  const hDelta = hStats.avgDelta ?? 0;
  if (!(cRate > hRate && cDelta >= hDelta)) {
    return {
      promoted: false as const,
      reason: "challenger_not_superior",
      challenger: { successRate: cRate, avgDelta: cDelta },
      champion: { successRate: hRate, avgDelta: hDelta },
    };
  }

  await prisma.$transaction([
    prisma.siMethodRegistry.update({
      where: { id: champion.id },
      data: { role: "retired", status: "retired", rolledBackAt: new Date() },
    }),
    prisma.siMethodRegistry.update({
      where: { id: challenger.id },
      data: {
        role: "champion",
        status: "active",
        promotedAt: new Date(),
        validatedAgainst: champion.methodKey,
      },
    }),
  ]);

  return {
    promoted: true as const,
    newChampion: challenger.methodKey,
    previousChampion: champion.methodKey,
  };
}

export async function listMethods(organizationId: string, product?: SiProduct) {
  return prisma.siMethodRegistry.findMany({
    where: { organizationId, ...(product ? { product } : {}) },
    orderBy: [{ product: "asc" }, { role: "asc" }, { version: "desc" }],
  });
}
