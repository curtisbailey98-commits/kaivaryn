/**
 * Issues browser voice sessions. The browser gets: a short-lived public-scoped Vapi JWT pinned to ONE
 * assistant + Kaivaryn origins, the assistant id, and per-call variable values. For workspace calls it
 * also gets a signed kv1 token bound to (tenant, user, role, nonce, expiry) — the only thing the tool
 * endpoint trusts. The private key never leaves the server.
 */
import { prisma } from "@/lib/prisma";
import { mintPublicWebToken, allowedWebOrigins, vapiConfigured } from "./vapi-client";
import { KAIVARYN_WEB_ASSISTANT_ID, KAIVARYN_WORKSPACE_ASSISTANT_ID, TOOL_SESSION_TTL_SECONDS, ZOOM_DEMO_URL } from "./constants";
import { signSessionToken, webhookSecret } from "./security";
import { canVoice } from "./permissions";
import { humanizeLabel } from "@/lib/labels";

export type VoiceSession =
  | { available: true; token: string; expiresAt: number; assistantId: string; variableValues: Record<string, string>; demoUrl?: string }
  | { available: false; reason: string };

const hits = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

export function voiceReadiness() {
  return {
    provider: vapiConfigured(),
    webhookSecret: Boolean(webhookSecret()),
    webAssistant: Boolean(KAIVARYN_WEB_ASSISTANT_ID()),
    workspaceAssistant: Boolean(KAIVARYN_WORKSPACE_ASSISTANT_ID()),
  };
}

export async function publicSession(): Promise<VoiceSession> {
  const r = voiceReadiness();
  if (!r.provider || !r.webAssistant) return { available: false, reason: "Voice is not available right now." };
  try {
    const t = await mintPublicWebToken({ assistantIds: [KAIVARYN_WEB_ASSISTANT_ID()], origins: allowedWebOrigins() });
    return { available: true, token: t.token, expiresAt: t.expiresAt, assistantId: KAIVARYN_WEB_ASSISTANT_ID(), variableValues: { audience: "website visitor" }, demoUrl: ZOOM_DEMO_URL };
  } catch {
    return { available: false, reason: "Voice is not available right now." };
  }
}

/** Signed per-call token + server-side nonce record. The token is the ONLY tenant binding tools trust. */
export async function issueToolSession(ctx: { userId: string; tenantId: string; role: string }) {
  const signed = signSessionToken({ t: ctx.tenantId, u: ctx.userId, r: ctx.role });
  await prisma.voiceToolSession.create({ data: { tenantId: ctx.tenantId, userId: ctx.userId, role: ctx.role, nonce: signed.claims.n, expiresAt: new Date(signed.claims.exp * 1000) } });
  return signed;
}

export async function workspaceSession(ctx: { userId: string; userName?: string | null; tenantId: string; orgName: string; role: string }): Promise<VoiceSession> {
  const r = voiceReadiness();
  if (!r.provider || !r.workspaceAssistant || !r.webhookSecret) return { available: false, reason: "Voice is not available right now." };
  if (!canVoice(ctx.role, "voice.use")) return { available: false, reason: "Your role can't use voice in this workspace." };
  const signed = await issueToolSession(ctx);
  try {
    const t = await mintPublicWebToken({ assistantIds: [KAIVARYN_WORKSPACE_ASSISTANT_ID()], origins: allowedWebOrigins(), ttlSeconds: Math.min(600, TOOL_SESSION_TTL_SECONDS) });
    return {
      available: true,
      token: t.token,
      expiresAt: t.expiresAt,
      assistantId: KAIVARYN_WORKSPACE_ASSISTANT_ID(),
      variableValues: { kvToken: signed.token, userName: (ctx.userName || "there").slice(0, 60), userRole: humanizeLabel(ctx.role).toLowerCase(), orgName: ctx.orgName.slice(0, 80) },
    };
  } catch {
    return { available: false, reason: "Voice is not available right now." };
  }
}

/** Preview call to the tenant's OWN draft/test assistant (never another tenant's). */
export async function previewSession(ctx: { tenantId: string; role: string; agentId: string }): Promise<VoiceSession> {
  if (!canVoice(ctx.role, "voice.agent.test")) return { available: false, reason: "Your role can't run test calls." };
  if (!vapiConfigured()) return { available: false, reason: "Voice is not available right now." };
  const agent = await prisma.voiceAgent.findFirst({ where: { id: ctx.agentId, tenantId: ctx.tenantId, kind: "CLIENT" }, select: { providerAssistantId: true } });
  if (!agent) return { available: false, reason: "Agent not found." };
  if (!agent.providerAssistantId) return { available: false, reason: "Create the test assistant first." };
  try {
    const t = await mintPublicWebToken({ assistantIds: [agent.providerAssistantId], origins: allowedWebOrigins() });
    return { available: true, token: t.token, expiresAt: t.expiresAt, assistantId: agent.providerAssistantId, variableValues: {} };
  } catch {
    return { available: false, reason: "Voice is not available right now." };
  }
}
