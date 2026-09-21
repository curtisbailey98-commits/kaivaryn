/**
 * Intelligence service — Evidence | Analysis | Recommendation | Decision.
 * Returns INSUFFICIENT_DATA when evidence is lacking; never fabricates findings.
 * Never sets money amounts (financial-impact engine owns numbers).
 */
import { prisma } from "./prisma";

export type IntelligenceResult =
  | { status: "INSUFFICIENT_DATA"; reason: string; requiredSignals: string[]; evidence: string[]; analysis: string; recommendation: string; decision: "INSUFFICIENT_DATA" }
  | {
      status: "FINDING";
      summary: string;
      confidence: "low" | "medium" | "high";
      evidence: string[];
      analysis: string;
      recommendations: string[];
      recommendation: string;
      decision: "PROCEED" | "REVIEW" | "HOLD";
    };

export function analyzeRevenueSignals(input: {
  opportunityCount: number;
  totalEstimated: number;
  totalRecovered: number;
  sources: string[];
}): IntelligenceResult {
  if (input.opportunityCount === 0) {
    return {
      status: "INSUFFICIENT_DATA",
      reason: "No opportunity records available for this organization.",
      requiredSignals: [
        "At least one Opportunity with source and estimated amount",
        "Optional: integration sync providing billing or claims data",
      ],
      evidence: [],
      analysis: "Cannot analyze recovery without opportunity rows.",
      recommendation: "Import CSV, connect a source, or run detection on CRM/payment data.",
      decision: "INSUFFICIENT_DATA",
    };
  }

  const recoveryRate =
    input.totalEstimated > 0 ? input.totalRecovered / input.totalEstimated : 0;
  const evidence = [
    `${input.opportunityCount} opportunities on record`,
    `Estimated/potential pipeline: ${input.totalEstimated.toFixed(0)}`,
    `Recovered to date: ${input.totalRecovered.toFixed(0)}`,
    `Sources present: ${input.sources.length ? input.sources.join(", ") : "unspecified"}`,
  ];
  const analysis =
    recoveryRate < 0.25
      ? "Recovery conversion is below 25% of estimated pipeline."
      : "Recovery activity is underway; estimates remain separate from recovered.";
  const recommendation =
    "Prioritize Critical/High score items; keep estimated ≠ recovered; assign owners.";

  return {
    status: "FINDING",
    summary: analysis,
    confidence: input.opportunityCount >= 5 ? "medium" : "low",
    evidence,
    analysis,
    recommendations: [
      "Keep estimated and recovered amounts separate in all reporting.",
      "Assign owners to Critical and High priority opportunities.",
      "Do not treat estimates as booked revenue.",
    ],
    recommendation,
    decision: recoveryRate < 0.25 ? "REVIEW" : "PROCEED",
  };
}

export function analyzeOperationsSignals(input: {
  inefficiencyCount: number;
  totalEstimatedWaste: number;
  automationCandidates: number;
}): IntelligenceResult {
  if (input.inefficiencyCount === 0) {
    return {
      status: "INSUFFICIENT_DATA",
      reason: "No inefficiency records available for this organization.",
      requiredSignals: [
        "At least one Inefficiency with department and estimated annual waste",
        "Optional: process telemetry or time-study inputs",
      ],
      evidence: [],
      analysis: "Cannot analyze ops efficiency without inefficiency rows.",
      recommendation: "Import processes/inefficiencies or run detection.",
      decision: "INSUFFICIENT_DATA",
    };
  }

  const evidence = [
    `${input.inefficiencyCount} inefficiency records`,
    `Estimated/projected annual waste: ${input.totalEstimatedWaste.toFixed(0)}`,
    `${input.automationCandidates} automation candidates pending human approval`,
  ];
  const analysis = `${input.inefficiencyCount} inefficiencies identified; ${input.automationCandidates} automation candidates (approval-gated).`;
  return {
    status: "FINDING",
    summary: analysis,
    confidence: input.inefficiencyCount >= 5 ? "medium" : "low",
    evidence,
    analysis,
    recommendations: [
      "Automation candidates require ApprovalRequest before any external action.",
      "Prioritize by projected savings and hours; track realized separately.",
      "Resolve or dismiss stale items to keep the command center accurate.",
    ],
    recommendation: "Route automation candidates through approvals; never auto-execute.",
    decision: input.automationCandidates > 0 ? "REVIEW" : "PROCEED",
  };
}

export async function buildIntelligenceBundle(organizationId: string, product?: string) {
  const [oppAgg, ineffAgg, autoCount, openFindings, evidenceCount] = await Promise.all([
    prisma.opportunity.aggregate({
      where: { organizationId },
      _sum: { estimatedAmount: true, recoveredAmount: true, potentialAmount: true },
      _count: true,
    }),
    prisma.inefficiency.aggregate({
      where: { organizationId },
      _sum: { estimatedWasteAnnual: true, recoveredAnnual: true, projectedSavings: true, realizedSavings: true },
      _count: true,
    }),
    prisma.inefficiency.count({ where: { organizationId, automationCandidate: true } }),
    prisma.finding.findMany({
      where: {
        organizationId,
        status: "OPEN",
        ...(product ? { product } : {}),
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    prisma.evidence.count({ where: { organizationId } }),
  ]);

  if (evidenceCount === 0 && oppAgg._count === 0 && ineffAgg._count === 0) {
    return {
      status: "INSUFFICIENT_DATA" as const,
      decision: "INSUFFICIENT_DATA" as const,
      evidence: [] as string[],
      analysis: "No operational evidence in tenant scope.",
      recommendation: "Seed demo data, import CSV, or connect integrations.",
      findings: [],
    };
  }

  const rr = analyzeRevenueSignals({
    opportunityCount: oppAgg._count,
    totalEstimated: oppAgg._sum.potentialAmount ?? oppAgg._sum.estimatedAmount ?? 0,
    totalRecovered: oppAgg._sum.recoveredAmount ?? 0,
    sources: [],
  });
  const oe = analyzeOperationsSignals({
    inefficiencyCount: ineffAgg._count,
    totalEstimatedWaste: ineffAgg._sum.projectedSavings ?? ineffAgg._sum.estimatedWasteAnnual ?? 0,
    automationCandidates: autoCount,
  });

  return {
    status: "FINDING" as const,
    decision: "REVIEW" as const,
    evidence: [...(rr.status === "FINDING" ? rr.evidence : []), ...(oe.status === "FINDING" ? oe.evidence : [])],
    analysis: `RR: ${rr.status === "FINDING" ? rr.analysis : rr.reason}; OE: ${oe.status === "FINDING" ? oe.analysis : oe.reason}`,
    recommendation: "Use Action Center for top impact/urgency; approve external actions only with credentials.",
    findings: openFindings,
    rr,
    oe,
  };
}
