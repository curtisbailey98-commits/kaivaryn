/**
 * Tenant-scoped voice agent + call access. Every function takes the session's tenant and role; there is
 * no parameter that lets a caller name another tenant. Status transitions are explicit and audited;
 * activation needs an approved config, a provisioned assistant, an ADMIN+ role, AND explicit confirmation.
 */
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { notifyOrgManagers } from "@/lib/notifications";
import { assertVoice, canVoice } from "./permissions";
import { sanitizeToolMap, defaultToolMap, type ActionLevel } from "./action-levels";
import { generateConfig, safeAgentName, type Questionnaire } from "./generator";
import { buildClientAgentPrompt } from "./prompts";
import type { AgentStatus } from "./constants";

export type VoiceCtx = { tenantId: string; userId: string; role: string };

export class VoiceFlowError extends Error {}

const TRANSITIONS: Record<string, AgentStatus[]> = {
  submit: ["draft", "generated", "testing"],
  test: ["draft", "generated", "in_review", "testing", "approved"],
  approve: ["in_review", "testing"],
  activate: ["approved"],
  pause: ["active"],
  resume_review: ["paused"],
};

export async function getTenantClientAgent(tenantId: string) {
  return prisma.voiceAgent.findFirst({ where: { tenantId, kind: "CLIENT" }, orderBy: { createdAt: "asc" } });
}

export async function listAgentsForTenant(ctx: VoiceCtx) {
  assertVoice(ctx.role, "voice.agent.view");
  return prisma.voiceAgent.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, kind: true, status: true, role: true, tone: true, voice: true, origin: true, provisionedAt: true, activatedAt: true, approvedAt: true, updatedAt: true },
  });
}

export type AgentFormInput = {
  name: string;
  voice?: string;
  tone?: string;
  greeting?: string;
  role?: string;
  responsibilities?: string[];
  hours?: string;
  afterHoursBehavior?: string;
  escalationRules?: string[];
  approvedKnowledge?: string;
  phoneConfig?: { wantsNumber?: boolean; forwardTo?: string; areaCode?: string };
  allowedTools?: Record<string, string>;
  systems?: string[];
};

const lines = (a: string[] | undefined) => (a || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 25).map((s) => s.slice(0, 300));

async function companyName(tenantId: string) {
  return (await prisma.organization.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } })).name;
}

function assertEditable(status: string) {
  if (status === "active") throw new VoiceFlowError("Pause the agent before editing its live configuration.");
}

/** Option 1 — "I'll configure it myself". Saves a draft; edits after approval go back to review. */
export async function saveSelfConfig(ctx: VoiceCtx, input: AgentFormInput) {
  assertVoice(ctx.role, "voice.agent.edit");
  const company = await companyName(ctx.tenantId);
  const existing = await getTenantClientAgent(ctx.tenantId);
  if (existing) assertEditable(existing.status);
  const tools = sanitizeToolMap(input.allowedTools && Object.keys(input.allowedTools).length ? input.allowedTools : defaultToolMap());
  const name = safeAgentName(input.name, company);
  const data = {
    name,
    voice: (input.voice || "Layla").slice(0, 40),
    tone: input.tone?.slice(0, 200) || null,
    greeting: input.greeting?.slice(0, 400) || null,
    role: input.role?.slice(0, 300) || null,
    responsibilitiesJson: JSON.stringify(lines(input.responsibilities)),
    hoursJson: input.hours?.slice(0, 300) || null,
    afterHoursBehavior: input.afterHoursBehavior?.slice(0, 500) || null,
    escalationRulesJson: JSON.stringify(lines(input.escalationRules)),
    approvedKnowledge: input.approvedKnowledge?.slice(0, 6000) || null,
    phoneConfigJson: JSON.stringify({ wantsNumber: Boolean(input.phoneConfig?.wantsNumber), forwardTo: (input.phoneConfig?.forwardTo || "").replace(/[^\d+() -]/g, "").slice(0, 32), areaCode: (input.phoneConfig?.areaCode || "").replace(/\D/g, "").slice(0, 3), state: "not_assigned" }),
    allowedToolsJson: JSON.stringify(tools),
    systemsJson: JSON.stringify(Array.from(new Set(input.systems || [])).slice(0, 40)),
    origin: "SELF_CONFIGURED",
  };
  const prompt = buildClientAgentPrompt({ companyName: company, name, role: data.role, tone: data.tone, greeting: data.greeting, responsibilities: JSON.parse(data.responsibilitiesJson), hours: data.hoursJson, afterHoursBehavior: data.afterHoursBehavior, escalationRules: JSON.parse(data.escalationRulesJson), approvedKnowledge: data.approvedKnowledge, tools });
  const nextStatus: AgentStatus = existing && ["approved", "testing", "in_review", "paused"].includes(existing.status) ? "in_review" : "draft";
  const row = existing
    ? await prisma.voiceAgent.update({ where: { id: existing.id }, data: { ...data, systemPrompt: prompt, status: nextStatus, approvedAt: nextStatus === "in_review" ? null : existing.approvedAt, approvedById: nextStatus === "in_review" ? null : existing.approvedById } })
    : await prisma.voiceAgent.create({ data: { ...data, systemPrompt: prompt, tenantId: ctx.tenantId, kind: "CLIENT", routing: "FIXED", status: "draft", createdById: ctx.userId } });
  await event(ctx, row.id, existing ? "agent.updated" : "agent.created", { origin: "SELF_CONFIGURED", status: row.status });
  return row;
}

/** Option 2 — "Let Kaivaryn build it for me". Deterministic recommended config; status "generated". */
export async function generateFromQuestionnaire(ctx: VoiceCtx, q: Omit<Questionnaire, "companyName">) {
  assertVoice(ctx.role, "voice.agent.edit");
  const company = await companyName(ctx.tenantId);
  const existing = await getTenantClientAgent(ctx.tenantId);
  if (existing) assertEditable(existing.status);
  const g = generateConfig({ ...q, companyName: company });
  const data = {
    name: g.name,
    voice: g.voice,
    tone: g.tone,
    greeting: g.greeting,
    role: g.role,
    responsibilitiesJson: JSON.stringify(g.responsibilities),
    hoursJson: g.hours,
    afterHoursBehavior: g.afterHoursBehavior,
    escalationRulesJson: JSON.stringify(g.escalationRules),
    approvedKnowledge: g.approvedKnowledge || null,
    allowedToolsJson: JSON.stringify(g.allowedTools),
    systemsJson: JSON.stringify(g.systems),
    questionnaireJson: JSON.stringify(q),
    systemPrompt: g.systemPrompt,
    origin: "KAIVARYN_BUILT",
    status: "generated",
    approvedAt: null,
    approvedById: null,
    phoneConfigJson: JSON.stringify({ wantsNumber: false, state: "not_assigned" }),
  };
  const row = existing
    ? await prisma.voiceAgent.update({ where: { id: existing.id }, data })
    : await prisma.voiceAgent.create({ data: { ...data, tenantId: ctx.tenantId, kind: "CLIENT", routing: "FIXED", createdById: ctx.userId } });
  await event(ctx, row.id, "agent.generated", { origin: "KAIVARYN_BUILT" });
  return row;
}

async function event(ctx: VoiceCtx, agentId: string, type: string, detail: Record<string, unknown>) {
  await prisma.voiceEvent.create({ data: { tenantId: ctx.tenantId, voiceAgentId: agentId, type, actorId: ctx.userId, detailJson: JSON.stringify(detail) } });
  await writeAudit({ organizationId: ctx.tenantId, actorId: ctx.userId, action: `voice.${type}`, entityType: "VoiceAgent", entityId: agentId, metadata: detail });
}

async function ownAgent(ctx: VoiceCtx, agentId: string) {
  const a = await prisma.voiceAgent.findFirst({ where: { id: agentId, tenantId: ctx.tenantId, kind: "CLIENT" } });
  if (!a) throw new VoiceFlowError("Agent not found.");
  return a;
}

function guard(action: keyof typeof TRANSITIONS, status: string) {
  if (!(TRANSITIONS[action] as string[]).includes(status)) throw new VoiceFlowError(`Can't ${action.replace("_", " ")} from "${status}".`);
}

/** Submit for approval → in_review + a VOICE_AGENT_ACTIVATION request in the existing Approvals queue. */
export async function submitForReview(ctx: VoiceCtx, agentId: string) {
  assertVoice(ctx.role, "voice.agent.edit");
  const a = await ownAgent(ctx, agentId);
  guard("submit", a.status);
  const pending = await prisma.approvalRequest.findFirst({ where: { organizationId: ctx.tenantId, type: "VOICE_AGENT_ACTIVATION", status: "PENDING", payloadJson: { contains: a.id } } });
  if (!pending) {
    await prisma.approvalRequest.create({ data: { organizationId: ctx.tenantId, type: "VOICE_AGENT_ACTIVATION", title: `Approve voice agent "${a.name}"`, description: "Review the voice agent's configuration. Approving does NOT put it live — activation is a separate, explicit step.", requestedById: ctx.userId, payloadJson: JSON.stringify({ voiceAgentId: a.id }) } });
    await notifyOrgManagers({ organizationId: ctx.tenantId, title: `Voice agent "${a.name}" is ready for review`, href: "/app/voice-agent" });
  }
  const row = await prisma.voiceAgent.update({ where: { id: a.id }, data: { status: a.status === "testing" ? "testing" : "in_review" } });
  await event(ctx, a.id, "agent.submitted", { from: a.status });
  return row;
}

export async function approveAgent(ctx: VoiceCtx, agentId: string) {
  assertVoice(ctx.role, "voice.agent.approve");
  const a = await ownAgent(ctx, agentId);
  guard("approve", a.status);
  const row = await prisma.voiceAgent.update({ where: { id: a.id }, data: { status: "approved", approvedById: ctx.userId, approvedAt: new Date() } });
  await prisma.approvalRequest.updateMany({ where: { organizationId: ctx.tenantId, type: "VOICE_AGENT_ACTIVATION", status: "PENDING", payloadJson: { contains: a.id } }, data: { status: "APPROVED", decidedById: ctx.userId, decidedAt: new Date(), decisionNote: "Configuration approved. Not live until explicitly activated." } });
  await event(ctx, a.id, "agent.approved", { from: a.status });
  return row;
}

/** Only path to "active". Never called implicitly. */
export async function activateAgent(ctx: VoiceCtx, agentId: string, opts: { confirm: boolean }) {
  assertVoice(ctx.role, "voice.agent.activate");
  const a = await ownAgent(ctx, agentId);
  guard("activate", a.status);
  if (opts.confirm !== true) throw new VoiceFlowError("Activation needs your explicit confirmation.");
  if (!a.providerAssistantId) throw new VoiceFlowError("Create and test the assistant before activating.");
  if (!a.approvedAt) throw new VoiceFlowError("The configuration must be approved first.");
  const row = await prisma.voiceAgent.update({ where: { id: a.id }, data: { status: "active", activatedById: ctx.userId, activatedAt: new Date() } });
  await event(ctx, a.id, "agent.activated", { confirmed: true });
  return row;
}

export async function pauseAgent(ctx: VoiceCtx, agentId: string) {
  assertVoice(ctx.role, "voice.agent.activate");
  const a = await ownAgent(ctx, agentId);
  guard("pause", a.status);
  const row = await prisma.voiceAgent.update({ where: { id: a.id }, data: { status: "paused" } });
  await event(ctx, a.id, "agent.paused", {});
  return row;
}

export async function setToolLevels(ctx: VoiceCtx, agentId: string, levels: Record<string, string>) {
  assertVoice(ctx.role, "voice.agent.edit");
  const a = await ownAgent(ctx, agentId);
  assertEditable(a.status);
  const tools: Record<string, ActionLevel> = sanitizeToolMap(levels);
  return prisma.voiceAgent.update({ where: { id: a.id }, data: { allowedToolsJson: JSON.stringify(tools), status: ["approved", "testing"].includes(a.status) ? "in_review" : a.status } });
}

// ───────────── Calls ─────────────

export async function listCallsForTenant(ctx: VoiceCtx, opts?: { take?: number; agentId?: string }) {
  assertVoice(ctx.role, "voice.calls.list");
  const rows = await prisma.voiceCall.findMany({
    where: { tenantId: ctx.tenantId, ...(opts?.agentId ? { voiceAgentId: opts.agentId } : {}) },
    orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
    take: Math.min(opts?.take ?? 100, 200),
    select: { id: true, providerCallId: true, channel: true, assistantName: true, callerName: true, callerNumber: true, callerEmail: true, company: true, startedAt: true, endedAt: true, durationSeconds: true, summary: true, intent: true, qualification: true, productFit: true, nextStep: true, demoStatus: true, followUp: true, outcome: true, analysisSource: true, handoffRequested: true, linkedAccountId: true, linkedDemoRequestId: true, linkedLeadId: true, linkedCustomerId: true, costUsd: true, status: true, source: true },
  });
  const cost = canVoice(ctx.role, "voice.cost.view");
  return rows.map((r) => ({ ...r, costUsd: cost ? r.costUsd : null, callerNumber: maskNumber(r.callerNumber, canVoice(ctx.role, "voice.calls.transcript")) }));
}

export function maskNumber(n: string | null, full: boolean) {
  if (!n) return null;
  if (full) return n;
  const d = n.replace(/\D/g, "");
  return d.length >= 4 ? `•••-${d.slice(-4)}` : "•••";
}

export async function getCallForTenant(ctx: VoiceCtx, id: string) {
  assertVoice(ctx.role, "voice.calls.list");
  const row = await prisma.voiceCall.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!row) return null;
  const transcriptAllowed = canVoice(ctx.role, "voice.calls.transcript");
  return {
    ...row,
    transcript: transcriptAllowed ? row.transcript : null,
    transcriptJson: transcriptAllowed ? row.transcriptJson : null,
    transcriptHidden: !transcriptAllowed,
    callerNumber: maskNumber(row.callerNumber, transcriptAllowed),
    costUsd: canVoice(ctx.role, "voice.cost.view") ? row.costUsd : null,
  };
}
