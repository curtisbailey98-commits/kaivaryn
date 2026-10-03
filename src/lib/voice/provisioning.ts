/**
 * Provider provisioning. Kaivaryn only ever CREATES assistants (one per client tenant, plus its own
 * web-only assistants) and only updates assistants recorded in voice_agents as Kaivaryn-created.
 * Viki (phone + n8n) is never touched. Every created assistant posts to Kaivaryn's webhook with the
 * shared secret header, so tenant routing and signature checks apply.
 */
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { createAssistant, updateOwnedAssistant, type FetchLike } from "./vapi-client";
import { protectedAssistantIds, WEB_CALL_MAX_SECONDS } from "./constants";
import { webhookSecret } from "./security";
import { buildClientAgentPrompt } from "./prompts";
import { sanitizeToolMap, toolByKey, systemStateFromIntegration, systemUsable } from "./action-levels";
import { clientToolDefinitions } from "./tools";

export function webhookUrl(): string {
  const base = (process.env.PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://kaivaryn.onrender.com").replace(/\/$/, "");
  return `${base}/api/voice/webhook`;
}

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    callerName: { type: "string" },
    company: { type: "string" },
    email: { type: "string" },
    intent: { type: "string", description: "One short phrase: why they called" },
    productFit: { type: "string", enum: ["REVENUE_RECOVERY", "OPERATIONS_EFFICIENCY", "BOTH", "UNCLEAR"] },
    qualification: { type: "string", enum: ["QUALIFIED", "NEEDS_REVIEW", "NOT_QUALIFIED", "UNKNOWN"] },
    nextStep: { type: "string" },
    demoRequested: { type: "boolean" },
    handoffRequested: { type: "boolean" },
    followUp: { type: "string" },
    outcome: { type: "string" },
  },
};

export function baseAssistantPayload(opts: {
  name: string;
  systemPrompt: string;
  firstMessage: string;
  voiceId?: string;
  voiceSpeed?: number;
  tools?: unknown[];
  analysis?: boolean;
  maxDurationSeconds?: number;
  metadata?: Record<string, string>;
}) {
  const secret = webhookSecret();
  if (!secret) throw new Error("VAPI_WEBHOOK_SECRET is not configured");
  return {
    name: opts.name.slice(0, 40),
    firstMessage: opts.firstMessage.slice(0, 400),
    firstMessageMode: "assistant-speaks-first",
    // Same model + voice family as Viki, so the experience matches without touching Viki.
    model: { provider: "openai", model: "gpt-5-mini", messages: [{ role: "system", content: opts.systemPrompt }], ...(opts.tools?.length ? { tools: opts.tools } : {}) },
    voice: { provider: "vapi", voiceId: opts.voiceId || "Layla", speed: opts.voiceSpeed ?? 1.1 },
    transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
    maxDurationSeconds: opts.maxDurationSeconds ?? WEB_CALL_MAX_SECONDS,
    silenceTimeoutSeconds: 30,
    serverMessages: ["end-of-call-report", "status-update", "tool-calls"],
    server: { url: webhookUrl(), timeoutSeconds: 20, headers: { "X-Vapi-Secret": secret } },
    ...(opts.analysis
      ? { analysisPlan: { summaryPlan: { enabled: true }, structuredDataPlan: { enabled: true, schema: ANALYSIS_SCHEMA } } }
      : {}),
    ...(opts.metadata ? { metadata: opts.metadata } : {}),
  };
}

/** Build the provider payload for a client agent from its stored config. */
export async function clientAssistantPayload(agentId: string) {
  const a = await prisma.voiceAgent.findUniqueOrThrow({ where: { id: agentId }, include: { tenant: { select: { name: true, id: true } } } });
  const tools = sanitizeToolMap(JSON.parse(a.allowedToolsJson || "{}"));
  const conns = await prisma.integrationConnection.findMany({ where: { organizationId: a.tenantId }, select: { provider: true, status: true } });
  const usable: Record<string, boolean> = {};
  for (const k of Object.keys(tools)) {
    const t = toolByKey(k);
    usable[k] = !t?.systems?.length || conns.some((c) => t.systems!.includes(c.provider) && systemUsable(systemStateFromIntegration(c.status, false)));
  }
  const prompt = buildClientAgentPrompt({
    companyName: a.tenant.name,
    name: a.name,
    role: a.role,
    tone: a.tone,
    greeting: a.greeting,
    responsibilities: JSON.parse(a.responsibilitiesJson || "[]"),
    hours: a.hoursJson,
    afterHoursBehavior: a.afterHoursBehavior,
    escalationRules: JSON.parse(a.escalationRulesJson || "[]"),
    approvedKnowledge: a.approvedKnowledge,
    tools,
    toolUsable: usable,
  });
  const payload = baseAssistantPayload({
    name: a.name,
    systemPrompt: prompt,
    firstMessage: a.greeting || `Thank you for calling ${a.tenant.name}. How can I help?`,
    voiceId: a.voice || "Layla",
    tools: clientToolDefinitions(tools),
    analysis: true,
    maxDurationSeconds: 900,
    metadata: { kaivarynTenant: a.tenantId, kaivarynAgent: a.id, kind: "client" },
  });
  return { agent: a, payload, prompt };
}

/**
 * Create (or update, if Kaivaryn already created it) the tenant's provider assistant.
 * Phone numbers are never attached here; that's a separate, Kaivaryn-assisted step.
 */
export async function provisionClientAgent(agentId: string, actorId: string, f?: FetchLike) {
  const { agent, payload, prompt } = await clientAssistantPayload(agentId);
  if (agent.kind !== "CLIENT") throw new Error("Only client agents are provisioned here");
  try {
    let providerId = agent.providerAssistantId;
    if (providerId) {
      if (protectedAssistantIds().includes(providerId)) throw new Error("Refusing to modify a protected assistant");
      await updateOwnedAssistant(providerId, payload, true, f);
    } else {
      const created = await createAssistant(payload, f);
      providerId = created.id;
    }
    const row = await prisma.voiceAgent.update({ where: { id: agent.id }, data: { providerAssistantId: providerId, provisionedAt: new Date(), provisionError: null, systemPrompt: prompt, status: agent.status === "active" || agent.status === "approved" ? agent.status : "testing" } });
    await prisma.voiceEvent.create({ data: { tenantId: agent.tenantId, voiceAgentId: agent.id, type: agent.providerAssistantId ? "agent.provider_updated" : "agent.provisioned", actorId, detailJson: JSON.stringify({ name: agent.name }) } });
    await writeAudit({ organizationId: agent.tenantId, actorId, action: "voice.agent.provisioned", entityType: "VoiceAgent", entityId: agent.id, metadata: { name: agent.name } });
    return { ok: true as const, agent: row };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    await prisma.voiceAgent.update({ where: { id: agent.id }, data: { provisionError: msg } });
    return { ok: false as const, error: msg };
  }
}
