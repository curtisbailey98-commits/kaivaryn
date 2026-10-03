/**
 * Tool-call routing. Every tool runs inside a resolved tenant context (see tenancy.ts) and is checked
 * against an action level and the caller's role. Workspace tools require a verified signed session —
 * the tenant comes from the token, never from tool arguments. Consequential actions only ever create
 * ApprovalRequests in the existing approvals queue; nothing is executed in an external system.
 */
import { prisma } from "@/lib/prisma";
import { can, roleRank } from "@/lib/rbac";
import type { Permission } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { notifyOrgManagers } from "@/lib/notifications";
import { sanitizeToolMap, toolByKey, systemUsable, systemStateFromIntegration, type ActionLevel } from "./action-levels";
import { currentUsage, USAGE_STATE_LABEL } from "./usage";

export type ToolCtx = {
  tenantId: string;
  agent: { id: string; kind: string; routing: string; name: string; status: string };
  providerCallId: string | null;
  /** Present only for SIGNED_SESSION (workspace) calls. */
  session?: { userId: string; role: string };
};

export type ToolResult = { ok: boolean; level: ActionLevel; result: string };

type WorkspaceTool = { level: ActionLevel; permission: Permission; run: (ctx: ToolCtx & { session: { userId: string; role: string } }, args: Record<string, unknown>) => Promise<string> };

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const OPEN_OPP = { notIn: ["RECOVERED", "VERIFIED", "CLOSED_WON", "CLOSED_LOST", "DISMISSED", "REJECTED"] };
const OPEN_INEFF = { notIn: ["RESOLVED", "VERIFIED", "DISMISSED", "REJECTED", "CLOSED"] };

async function entitled(tenantId: string, product: string) {
  const e = await prisma.entitlement.findUnique({ where: { organizationId_product: { organizationId: tenantId, product } } });
  return Boolean(e?.active);
}

export const WORKSPACE_TOOLS: Record<string, WorkspaceTool> = {
  get_workspace_overview: {
    level: "READ",
    permission: "read",
    async run(ctx) {
      const t = ctx.tenantId;
      const [rr, oe] = [await entitled(t, "REVENUE_RECOVERY"), await entitled(t, "OPERATIONS_EFFICIENCY")];
      const parts: string[] = [];
      if (rr) {
        const a = await prisma.opportunity.aggregate({ where: { organizationId: t, status: OPEN_OPP }, _count: { _all: true }, _sum: { estimatedAmount: true } });
        const r = await prisma.opportunity.aggregate({ where: { organizationId: t }, _sum: { recoveredAmount: true, verifiedAmount: true } });
        parts.push(`Revenue Recovery: ${a._count._all} open opportunities, ESTIMATED ${money(a._sum.estimatedAmount ?? 0)} (estimate, not realized). REALIZED recovered ${money(r._sum.recoveredAmount ?? 0)}, of which VERIFIED ${money(r._sum.verifiedAmount ?? 0)}.`);
      } else parts.push("Revenue Recovery: not enabled for this workspace.");
      if (oe) {
        const a = await prisma.inefficiency.aggregate({ where: { organizationId: t, status: OPEN_INEFF }, _count: { _all: true }, _sum: { projectedSavings: true } });
        const r = await prisma.inefficiency.aggregate({ where: { organizationId: t }, _sum: { realizedSavings: true } });
        parts.push(`Operations Efficiency: ${a._count._all} open inefficiencies, PROJECTED savings ${money(a._sum.projectedSavings ?? 0)} (estimate). REALIZED savings ${money(r._sum.realizedSavings ?? 0)}.`);
      } else parts.push("Operations Efficiency: not enabled for this workspace.");
      const pending = await prisma.approvalRequest.count({ where: { organizationId: t, status: "PENDING" } });
      parts.push(`Approvals pending: ${pending}.`);
      return parts.join(" ");
    },
  },
  get_top_opportunities: {
    level: "READ",
    permission: "read",
    async run(ctx) {
      if (!(await entitled(ctx.tenantId, "REVENUE_RECOVERY"))) return "unavailable: Revenue Recovery is not enabled for this workspace.";
      const rows = await prisma.opportunity.findMany({ where: { organizationId: ctx.tenantId, status: OPEN_OPP }, orderBy: [{ estimatedAmount: "desc" }], take: 5, select: { title: true, status: true, priority: true, estimatedAmount: true } });
      if (!rows.length) return "No open opportunities in this workspace.";
      return rows.map((r, i) => `${i + 1}. ${r.title} — ${r.priority.toLowerCase()} priority, status ${r.status.toLowerCase()}, ESTIMATED ${money(r.estimatedAmount)}`).join("\n");
    },
  },
  get_top_inefficiencies: {
    level: "READ",
    permission: "read",
    async run(ctx) {
      if (!(await entitled(ctx.tenantId, "OPERATIONS_EFFICIENCY"))) return "unavailable: Operations Efficiency is not enabled for this workspace.";
      const rows = await prisma.inefficiency.findMany({ where: { organizationId: ctx.tenantId, status: OPEN_INEFF }, orderBy: [{ projectedSavings: "desc" }], take: 5, select: { title: true, status: true, priority: true, projectedSavings: true } });
      if (!rows.length) return "No open inefficiencies in this workspace.";
      return rows.map((r, i) => `${i + 1}. ${r.title} — ${r.priority.toLowerCase()} priority, status ${r.status.toLowerCase()}, PROJECTED savings ${money(r.projectedSavings)}`).join("\n");
    },
  },
  list_pending_approvals: {
    level: "READ",
    permission: "read",
    async run(ctx) {
      const rows = await prisma.approvalRequest.findMany({ where: { organizationId: ctx.tenantId, status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 5, select: { title: true, type: true, createdAt: true } });
      if (!rows.length) return "No approvals are pending.";
      return rows.map((r, i) => `${i + 1}. ${r.title} (${r.type.toLowerCase().replace(/_/g, " ")}, filed ${r.createdAt.toISOString().slice(0, 10)})`).join("\n");
    },
  },
  get_voice_usage: {
    level: "READ",
    permission: "read",
    async run(ctx) {
      const u = await currentUsage(ctx.tenantId);
      const allowance = u.includedMinutes ? `${u.minutes} of ${u.includedMinutes} included minutes used (${u.percentUsed ?? 0}%).` : `${u.minutes} minutes used; an included allowance hasn't been set yet.`;
      return `Included Voice Usage for ${u.period}: ${u.calls} calls, ${allowance} Status: ${USAGE_STATE_LABEL[u.overageState as keyof typeof USAGE_STATE_LABEL] ?? u.overageState}.`;
    },
  },
  request_approval: {
    level: "REQUIRE_APPROVAL",
    permission: "write",
    async run(ctx, args) {
      const title = String(args.title || "").trim().slice(0, 160);
      const detail = String(args.detail || "").trim().slice(0, 1000);
      if (!title) return "denied: a short title for the request is required.";
      const appr = await prisma.approvalRequest.create({
        data: { organizationId: ctx.tenantId, type: "VOICE_REQUEST", title: `Voice request: ${title}`, description: `${detail}\n\nFiled by voice through Kaivaryn's in-app assistant. Approving records the decision only; nothing is executed automatically.`.trim(), requestedById: ctx.session.userId, payloadJson: JSON.stringify({ source: "voice", providerCallId: ctx.providerCallId }) },
      });
      await writeAudit({ organizationId: ctx.tenantId, actorId: ctx.session.userId, action: "voice.approval_requested", entityType: "ApprovalRequest", entityId: appr.id, metadata: { title } });
      return `Filed in the Approvals queue as pending: "${title}". It has NOT been done — a person with approval rights must decide.`;
    },
  },
  request_human_followup: {
    level: "DRAFT",
    permission: "read",
    async run(ctx, args) {
      const reason = String(args.reason || "Asked for a person").slice(0, 300);
      await prisma.task.create({ data: { organizationId: ctx.tenantId, title: `Voice follow-up: ${reason.slice(0, 120)}`, body: reason, createdById: ctx.session.userId, entityType: "VoiceCall", entityId: ctx.providerCallId } });
      return "A follow-up task was created for your team.";
    },
  },
};

/** Vapi function-tool definitions for the in-app assistant. */
export function workspaceToolDefinitions() {
  const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: "function", async: false, function: { name, description, parameters: { type: "object", properties, required } } });
  return [
    fn("get_workspace_overview", "Current Revenue Recovery and Operations Efficiency totals (estimated vs realized) and pending approvals for the user's workspace."),
    fn("get_top_opportunities", "Top open revenue recovery opportunities by estimated value."),
    fn("get_top_inefficiencies", "Top open operational inefficiencies by projected savings."),
    fn("list_pending_approvals", "Approvals waiting for a decision."),
    fn("get_voice_usage", "This month's Included Voice Usage."),
    fn("request_approval", "File a request in the Approvals queue for any consequential action. Never executes anything.", { title: { type: "string", description: "Short title of what should be done" }, detail: { type: "string", description: "Why, and any specifics the user gave" } }, ["title"]),
    fn("request_human_followup", "Create a follow-up task for a person on the user's team.", { reason: { type: "string" } }, ["reason"]),
  ];
}

/** Vapi function-tool definitions for a client agent, from its sanitized tool map. */
export function clientToolDefinitions(toolMap: Record<string, ActionLevel>) {
  const props = { callerName: { type: "string" }, callbackNumber: { type: "string" }, details: { type: "string" } };
  return Object.keys(sanitizeToolMap(toolMap))
    .filter((k) => k !== "answer_faq")
    .map((k) => {
      const t = toolByKey(k)!;
      return { type: "function", async: false, function: { name: k, description: `${t.label}. ${t.description}`, parameters: { type: "object", properties: props, required: ["details"] } } };
    });
}

async function requesterFor(tenantId: string, agentId: string): Promise<string | null> {
  const a = await prisma.voiceAgent.findUnique({ where: { id: agentId }, select: { activatedById: true, approvedById: true, createdById: true } });
  const id = a?.activatedById || a?.approvedById || a?.createdById;
  if (id) return id;
  const owner = await prisma.membership.findFirst({ where: { organizationId: tenantId, role: { in: ["OWNER", "ADMIN"] } }, orderBy: { createdAt: "asc" }, select: { userId: true } });
  return owner?.userId ?? null;
}

async function runClientTool(ctx: ToolCtx, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const agent = await prisma.voiceAgent.findUnique({ where: { id: ctx.agent.id }, select: { allowedToolsJson: true, systemsJson: true, status: true } });
  const map = sanitizeToolMap(JSON.parse(agent?.allowedToolsJson || "{}"));
  const tool = toolByKey(name);
  if (!tool || !map[name]) return { ok: false, level: "READ", result: "denied: this assistant is not configured for that. Offer to take a message for the team." };
  const level = map[name]!;
  const who = String(args.callerName || "Caller").slice(0, 120);
  const number = String(args.callbackNumber || "").replace(/[^\d+() -]/g, "").slice(0, 32);
  const details = String(args.details || "").slice(0, 1000);
  if (tool.systems?.length && level === "READ") {
    const conns = await prisma.integrationConnection.findMany({ where: { organizationId: ctx.tenantId, provider: { in: tool.systems } }, select: { status: true } });
    if (!conns.some((c) => systemUsable(systemStateFromIntegration(c.status, false)))) return { ok: false, level, result: "unavailable: that system isn't connected yet. Take the caller's details and offer a callback." };
    return { ok: false, level, result: "unavailable: live lookups aren't enabled for this assistant yet. Take the caller's details and offer a callback." };
  }
  const requester = await requesterFor(ctx.tenantId, ctx.agent.id);
  if (!requester) return { ok: false, level, result: "unavailable: no team member is set up to receive this. Apologize and ask them to call back during business hours." };
  if (level === "REQUIRE_APPROVAL") {
    await prisma.approvalRequest.create({ data: { organizationId: ctx.tenantId, type: "VOICE_REQUEST", title: `${tool.label} requested by phone — ${who}`, description: `${details}\nCallback: ${number || "not given"}\nCaptured by ${ctx.agent.name}. Nothing has been done; a person must approve.`, requestedById: requester, payloadJson: JSON.stringify({ source: "voice", tool: name, providerCallId: ctx.providerCallId }) } });
    return { ok: true, level, result: "Recorded for approval. Tell the caller a team member must review this and will follow up; do not promise the outcome." };
  }
  await prisma.task.create({ data: { organizationId: ctx.tenantId, title: `${tool.label}: ${who}${number ? ` (${number})` : ""}`.slice(0, 190), body: details, createdById: requester, entityType: "VoiceCall", entityId: ctx.providerCallId } });
  if (name === "transfer_to_human") {
    await notifyOrgManagers({ organizationId: ctx.tenantId, title: `Caller asked for a person — ${who}`, body: details.slice(0, 200), href: "/app/calls" });
    return { ok: true, level, result: "The team has been notified. Tell the caller someone will call them back; do not promise a specific time." };
  }
  return { ok: true, level, result: "Saved for the team. Confirm the details back to the caller and say a person will follow up." };
}

export async function runTool(ctx: ToolCtx, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  let out: ToolResult;
  if (ctx.agent.routing === "SIGNED_SESSION") {
    const tool = WORKSPACE_TOOLS[name];
    if (!ctx.session) out = { ok: false, level: "READ", result: "denied: no verified workspace session for this call." };
    else if (!tool) out = { ok: false, level: "READ", result: "unavailable: that capability doesn't exist." };
    else if (!can(ctx.session.role, tool.permission) || roleRank(ctx.session.role) < 10) out = { ok: false, level: tool.level, result: `denied: your role (${ctx.session.role.toLowerCase()}) can't do that. A manager or owner can.` };
    else {
      try {
        out = { ok: true, level: tool.level, result: await tool.run({ ...ctx, session: ctx.session }, args) };
      } catch {
        out = { ok: false, level: tool.level, result: "unavailable: that information couldn't be retrieved right now." };
      }
    }
  } else if (ctx.agent.kind === "CLIENT") {
    if (ctx.agent.status !== "active" && ctx.agent.status !== "testing" && ctx.agent.status !== "approved") out = { ok: false, level: "READ", result: "unavailable: this assistant is not active." };
    else out = await runClientTool(ctx, name, args);
  } else {
    out = { ok: false, level: "READ", result: "unavailable: no tools are enabled for this assistant." };
  }
  await prisma.voiceEvent.create({
    data: { tenantId: ctx.tenantId, voiceAgentId: ctx.agent.id, providerCallId: ctx.providerCallId, type: out.ok ? "tool.executed" : "tool.denied", actorId: ctx.session?.userId ?? null, level: out.level, detailJson: JSON.stringify({ tool: name, outcome: out.result.slice(0, 160) }) },
  });
  return out;
}
