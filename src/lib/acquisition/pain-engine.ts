import { prisma } from "@/lib/prisma";
import { getPlatformOrgId } from "./platform-org";
import { estimateAcquisitionImpact } from "@/lib/financial-impact";

type Rule = {
  ruleId: string; // doubles as the pain category (e.g. for closed-loop learning breakdowns)
  label: string;
  /** Returns supporting evidence strings if the rule fires, else null. Deliberately
   *  conservative — most rules need a specific signal category/type present, not
   *  just "any signal", so we never manufacture a hypothesis from nothing. */
  evaluate: (ctx: RuleContext) => { evidence: string[]; reasoning: string; confidence: "low" | "medium" } | null;
};

type RuleContext = {
  signalTypes: string[];
  signalCategories: string[];
  industry: string | null;
  employeeCountEstimate: number | null;
};

const RULES: Rule[] = [
  {
    ruleId: "conversion_leakage",
    label: "Conversion leakage from web/form engagement",
    evaluate: (ctx) => {
      if (!ctx.signalCategories.includes("engagement")) return null;
      return {
        evidence: ["Prospect engaged directly (form submission / site activity) — a live top-of-funnel signal worth qualifying quickly."],
        reasoning: "Direct engagement signals are time-sensitive; delayed follow-up commonly loses otherwise-winnable leads.",
        confidence: "medium",
      };
    },
  },
  {
    ruleId: "manual_sales_ops",
    label: "Manual, non-automated sales operations",
    evaluate: (ctx) => {
      const hiringForSales = ctx.signalTypes.some((t) => /hiring|sales_ops|sdr|bdr/i.test(t));
      if (!hiringForSales) return null;
      return {
        evidence: ["Hiring activity observed for sales/operations roles."],
        reasoning: "Headcount growth in sales/ops roles often indicates the current process doesn't scale without adding people — an automation-fit signal, not a confirmed problem.",
        confidence: "low",
      };
    },
  },
  {
    ruleId: "workflow_automation_fit",
    label: "General workflow/automation fit",
    evaluate: (ctx) => {
      const automationSignal = ctx.signalTypes.some((t) => /automation|ai_hiring|tech_stack_change/i.test(t));
      if (!automationSignal) return null;
      return {
        evidence: ["Signal indicates active interest or investment in automation/AI tooling."],
        reasoning: "Companies actively evaluating automation tooling are more likely to have identified — but not yet solved — a specific operational bottleneck.",
        confidence: "low",
      };
    },
  },
  {
    ruleId: "growth_scaling_pressure",
    label: "Growth outpacing process maturity",
    evaluate: (ctx) => {
      if (!ctx.signalCategories.includes("expansion") && !ctx.signalCategories.includes("funding")) return null;
      return {
        evidence: ["Expansion or funding signal observed — headcount/revenue growth often outpaces manual-process capacity."],
        reasoning: "Rapid growth is a classic precursor to lead-response and operational bottlenecks, though not confirmed without account-specific detail.",
        confidence: "low",
      };
    },
  },
];

/**
 * Generates evidence-based pain/opportunity hypotheses for an account.
 * Requires AccountResearch to already exist (run research.ts first) — if
 * there's no verified evidence at all, returns insufficient rather than
 * fabricating a hypothesis. Every hypothesis is stored as a Finding
 * (product: CLIENT_ACQUISITION, status: OPEN, confidence preserved) with
 * its supporting Evidence rows, exactly mirroring detection.ts's
 * ensureFinding dedup pattern (one open Finding per ruleId per account).
 */
export async function generatePainHypotheses(prospectAccountId: string, actorId?: string | null) {
  void actorId;

  const account = await prisma.prospectAccount.findUniqueOrThrow({
    where: { id: prospectAccountId },
    include: { intentSignals: true, research: true },
  });

  if (!account.research || account.research.status !== "COMPLETE") {
    return { status: "INSUFFICIENT_DATA" as const, reason: "Run account research before generating pain hypotheses." };
  }

  const ctx: RuleContext = {
    signalTypes: account.intentSignals.map((s) => s.signalType),
    signalCategories: account.intentSignals.map((s) => s.signalCategory),
    industry: account.industry,
    employeeCountEstimate: account.employeeCountEstimate,
  };

  const platformOrgId = await getPlatformOrgId();
  const created: string[] = [];
  const skippedExisting: string[] = [];

  for (const rule of RULES) {
    const result = rule.evaluate(ctx);
    if (!result) continue;

    const existing = await prisma.finding.findFirst({
      where: { organizationId: platformOrgId, prospectAccountId, ruleId: rule.ruleId, status: { in: ["OPEN", "INSUFFICIENT_DATA"] } },
    });
    if (existing) {
      skippedExisting.push(rule.ruleId);
      continue;
    }

    const impact = estimateAcquisitionImpact({
      category: rule.ruleId,
      employeeCountEstimate: account.employeeCountEstimate,
      estimatedRevenueUsd: account.estimatedRevenueUsd,
      signalStrength: account.intentScore,
    });

    const finding = await prisma.finding.create({
      data: {
        organizationId: platformOrgId,
        product: "CLIENT_ACQUISITION",
        prospectAccountId,
        ruleId: rule.ruleId,
        status: "OPEN",
        evidenceSummary: result.evidence.join(" "),
        analysis: result.reasoning,
        recommendation: `Investigate ${rule.label.toLowerCase()} during account research / the demo before presenting this as a finding to the prospect.`,
        confidence: result.confidence,
        impactEstimate: impact.estimatedImpactUsd ?? undefined,
        explainJson: JSON.stringify({ ruleId: rule.ruleId, label: rule.label, impactBasis: impact.basis, estimateOnly: true }),
      },
    });

    for (const evidenceLine of result.evidence) {
      await prisma.evidence.create({
        data: {
          organizationId: platformOrgId,
          prospectAccountId,
          findingId: finding.id,
          kind: "RULE_HIT",
          summary: evidenceLine,
          source: "pain-engine",
        },
      });
    }
    created.push(rule.ruleId);
  }

  return { status: "COMPLETE" as const, created, skippedExisting };
}
