import { prisma } from "@/lib/prisma";
import { getAcquisitionSettings } from "./settings";
import type { ScoreFactor } from "@/lib/scoring";
import type { QualificationResult } from "./types";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function rangeFit(value: number | null | undefined, min: number, max: number): number {
  if (value === null || value === undefined) return 0; // unknown earns no credit — encourages enrichment, never fabricates fit
  if (value < min) return clamp01(value / min) * 0.5; // below range: partial credit, scaled
  if (value > max) return clamp01(max / value) * 0.7; // above range: still plausibly a fit, discounted
  return 1;
}

/**
 * Same shape as scoring.ts's scoreWorkItem: weighted factors → 0-100 →
 * routing bucket, weights and thresholds pulled from AcquisitionSettings
 * (admin-configurable), every factor persisted with its raw/weight/
 * contribution so the score is always explainable — never an unexplained
 * number.
 */
export async function scoreProspect(prospectAccountId: string): Promise<QualificationResult> {
  const settings = await getAcquisitionSettings();
  const account = await prisma.prospectAccount.findUniqueOrThrow({
    where: { id: prospectAccountId },
    include: {
      contacts: true,
      intentSignals: { orderBy: { detectedAt: "desc" }, take: 1 },
      findings: { where: { product: "CLIENT_ACQUISITION" } },
    },
  });

  const icpEmployeeFit = rangeFit(account.employeeCountEstimate, settings.icpMinEmployees, settings.icpMaxEmployees);
  const icpRevenueFit = rangeFit(account.estimatedRevenueUsd, settings.icpMinRevenueUsd, settings.icpMaxRevenueUsd);
  const icpKnownCount = [account.employeeCountEstimate, account.estimatedRevenueUsd].filter((v) => v != null).length;
  const icpFitRaw = icpKnownCount > 0 ? (icpEmployeeFit + icpRevenueFit) / 2 : 0;

  const intentRaw = clamp01(account.intentScore / 100);

  const acceptedFindings = account.findings.filter((f) => f.status === "ACCEPTED" || f.status === "OPEN");
  const painRaw = clamp01(acceptedFindings.length / 3);

  const impactEstimateSum = account.findings.reduce((sum, f) => sum + (f.impactEstimate ?? 0), 0);
  const economicRaw = account.estimatedDealValueCents
    ? clamp01(account.estimatedDealValueCents / 100 / 120000) // $120k/yr ≈ a $10k/mo engagement
    : clamp01(impactEstimateSum / 50000);

  const reachableBuyers = account.contacts.filter((c) => c.isEconomicBuyer && c.email).length;
  const anyContact = account.contacts.length > 0 ? 0.3 : 0;
  const decisionMakerRaw = clamp01(reachableBuyers >= 1 ? 1 : anyContact);

  const lastSignalAt = account.intentSignals[0]?.detectedAt ?? null;
  const daysSinceSignal = lastSignalAt ? (Date.now() - lastSignalAt.getTime()) / (1000 * 60 * 60 * 24) : null;
  const timingRaw = daysSinceSignal === null ? 0 : clamp01(1 - daysSinceSignal / 30);

  const weights = {
    icpFit: settings.weightIcpFit,
    intent: settings.weightIntent,
    pain: settings.weightPain,
    economicValue: settings.weightEconomicValue,
    decisionMakerAccess: settings.weightDecisionMakerAccess,
    timing: settings.weightTiming,
  };
  const totalW = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  const rawFactors: Array<[keyof typeof weights, string, number]> = [
    ["icpFit", "ICP fit (size/revenue)", icpFitRaw],
    ["intent", "Intent strength", intentRaw],
    ["pain", "Pain / opportunity evidence", painRaw],
    ["economicValue", "Economic value", economicRaw],
    ["decisionMakerAccess", "Decision-maker access", decisionMakerRaw],
    ["timing", "Timing / urgency", timingRaw],
  ];

  const factors: ScoreFactor[] = rawFactors.map(([key, label, raw]) => {
    const weight = weights[key] / totalW;
    return { key, label, raw, weight, contribution: raw * weight * 100 };
  });

  const total = Math.max(0, Math.min(100, Math.round(factors.reduce((a, f) => a + f.contribution, 0))));
  const routing: QualificationResult["routing"] =
    total >= settings.priorityThreshold ? "PRIORITY" : total >= settings.nurtureThreshold ? "NURTURE" : "HOLD";

  await prisma.prospectAccount.update({
    where: { id: prospectAccountId },
    data: {
      qualificationScore: total,
      qualificationFactorsJson: JSON.stringify({ factors, computedAt: new Date().toISOString(), settingsKey: "default" }),
      priority: total >= 75 ? "CRITICAL" : total >= 55 ? "HIGH" : total >= 35 ? "MEDIUM" : "LOW",
    },
  });

  return { total, factors, routing };
}
