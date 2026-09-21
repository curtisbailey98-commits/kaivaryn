/**
 * Intelligence service — honest analysis.
 * Returns INSUFFICIENT_DATA when evidence is lacking; never fabricates findings.
 */

export type IntelligenceResult =
  | { status: "INSUFFICIENT_DATA"; reason: string; requiredSignals: string[] }
  | {
      status: "FINDING";
      summary: string;
      confidence: "low" | "medium" | "high";
      evidence: string[];
      recommendations: string[];
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
    };
  }

  const recoveryRate =
    input.totalEstimated > 0 ? input.totalRecovered / input.totalEstimated : 0;
  const evidence = [
    `${input.opportunityCount} opportunities on record`,
    `Estimated pipeline: ${input.totalEstimated.toFixed(0)}`,
    `Recovered to date: ${input.totalRecovered.toFixed(0)}`,
    `Sources present: ${input.sources.length ? input.sources.join(", ") : "unspecified"}`,
  ];

  return {
    status: "FINDING",
    summary:
      recoveryRate < 0.25
        ? "Recovery conversion is below 25% of estimated pipeline — prioritize Critical and High Value items."
        : "Recovery activity is underway; continue measuring recovered vs estimated separately.",
    confidence: input.opportunityCount >= 5 ? "medium" : "low",
    evidence,
    recommendations: [
      "Keep estimated and recovered amounts separate in all reporting.",
      "Assign owners to Critical and High priority opportunities.",
      "Do not treat estimates as booked revenue.",
    ],
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
    };
  }

  return {
    status: "FINDING",
    summary: `${input.inefficiencyCount} inefficiencies identified; ${input.automationCandidates} flagged as automation candidates (approval-gated).`,
    confidence: input.inefficiencyCount >= 5 ? "medium" : "low",
    evidence: [
      `${input.inefficiencyCount} inefficiency records`,
      `Estimated annual waste: ${input.totalEstimatedWaste.toFixed(0)}`,
      `${input.automationCandidates} automation candidates pending human approval`,
    ],
    recommendations: [
      "Automation candidates require ApprovalRequest before any external action.",
      "Prioritize by annual waste and hours wasted weekly.",
      "Resolve or dismiss stale items to keep the command center accurate.",
    ],
  };
}
