/**
 * ONE money glossary for the entire CLIENT SaaS.
 * Estimates ≠ cash. RR cash ≠ OE savings. Never mix under a vague "Verified value".
 *
 * Labels below are the only client-facing strings for these concepts.
 */

export const MONEY = {
  /** RR open opportunity value — modeled, not booked */
  pipelinePotential: {
    label: "Estimated opportunity",
    short: "Estimated",
    definition: "Modeled recoverable revenue still in the funnel. Not cash.",
  },
  /** RR amounts approved or actively being worked */
  inIntervention: {
    label: "In intervention",
    short: "In intervention",
    definition: "Approved or in-recovery amounts currently being worked.",
  },
  /** RR formally approved ceiling */
  approved: {
    label: "Approved",
    short: "Approved",
    definition: "Amount approved for recovery work. Still an estimate until cash posts.",
  },
  /** RR cash actually recorded as recovered */
  cashRecovered: {
    label: "Cash recovered",
    short: "Cash recovered",
    definition: "Cash recorded as recovered on opportunities. Not a forecast.",
  },
  /** RR subset of cash that passed verification */
  verifiedRecovered: {
    label: "Verified recovery",
    short: "Verified",
    definition: "Cash recovered that has been verified against evidence.",
  },
  /** OE modeled annual savings */
  projectedSavings: {
    label: "Projected savings",
    short: "Projected",
    definition: "Modeled annual savings from inefficiencies. Not banked.",
  },
  /** OE recorded outcomes */
  realizedSavings: {
    label: "Realized savings",
    short: "Realized",
    definition: "Savings recorded after intervention. Separate from revenue cash.",
  },
} as const;

export type MoneyTerm = keyof typeof MONEY;

/** Closed / terminal statuses — no SLA risk or urgency scoring. */
export const RR_CLOSED_STATUSES = ["RECOVERED", "VERIFIED", "DISMISSED"] as const;
export const OE_CLOSED_STATUSES = ["REALIZED", "VERIFIED", "RESOLVED", "DISMISSED"] as const;

export function isRrClosed(status: string): boolean {
  return (RR_CLOSED_STATUSES as readonly string[]).includes(status);
}

export function isOeClosed(status: string): boolean {
  return (OE_CLOSED_STATUSES as readonly string[]).includes(status);
}

/** Recovery rate = cash recovered ÷ pipeline potential (honest, labeled). */
export function cashRecoveryRate(cashRecovered: number, pipelinePotential: number): number {
  if (pipelinePotential <= 0) return 0;
  return Math.round((cashRecovered / pipelinePotential) * 1000) / 10;
}

export const MONEY_GLOSSARY_FOOTNOTE =
  "Estimated opportunity and projected savings are estimates. Cash recovered, verified recovery, and realized savings are recorded outcomes. They are never mixed.";
