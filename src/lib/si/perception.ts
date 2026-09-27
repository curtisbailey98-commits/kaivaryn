/**
 * Product-grounded perception for RR/OE — never fabricates money or outcomes.
 * Reads live tenant Opportunity / Inefficiency / Learning rows only.
 */
import { prisma } from "@/lib/prisma";
import type { SiProduct } from "./stages";

export type ProductReality = {
  product: SiProduct;
  evidence_available: boolean;
  observations: string[];
  reality_summary: string;
  metrics: Record<string, number>;
  sample_ids: string[];
  insufficient_reason?: string;
};

export async function perceiveProductReality(
  organizationId: string,
  product: SiProduct,
): Promise<ProductReality> {
  if (product === "REVENUE_RECOVERY") {
    const [agg, byStatus, top] = await Promise.all([
      prisma.opportunity.aggregate({
        where: { organizationId },
        _count: true,
        _sum: {
          potentialAmount: true,
          estimatedAmount: true,
          recoveredAmount: true,
          verifiedAmount: true,
        },
      }),
      prisma.opportunity.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { _all: true },
        _sum: { recoveredAmount: true, potentialAmount: true },
      }),
      prisma.opportunity.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { id: true, title: true, status: true, recoveredAmount: true, potentialAmount: true, type: true },
      }),
    ]);

    if (agg._count === 0) {
      return {
        product,
        evidence_available: false,
        observations: [],
        reality_summary: "No Revenue Recovery opportunities in tenant scope.",
        metrics: {},
        sample_ids: [],
        insufficient_reason: "Need at least one Opportunity row.",
      };
    }

    const potential = agg._sum.potentialAmount ?? agg._sum.estimatedAmount ?? 0;
    const recovered = agg._sum.recoveredAmount ?? 0;
    const verified = agg._sum.verifiedAmount ?? 0;
    const observations = [
      `${agg._count} opportunities on record`,
      `Potential/estimated pipeline: ${potential.toFixed(2)}`,
      `Recovered (recorded): ${recovered.toFixed(2)}`,
      `Verified (recorded): ${verified.toFixed(2)}`,
      ...byStatus.map(
        (s) =>
          `status=${s.status}: n=${s._count._all}, recovered=${(s._sum.recoveredAmount ?? 0).toFixed(2)}`,
      ),
    ];

    return {
      product,
      evidence_available: true,
      observations,
      reality_summary: `RR reality: ${agg._count} opps; recovered ${recovered.toFixed(0)} of potential ${potential.toFixed(0)}.`,
      metrics: {
        opportunity_count: agg._count,
        potential,
        recovered,
        verified,
        recovery_rate: potential > 0 ? recovered / potential : 0,
      },
      sample_ids: top.map((t) => t.id),
    };
  }

  const [agg, byStatus, top] = await Promise.all([
    prisma.inefficiency.aggregate({
      where: { organizationId },
      _count: true,
      _sum: {
        estimatedWasteAnnual: true,
        projectedSavings: true,
        realizedSavings: true,
        recoveredAnnual: true,
      },
    }),
    prisma.inefficiency.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
      _sum: { realizedSavings: true, projectedSavings: true },
    }),
    prisma.inefficiency.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, title: true, status: true, projectedSavings: true, realizedSavings: true, department: true },
    }),
  ]);

  if (agg._count === 0) {
    return {
      product,
      evidence_available: false,
      observations: [],
      reality_summary: "No Operations Efficiency inefficiencies in tenant scope.",
      metrics: {},
      sample_ids: [],
      insufficient_reason: "Need at least one Inefficiency row.",
    };
  }

  const projected = agg._sum.projectedSavings ?? agg._sum.estimatedWasteAnnual ?? 0;
  const realized = agg._sum.realizedSavings ?? agg._sum.recoveredAnnual ?? 0;
  const observations = [
    `${agg._count} inefficiencies on record`,
    `Projected savings: ${projected.toFixed(2)}`,
    `Realized savings: ${realized.toFixed(2)}`,
    ...byStatus.map(
      (s) =>
        `status=${s.status}: n=${s._count._all}, realized=${(s._sum.realizedSavings ?? 0).toFixed(2)}`,
    ),
  ];

  return {
    product,
    evidence_available: true,
    observations,
    reality_summary: `OE reality: ${agg._count} items; realized ${realized.toFixed(0)} of projected ${projected.toFixed(0)}.`,
    metrics: {
      inefficiency_count: agg._count,
      projected,
      realized,
      realization_rate: projected > 0 ? realized / projected : 0,
    },
    sample_ids: top.map((t) => t.id),
  };
}

export async function loadLearningSignals(organizationId: string, product: SiProduct) {
  const [profile, events, lessons] = await Promise.all([
    prisma.learningProfile.findUnique({
      where: { organizationId_product: { organizationId, product } },
    }),
    prisma.learningEvent.findMany({
      where: { organizationId, product },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.siLesson.findMany({
      where: { organizationId, product },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return { profile, events, lessons };
}
