/**
 * Won-back amounts entered while CREATING an item (new opportunity "Recovered amount",
 * createInefficiency realizedSavings/recoveredAnnual).
 *
 * Creating an item only needs "write" (Analyst+), but recording money as won back needs
 * "record_financial" (Manager+) plus the same amount limits as Record recovery / Record savings
 * (OrgSettings managerApprovalLimit / adminApprovalLimit / requireApprovalAbove).
 *
 * The create actions always insert the item with NO won-back amount and then call
 * settleWonBackOnCreate, which:
 *   - no amount            → nothing
 *   - no confirm rights    → amount ignored (audited), item stays un-won
 *   - above the role limit → amount not recorded, user told which role is needed
 *   - at/above approval    → HIGH_VALUE_RECOVERY / HIGH_VALUE_SAVINGS request (applied by decideApproval)
 *   - within limit         → recorded exactly like recordRecovery / recordSavings (status change + audit)
 */
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { evaluateRecoveryGate, type ApprovalSettings } from "@/lib/approval-thresholds";
import { recordStatusChange } from "@/lib/status-history";
import { writeAudit } from "@/lib/audit";
import { notifyOrgManagers } from "@/lib/notifications";

export type WonBackOnCreate =
  | { mode: "none" }
  | { mode: "ignored_no_rights"; submitted: number; message: string }
  | { mode: "blocked_limit"; submitted: number; needsRole?: string; message: string }
  | { mode: "queued_approval"; submitted: number; approvalId?: string; message: string }
  | { mode: "recorded"; amount: number; toStatus: string; message: string };

/** Statuses that claim money was won back — only reachable at creation through a recorded amount. */
export const RR_WON_BACK_STATUSES = ["RECOVERED", "PARTIALLY_RECOVERED", "VERIFIED"];
export const OE_WON_BACK_STATUSES = ["REALIZED", "VERIFIED", "RESOLVED"];

/** Pure decision (no DB). */
export function decideWonBackOnCreate(opts: {
  amount: number;
  role: string | null | undefined;
  settings: ApprovalSettings;
  label: "Recovered amount" | "Realized savings";
}): WonBackOnCreate {
  const amount = Number(opts.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { mode: "none" };
  if (!can(opts.role, "record_financial")) {
    return {
      mode: "ignored_no_rights",
      submitted: amount,
      message: `${opts.label} was not saved — a manager, admin or owner records won-back amounts.`,
    };
  }
  const gate = evaluateRecoveryGate({ amount, role: opts.role, settings: opts.settings });
  if (!gate.ok) {
    return {
      mode: "blocked_limit",
      submitted: amount,
      needsRole: gate.needsRole,
      message: `${opts.label} was not saved — this amount needs ${gate.needsRole ? gate.needsRole.toLowerCase() : "a higher role"} or above to record.`,
    };
  }
  if (gate.mode === "queue_approval") {
    return { mode: "queued_approval", submitted: amount, message: `${opts.label} sent to Approvals (above your approval threshold).` };
  }
  return { mode: "recorded", amount, toStatus: "", message: `${opts.label} recorded.` };
}

export function approvalSettingsFrom(s: {
  highValueThreshold: number;
  managerApprovalLimit: number;
  adminApprovalLimit: number;
  requireApprovalAbove: number;
}): ApprovalSettings {
  return {
    highValueThreshold: s.highValueThreshold,
    managerApprovalLimit: s.managerApprovalLimit,
    adminApprovalLimit: s.adminApprovalLimit,
    requireApprovalAbove: s.requireApprovalAbove,
  };
}

/** Applies the decision to an item that was just created with no won-back amount. Tenant-scoped. */
export async function settleWonBackOnCreate(opts: {
  kind: "opportunity" | "inefficiency";
  organizationId: string;
  actorId: string;
  role: string | null | undefined;
  entityId: string;
  amount: number;
}): Promise<WonBackOnCreate> {
  const settings = await prisma.orgSettings.upsert({
    where: { organizationId: opts.organizationId },
    update: {},
    create: { organizationId: opts.organizationId },
  });
  const isOpp = opts.kind === "opportunity";
  const decision = decideWonBackOnCreate({
    amount: opts.amount,
    role: opts.role,
    settings: approvalSettingsFrom(settings),
    label: isOpp ? "Recovered amount" : "Realized savings",
  });
  if (decision.mode === "none") return decision;

  const entityType = isOpp ? "Opportunity" : "Inefficiency";
  const row = isOpp
    ? await prisma.opportunity.findFirst({ where: { id: opts.entityId, organizationId: opts.organizationId }, select: { id: true, title: true, status: true, potentialAmount: true } })
    : await prisma.inefficiency.findFirst({ where: { id: opts.entityId, organizationId: opts.organizationId }, select: { id: true, title: true, status: true, projectedSavings: true } });
  if (!row) throw new Error("Item not found in this organization");

  if (decision.mode === "ignored_no_rights" || decision.mode === "blocked_limit") {
    await writeAudit({
      organizationId: opts.organizationId,
      actorId: opts.actorId,
      action: isOpp ? "opportunity.won_back_on_create_rejected" : "inefficiency.won_back_on_create_rejected",
      entityType,
      entityId: row.id,
      metadata: { submitted: decision.submitted, reason: decision.mode, role: opts.role ?? null },
    });
    return decision;
  }

  if (decision.mode === "queued_approval") {
    const approval = await prisma.approvalRequest.create({
      data: {
        organizationId: opts.organizationId,
        type: isOpp ? "HIGH_VALUE_RECOVERY" : "HIGH_VALUE_SAVINGS",
        title: `${isOpp ? "High-value recovery" : "High-value savings"}: ${row.title}`,
        description: `Amount ${decision.submitted} entered when the item was created is at or above the approval threshold (${settings.requireApprovalAbove}); queued for approval.`,
        status: "PENDING",
        payloadJson: JSON.stringify(
          isOpp
            ? { opportunityId: row.id, recoveredAmount: decision.submitted, verified: false, executesExternally: false, enteredAtCreation: true }
            : { inefficiencyId: row.id, realizedSavings: decision.submitted, verified: false, executesExternally: false, enteredAtCreation: true }
        ),
        requestedById: opts.actorId,
      },
    });
    if (settings.notifyHighValue) {
      await notifyOrgManagers({
        organizationId: opts.organizationId,
        title: isOpp ? "High-value recovery needs approval" : "High-value savings needs approval",
        body: `${row.title}: ${decision.submitted}`,
        href: "/app/approvals",
      });
    }
    await writeAudit({
      organizationId: opts.organizationId,
      actorId: opts.actorId,
      action: isOpp ? "opportunity.recovery_queued" : "inefficiency.savings_queued",
      entityType: "ApprovalRequest",
      entityId: approval.id,
      metadata: { submitted: decision.submitted, enteredAtCreation: true },
    });
    return { ...decision, approvalId: approval.id };
  }

  // Within limits — same effect as recordRecovery / recordSavings.
  const amount = decision.amount;
  let toStatus: string;
  if (isOpp) {
    const potential = (row as { potentialAmount: number }).potentialAmount;
    toStatus = amount < potential ? "PARTIALLY_RECOVERED" : "RECOVERED";
    await prisma.opportunity.update({
      where: { id: row.id },
      data: { recoveredAmount: amount, status: toStatus, recoveredAt: new Date() },
    });
  } else {
    toStatus = "REALIZED";
    await prisma.inefficiency.update({
      where: { id: row.id },
      data: { realizedSavings: amount, recoveredAnnual: amount, status: toStatus, resolvedAt: new Date() },
    });
  }
  await recordStatusChange({
    organizationId: opts.organizationId,
    entityType,
    entityId: row.id,
    fromStatus: row.status,
    toStatus,
    actorId: opts.actorId,
    note: isOpp ? `Recorded recovery ${amount} when the item was created` : `Recorded savings ${amount} when the item was created`,
  });
  await writeAudit({
    organizationId: opts.organizationId,
    actorId: opts.actorId,
    action: isOpp ? "opportunity.recovery_recorded" : "inefficiency.savings_recorded",
    entityType,
    entityId: row.id,
    metadata: { [isOpp ? "recovered" : "realized"]: amount, verified: false, enteredAtCreation: true },
  });
  if (settings.notifyRecovery) {
    await notifyOrgManagers({
      organizationId: opts.organizationId,
      title: `${isOpp ? "Recovery" : "Savings"} recorded: ${row.title}`,
      body: `Amount ${amount}`,
      href: isOpp ? `/app/revenue/${row.id}` : `/app/operations/${row.id}`,
    });
  }
  return { ...decision, toStatus };
}
