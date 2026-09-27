/**
 * Amount / role-based approval gates from OrgSettings.
 * High-value recovery is never silently applied when above requireApprovalAbove —
 * it queues an ApprovalRequest (honest, no fake external exec).
 */
import { roleRank } from "./rbac";

export type ApprovalSettings = {
  highValueThreshold: number;
  managerApprovalLimit: number;
  adminApprovalLimit: number;
  requireApprovalAbove: number;
};

export type GateResult =
  | { ok: true; mode: "direct" }
  | { ok: false; reason: string; needsRole?: string }
  | { ok: true; mode: "queue_approval"; reason: string };

/** Minimum role rank that may directly record this recovery amount. */
export function minRoleForAmount(amount: number, s: ApprovalSettings): "MANAGER" | "ADMIN" | "OWNER" {
  if (amount > s.adminApprovalLimit) return "OWNER";
  if (amount > s.managerApprovalLimit) return "ADMIN";
  return "MANAGER";
}

export function evaluateRecoveryGate(opts: {
  amount: number;
  role: string | null | undefined;
  settings: ApprovalSettings;
}): GateResult {
  const amount = Math.max(0, opts.amount);
  if (!Number.isFinite(amount)) {
    return { ok: false, reason: "Invalid amount" };
  }

  // At/above requireApprovalAbove → always queue approval (even Owners get audit trail)
  if (amount >= opts.settings.requireApprovalAbove) {
    return {
      ok: true,
      mode: "queue_approval",
      reason: `Amount ${amount} ≥ requireApprovalAbove (${opts.settings.requireApprovalAbove}); queued for approval.`,
    };
  }

  const needed = minRoleForAmount(amount, opts.settings);
  const needRank = roleRank(needed);
  if (roleRank(opts.role) < needRank) {
    return {
      ok: false,
      reason: `Amount ${amount} requires ${needed}+ (limit manager=${opts.settings.managerApprovalLimit}, admin=${opts.settings.adminApprovalLimit}).`,
      needsRole: needed,
    };
  }
  return { ok: true, mode: "direct" };
}

export function isHighValue(amount: number, highValueThreshold: number): boolean {
  return amount >= highValueThreshold;
}
