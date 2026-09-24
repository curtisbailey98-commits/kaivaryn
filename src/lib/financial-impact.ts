/**
 * Shared financial impact engine.
 * LLM / intelligence NEVER sets money amounts — only this service (and human actions) do.
 * Estimates (potential/projected) ≠ recovered/realized/verified.
 */

export type RevenueImpact = {
  potential: number;
  approved: number;
  inProgress: number;
  recovered: number;
  verified: number;
  /** Never treat as booked */
  estimateOnly: true;
};

export type OpsImpact = {
  projectedSavings: number;
  realizedSavings: number;
  projectedHoursWeekly: number;
  realizedHoursWeekly: number;
  estimateOnly: true;
};

export function normalizeRevenueAmounts(input: {
  potentialAmount?: number;
  approvedAmount?: number;
  inProgressAmount?: number;
  estimatedAmount?: number;
  recoveredAmount?: number;
  verifiedAmount?: number;
}): RevenueImpact {
  const potential = Math.max(0, input.potentialAmount ?? input.estimatedAmount ?? 0);
  const approved = Math.max(0, Math.min(input.approvedAmount ?? 0, potential || Infinity));
  const inProgress = Math.max(0, input.inProgressAmount ?? 0);
  const recovered = Math.max(0, input.recoveredAmount ?? 0);
  const verified = Math.max(0, Math.min(input.verifiedAmount ?? 0, recovered || Infinity));
  return {
    potential,
    approved: Number.isFinite(approved) ? approved : 0,
    inProgress,
    recovered,
    verified,
    estimateOnly: true,
  };
}

export function normalizeOpsAmounts(input: {
  estimatedWasteAnnual?: number;
  projectedSavings?: number;
  realizedSavings?: number;
  recoveredAnnual?: number;
  hoursWastedWeekly?: number | null;
  projectedHoursWeekly?: number | null;
  realizedHoursWeekly?: number | null;
}): OpsImpact {
  const projected =
    Math.max(0, input.projectedSavings ?? input.estimatedWasteAnnual ?? 0);
  const realized = Math.max(0, input.realizedSavings ?? input.recoveredAnnual ?? 0);
  return {
    projectedSavings: projected,
    realizedSavings: realized,
    projectedHoursWeekly: Math.max(0, input.projectedHoursWeekly ?? input.hoursWastedWeekly ?? 0),
    realizedHoursWeekly: Math.max(0, input.realizedHoursWeekly ?? 0),
    estimateOnly: true,
  };
}

/** Urgency heuristic 0–100 for Action Center ranking (deterministic). */
export function urgencyScore(opts: {
  priority: string;
  ageDays: number;
  amount: number;
  highValueThreshold?: number;
}): number {
  const pri =
    opts.priority === "CRITICAL" ? 40 : opts.priority === "HIGH" ? 30 : opts.priority === "MEDIUM" ? 15 : 5;
  const age = Math.min(30, opts.ageDays) * (30 / 30); // up to 30
  const hv = opts.highValueThreshold ?? 50000;
  const amt = opts.amount >= hv ? 30 : opts.amount >= hv / 2 ? 15 : opts.amount > 0 ? 5 : 0;
  return Math.min(100, pri + age + amt);
}

export function impactForRanking(product: "RR" | "OE", amount: number): number {
  return Math.max(0, amount);
}

/**
 * Client Acquisition pain/opportunity impact estimate. Same rule as above:
 * this is the ONLY place an acquisition-system estimate is produced — the
 * pain engine and reverse-selling copy must read the number from here, never
 * invent one, and every caller must keep presenting it as an estimate
 * ("modeled", "estimated") until the prospect's own numbers confirm it.
 */
export function estimateAcquisitionImpact(input: {
  category: string;
  employeeCountEstimate?: number | null;
  estimatedRevenueUsd?: number | null;
  signalStrength?: number; // 0-100
}): { estimatedImpactUsd: number | null; estimateOnly: true; basis: string } {
  // Deliberately conservative and only produced when we have at least one
  // real sizing signal — otherwise we return null rather than fabricate a
  // number, matching intelligence.ts's INSUFFICIENT_DATA discipline.
  const revenue = input.estimatedRevenueUsd ?? null;
  const headcount = input.employeeCountEstimate ?? null;
  if (!revenue && !headcount) {
    return { estimatedImpactUsd: null, estimateOnly: true, basis: "insufficient sizing data" };
  }
  // Rough, clearly-labeled heuristic: 0.5-2% of estimated revenue (or a
  // headcount-based proxy when revenue is unknown), scaled down for weaker
  // signal strength. This is a starting default, not a claim of precision —
  // AcquisitionSettings/qualification.ts govern how much weight it carries.
  const strengthFactor = Math.max(0.25, Math.min(1, (input.signalStrength ?? 50) / 100));
  let base: number;
  let basis: string;
  if (revenue) {
    base = revenue * 0.01 * strengthFactor;
    basis = `~1% of estimated revenue (${revenue.toLocaleString()}), scaled by signal strength`;
  } else {
    base = (headcount ?? 0) * 2000 * strengthFactor;
    basis = `headcount proxy (${headcount} employees × $2,000), scaled by signal strength`;
  }
  return { estimatedImpactUsd: Math.round(base), estimateOnly: true, basis };
}
