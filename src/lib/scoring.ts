import type { OrgSettings } from "@prisma/client";

export type ScoreFactor = { key: string; label: string; raw: number; weight: number; contribution: number };

export type ScoreResult = {
  score: number; // 0–100 normalized
  factors: ScoreFactor[];
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
};

const PRIORITY_RAW: Record<string, number> = {
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/**
 * Configurable weighted score. Factors exposed to admins via scoreFactorsJson.
 */
export function scoreWorkItem(input: {
  amount: number;
  ageDays: number;
  priorityHint?: string;
  evidenceCount?: number;
  settings?: Pick<
    OrgSettings,
    | "scoreWeightAmount"
    | "scoreWeightAge"
    | "scoreWeightPriority"
    | "scoreWeightEvidence"
    | "highValueThreshold"
  > | null;
}): ScoreResult {
  const s = input.settings;
  const wAmount = s?.scoreWeightAmount ?? 0.35;
  const wAge = s?.scoreWeightAge ?? 0.2;
  const wPri = s?.scoreWeightPriority ?? 0.25;
  const wEv = s?.scoreWeightEvidence ?? 0.2;
  const hv = s?.highValueThreshold ?? 50000;
  const totalW = wAmount + wAge + wPri + wEv || 1;

  const amountNorm = clamp01(input.amount / hv);
  const ageNorm = clamp01(input.ageDays / 60);
  const priNorm = clamp01((PRIORITY_RAW[input.priorityHint || "MEDIUM"] ?? 50) / 100);
  const evNorm = clamp01((input.evidenceCount ?? 0) / 5);

  const factors: ScoreFactor[] = [
    { key: "amount", label: "Financial impact", raw: amountNorm, weight: wAmount / totalW, contribution: 0 },
    { key: "age", label: "Age / staleness", raw: ageNorm, weight: wAge / totalW, contribution: 0 },
    { key: "priority", label: "Priority hint", raw: priNorm, weight: wPri / totalW, contribution: 0 },
    { key: "evidence", label: "Evidence strength", raw: evNorm, weight: wEv / totalW, contribution: 0 },
  ];
  for (const f of factors) f.contribution = f.raw * f.weight * 100;

  const score = Math.round(factors.reduce((a, f) => a + f.contribution, 0));
  const priority: ScoreResult["priority"] =
    score >= 75 ? "CRITICAL" : score >= 55 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";

  return { score, factors, priority };
}
