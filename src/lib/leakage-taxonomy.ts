/**
 * Canonical leakage taxonomy for Revenue Recovery.
 * Free-text Opportunity.type is normalized into these chips for UX clarity.
 */

export const LEAKAGE_TYPES = [
  { id: "underbilling", label: "Underbilling", aliases: ["underbill", "under-billing", "missed_fee", "fee_gap"] },
  { id: "underpayment", label: "Underpayment / short-pay", aliases: ["underpay", "short_pay", "shortpay", "under-payment", "failed_payments"] },
  { id: "change_order", label: "Unbilled change order", aliases: ["change_order", "changeorder", "co_missed", "unbilled_co"] },
  { id: "denial", label: "Denial / dispute", aliases: ["denial", "dispute", "appeal", "claim_denial"] },
  { id: "contract", label: "Contract / rate variance", aliases: ["contract", "rate_variance", "pricing_variance", "compliance"] },
  { id: "uncollected_ar", label: "Uncollected AR", aliases: ["uncollected", "aged_ar", "accounts_receivable", "ar_aging"] },
  { id: "scope_creep", label: "Unbilled scope", aliases: ["scope_creep", "unbilled_scope", "scope"] },
  { id: "retention", label: "Account retention risk", aliases: ["churn", "dormant", "retention", "churn_risk", "dormant_customers"] },
  { id: "pipeline", label: "Commercial pipeline stall", aliases: ["pipeline", "stalled_leads", "pipeline_stalls"] },
  { id: "leakage_other", label: "Other leakage", aliases: ["leakage", "revenue_leak", "other", "abandoned_checkout", "missed_appointments", "unanswered_inquiries"] },
] as const;

export type LeakageTypeId = (typeof LEAKAGE_TYPES)[number]["id"];

export function classifyLeakageType(raw?: string | null): { id: LeakageTypeId; label: string } {
  const s = (raw || "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (!s) return { id: "leakage_other", label: "Other leakage" };
  for (const t of LEAKAGE_TYPES) {
    if (t.id === s || (t.aliases as readonly string[]).some((a) => s.includes(a) || a.includes(s))) {
      return { id: t.id, label: t.label };
    }
  }
  // fuzzy contains on labels
  for (const t of LEAKAGE_TYPES) {
    if (s.includes(t.id)) return { id: t.id, label: t.label };
  }
  const readable = (raw || "").replace(/[_-]+/g, " ").trim();
  return { id: "leakage_other", label: readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : "Other leakage" };
}

/** Automation readiness 0–100 from OE signals (deterministic). */
export function automationReadinessScore(opts: {
  automationCandidate: boolean;
  score: number;
  evidenceCount?: number;
  projectedSavings: number;
  priority: string;
}): number {
  let n = 0;
  if (opts.automationCandidate) n += 35;
  n += Math.min(25, Math.round(opts.score * 0.25));
  n += Math.min(15, (opts.evidenceCount ?? 0) * 5);
  if (opts.projectedSavings >= 50000) n += 15;
  else if (opts.projectedSavings >= 10000) n += 8;
  if (opts.priority === "CRITICAL") n += 10;
  else if (opts.priority === "HIGH") n += 6;
  return Math.max(0, Math.min(100, n));
}
