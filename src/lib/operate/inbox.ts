/**
 * Inbox — renovated from 720 SI Inbox (pending approvals, alerts, action requests,
 * standing-order failures, jobs) plus Kaivaryn notifications and briefings. Honest aggregation only.
 */
import { prisma } from "@/lib/prisma";
import type { OpCtx } from "./context";
import { safeJson } from "./context";

export type InboxItemType = "APPROVAL" | "NOTIFICATION" | "TASK" | "RUN" | "STANDING_FAILURE" | "BRIEFING";
export type InboxItem = { type: InboxItemType; id: string; title: string; detail?: string; href: string; createdAt: Date; urgent?: boolean };

/**
 * Single source of truth for "what is waiting on me": the sidebar Inbox badge, the home
 * "Needs your attention" strip, the operating-desk Inbox tile and the Inbox page tiles all
 * read these counts, so the numbers always agree. Same filters as getInbox() below.
 */
export async function getInboxCounts(organizationId: string, userId?: string | null) {
  const [approvals, notifications, tasks, runs, standingFailures, briefings] = await Promise.all([
    prisma.approvalRequest.count({ where: { organizationId, status: "PENDING" } }),
    userId ? prisma.notification.count({ where: { organizationId, userId, readAt: null } }) : Promise.resolve(0),
    prisma.task.count({
      where: { organizationId, status: "OPEN", ...(userId ? { OR: [{ assigneeId: userId }, { assigneeId: null }] } : {}) },
    }),
    prisma.opRun.count({ where: { organizationId, status: { in: ["FAILED", "WAITING_APPROVAL"] } } }),
    prisma.opStandingOrder.count({ where: { organizationId, enabled: true, lastStatus: "FAILED" } }),
    prisma.opBriefing.count({ where: { organizationId, readAt: null } }),
  ]);
  return {
    approvals,
    notifications,
    tasks,
    runs,
    standingFailures,
    briefings,
    total: approvals + notifications + tasks + runs + standingFailures + briefings,
  };
}
export type InboxCounts = Awaited<ReturnType<typeof getInboxCounts>>;

export async function getInbox(ctx: OpCtx, limit = 60) {
  const orgId = ctx.organizationId;
  const [counts, approvals, notes, tasks, runs, failures, briefings] = await Promise.all([
    getInboxCounts(orgId, ctx.userId),
    prisma.approvalRequest.findMany({ where: { organizationId: orgId, status: "PENDING" }, orderBy: { createdAt: "desc" }, take: limit }),
    ctx.userId
      ? prisma.notification.findMany({ where: { organizationId: orgId, userId: ctx.userId, readAt: null }, orderBy: { createdAt: "desc" }, take: limit })
      : Promise.resolve([]),
    prisma.task.findMany({
      where: { organizationId: orgId, status: "OPEN", ...(ctx.userId ? { OR: [{ assigneeId: ctx.userId }, { assigneeId: null }] } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.opRun.findMany({ where: { organizationId: orgId, status: { in: ["FAILED", "WAITING_APPROVAL"] } }, orderBy: { updatedAt: "desc" }, take: limit }),
    prisma.opStandingOrder.findMany({ where: { organizationId: orgId, enabled: true, lastStatus: "FAILED" }, orderBy: { updatedAt: "desc" }, take: limit }),
    prisma.opBriefing.findMany({ where: { organizationId: orgId, readAt: null }, orderBy: { createdAt: "desc" }, take: limit }),
  ]);

  const items: InboxItem[] = [
    ...approvals.map((a) => ({
      type: "APPROVAL" as const,
      id: a.id,
      title: a.title,
      detail: `${a.type.replace(/_/g, " ").toLowerCase()}${a.needsIntegration ? ` · waiting on ${a.needsIntegration.replace(/_/g, " ")} connection` : ""}`,
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
    // Exact counts (not capped by the list limit) — identical to the sidebar badge.
    counts,
  };
}
