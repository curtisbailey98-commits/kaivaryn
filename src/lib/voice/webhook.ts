/**
 * Vapi server-message handler (framework-free so it can be tested directly).
 * Order: authenticate → parse → route tenant (fail closed) → act. Nothing is written for a request
 * that fails authentication or tenant routing, except a platform-level audit line.
 */
import { prisma } from "@/lib/prisma";
import { verifyWebhook } from "./security";
import { resolveTenant, logRejected, sessionTokenFromCall } from "./tenancy";
import { runTool } from "./tools";
import { upsertCall } from "./calls";
import { KAIVARYN_HQ_SLUG } from "./constants";
import type { VapiCall } from "./vapi-client";

export type HandlerResult = { status: number; body: Record<string, unknown> };

type ToolCallItem = { id?: string; name?: string; parameters?: unknown; arguments?: unknown; function?: { name?: string; arguments?: unknown } };

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw);
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  }
  return {};
}

export async function isHqTenant(tenantId: string) {
  const org = await prisma.organization.findUnique({ where: { id: tenantId }, select: { slug: true } });
  return org?.slug === KAIVARYN_HQ_SLUG;
}

export async function handleVoiceWebhook(rawBody: string, headers: Headers): Promise<HandlerResult> {
  const auth = verifyWebhook(headers, rawBody);
  if (!auth.ok) {
    if (auth.status === 401) await logRejected("webhook_auth_failed", { why: auth.reason });
    return { status: auth.status, body: { error: auth.status === 503 ? "not_configured" : "unauthorized" } };
  }
  let body: { message?: Record<string, unknown> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "invalid_json" } };
  }
  const msg = (body?.message || {}) as Record<string, unknown>;
  const type = String(msg.type || "");
  const call = (msg.call || {}) as VapiCall;
  const assistantId = call.assistantId || ((msg.assistant as { id?: string } | undefined)?.id ?? null);
  const token = sessionTokenFromCall(call) ?? (msg.artifact as { variableValues?: Record<string, unknown> } | undefined)?.variableValues?.kvToken;

  const route = await resolveTenant({ assistantId, providerCallId: call.id, sessionToken: token, requireFreshToken: type === "tool-calls" });
  if (!route.ok) {
    await logRejected(route.reason, { assistantId, type });
    if (type === "tool-calls") {
      const list = (msg.toolCallList || []) as ToolCallItem[];
      return { status: 200, body: { results: list.map((t) => ({ toolCallId: t.id, name: t.name || t.function?.name, result: "unavailable: this call could not be verified, so no workspace information can be shared." })) } };
    }
    return { status: 200, body: { ok: false, ignored: route.reason } };
  }

  if (type === "tool-calls") {
    const list = (msg.toolCallList || []) as ToolCallItem[];
    const results = [];
    for (const t of list.slice(0, 8)) {
      const name = String(t.name || t.function?.name || "");
      const args = parseArgs(t.parameters ?? t.arguments ?? t.function?.arguments);
      const r = await runTool({ tenantId: route.tenantId, agent: route.agent, providerCallId: call.id || null, session: route.session ? { userId: route.session.u, role: route.session.role } : undefined }, name, args);
      results.push({ toolCallId: t.id, name, result: r.result });
    }
    return { status: 200, body: { results } };
  }

  if (type === "end-of-call-report" || type === "status-update") {
    if (!call.id) return { status: 200, body: { ok: false, ignored: "missing_call_id" } };
    const merged: VapiCall = {
      ...call,
      status: type === "status-update" ? String(msg.status || call.status || "") : "ended",
      endedReason: (msg.endedReason as string) || call.endedReason,
      artifact: (msg.artifact as VapiCall["artifact"]) || call.artifact,
      analysis: (msg.analysis as VapiCall["analysis"]) || call.analysis,
      startedAt: (msg.startedAt as string) || call.startedAt,
      endedAt: (msg.endedAt as string) || call.endedAt,
      cost: typeof msg.cost === "number" ? (msg.cost as number) : call.cost,
      summary: (msg.summary as string) || call.summary,
    };
    try {
      const r = await upsertCall({ tenantId: route.tenantId, agent: route.agent, call: merged, source: "webhook", userId: route.session?.u ?? null, isHq: await isHqTenant(route.tenantId) });
      return { status: 200, body: { ok: true, stored: r.created ? "created" : "updated" } };
    } catch (e) {
      await logRejected("store_failed", { assistantId, type, error: (e as Error).message.slice(0, 120) });
      return { status: 200, body: { ok: false, ignored: "store_failed" } };
    }
  }
  return { status: 200, body: { ok: true } };
}
