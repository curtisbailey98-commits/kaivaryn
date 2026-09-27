/**
 * 720 SI nine-return lineage (preserved names).
 * R1–R9 = REALITY → … → WITNESS. Only Witness finalizes ZERO_STATE_NEXT.
 */
export const COGNITION_STAGES = [
  "REALITY",
  "MEMORY",
  "PREDICTION",
  "COUNTERFACTUAL",
  "CRITIC",
  "SELF",
  "CALIBRATION",
  "META",
  "WITNESS",
] as const;

export type CognitionStage = (typeof COGNITION_STAGES)[number];
export type StageId = CognitionStage | "ZERO_RETURN";

export const RETURN_INDEX: Record<CognitionStage, number> = {
  REALITY: 1,
  MEMORY: 2,
  PREDICTION: 3,
  COUNTERFACTUAL: 4,
  CRITIC: 5,
  SELF: 6,
  CALIBRATION: 7,
  META: 8,
  WITNESS: 9,
};

export const META_WINDOW = 9;
export const STAGES_PER_CYCLE = 9;
export const EXPECTED_STAGE_HISTORY = META_WINDOW * STAGES_PER_CYCLE; // 81
export const MAX_META_WINDOWS = 9; // 9 × 81 = 729 track
export const SI_PROTOCOL = "720SI-Kaivaryn-RR-OE-v1";

export type SiProduct = "REVENUE_RECOVERY" | "OPERATIONS_EFFICIENCY";

export function nextCognitionStage(current: CognitionStage | null): CognitionStage | null {
  if (!current) return "REALITY";
  const idx = COGNITION_STAGES.indexOf(current);
  if (idx < 0 || idx >= COGNITION_STAGES.length - 1) return null;
  return COGNITION_STAGES[idx + 1]!;
}

export function continuityKey(organizationId: string, product: SiProduct): string {
  return `org:${organizationId}:product:${product}`;
}

export const REQUIRED_META_ANALYSIS_KEYS = [
  "recurring_errors",
  "recurring_strengths",
  "cross_cycle_patterns",
  "generalized_methods",
  "failed_methods",
  "calibration_deltas",
  "self_model_evolution",
  "method_performance",
  "contradictions",
  "transferable_discoveries",
] as const;

export type ZeroStatePayload = {
  protocol: string;
  product: SiProduct;
  reality_summary: string;
  memory_refs: string[];
  predictions_open: unknown[];
  counterfactuals: unknown[];
  critic_findings: unknown[];
  self_model_snapshot: Record<string, unknown>;
  calibration_notes: string;
  meta_patterns: unknown[];
  witness_decision: string;
  next_cycle_hints: string[];
  contradiction_ids: string[];
  nest_context: { nest_label: string; nest_level: number };
  resource_spend_so_far: { tokens_used: number; compute_ms_used: number };
  stage_outputs: Partial<Record<CognitionStage, unknown>>;
  prior_zero_state_hash: string | null;
  prior_zero_state_id: string | null;
  lesson_ids: string[];
  open_prediction_ids: string[];
  method_key: string | null;
  method_role: string | null;
  outcome_metrics: Record<string, number | string | null>;
};
