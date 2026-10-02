/**
 * Inbox — renovated from 720 SI Inbox (pending approvals, alerts, action requests,
 * standing-order failures, jobs) plus Kaivaryn notifications and briefings. Honest aggregation only.
 */
import { prisma } from "@/lib/prisma";
import type { OpCtx } from "./context";
import { safeJson } from "./context";

export type InboxItemType = "APPROVAL" | "NOTIFICATION" | "TASK" | "RUN" | "STANDING_FAILURE" | "BRIEFING";
export type InboxItem = { type: InboxItemType; id: string; title: string; detail?: string; href: string; createdAt: Date; urgent?: boolean };

export async function getInbox(ctx: OpCtx, limit = 60) {
  const orgId = ctx.organizationId;
  const [approvals, notes, tasks, runs, failures, briefings] = await Promise.all([
    prisma.approvalRequest.findMany({ where: { organizationId: orgId, status: "PENDING" }, orderBy: { createdAt: "desc" }, take: limit }),
    ctx.userId
      ? prisma.notification.findMany({ where: { organizationId: orgId, userId: ctx.userId, readAt: null }, orderBy: { createdAt: "desc" }, take: limit })
      : Promise.resolve([]),
    prisma.task.findMany({
      where: { organizationId: orgId, status: "OPEN", ...(ctx.userId ? { OR: [{ assigneeId: ctx.userId }, { assigneeId: null }] } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.opRun.findMany({ where: { organizationId: orgId, status: { in: ["FAILED", "WAITING_APPROVAL"] } }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.opStandingOrder.findMany({ where: { organizationId: orgId, enabled: true, lastStatus: "FAILED" }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.opBriefing.findMany({ where: { organizationId: orgId, readAt: null }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const items: InboxItem[] = [
    ...approvals.map((a) => ({
      type: "APPROVAL" as const,
      id: a.id,
      title: a.title,
      detail: `${a.type.replace(/_/g, " ").toLowerCase()}${a.needsIntegration ? ` · blocked on ${a.needsIntegration} (not connected)` : ""}`,
      href: "/app/approvals",
      createdAt: a.createdAt,
      urgent: true,
    })),
    ...notes.map((n) => ({ type: "NOTIFICATION" as const, id: n.id, title: n.title, detail: n.body ?? undefined, href: n.href || "/app/inbox", createdAt: n.createdAt })),
    ...tasks.map((t) => ({ type: "TASK" as const, id: t.id, title: t.title, detail: t.assigneeId ? "Assigned to you" : "Unassigned — needs an owner", href: "/app/action-center", createdAt: t.createdAt, urgent: !t.assigneeId })),
    ...runs.map((r) => ({
      type: "RUN" as const,
      id: r.id,
      title: r.status === "FAILED" ? `Run failed: ${r.title}` : `Run waiting on approval: ${r.title}`,
      detail: r.error ?? undefined,
      href: `/app/automations?run=${r.id}`,
      createdAt: r.updatedAt,
      urgent: r.status === "FAILED",
    })),
    ...failures.map((o) => ({
      type: "STANDING_FAILURE" as const,
      id: o.id,
      title: `Standing order failed: ${o.title}`,
      detail: safeJson<{ error?: string }>(o.lastResultJson, {}).error ?? undefined,
      href: "/app/automations",
      createdAt: o.lastRunAt ?? o.updatedAt,
      urgent: true,
    })),
    ...briefings.map((b) => ({ type: "BRIEFING" as const, id: b.id, title: b.title, detail: b.kind === "DIGEST" ? "Executive digest" : b.kind === "RECALL" ? "Recall" : "Status", href: `/app/inbox?briefing=${b.id}`, createdAt: b.createdAt })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    items: items.slice(0, limit),
    counts: {
      approvals: approvals.length,
      notifications: notes.length,
      tasks: tasks.length,
      runs: runs.length,
      standingFailures: failures.length,
      briefings: briefings.length,
      total: items.length,
    },
  };
}
