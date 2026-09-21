/**
 * SI-inspired approval decide pattern for Kaivaryn.
 * Critical gates require step-up confirm before APPROVED.
 * Never auto-executes external actions — records decision only.
 */

export const CRITICAL_GATES = [
  "AUTOMATION_CANDIDATE",
  "INTEGRATION_CHANGE",
  "evolution.deploy",
  "kernel.change",
] as const;

export type DecideInput = {
  type: string;
  decision: "APPROVED" | "REJECTED";
  confirmStepUp?: boolean;
};

export type DecideResult =
  | { ok: true }
  | { ok: false; error: "step_up_required" | "invalid_decision"; message: string };

export function validateApprovalDecision(input: DecideInput): DecideResult {
  if (input.decision !== "APPROVED" && input.decision !== "REJECTED") {
    return { ok: false, error: "invalid_decision", message: "decision must be APPROVED or REJECTED" };
  }
  const critical = (CRITICAL_GATES as readonly string[]).includes(input.type);
  if (input.decision === "APPROVED" && critical && !input.confirmStepUp) {
    return {
      ok: false,
      error: "step_up_required",
      message: "confirmStepUp=true required for critical automation / integration gates",
    };
  }
  return { ok: true };
}
