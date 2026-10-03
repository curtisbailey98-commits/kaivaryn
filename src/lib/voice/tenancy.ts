/**
 * Tenant routing — fails closed.
 * - The provider assistant id must match exactly one VoiceAgent row (unique column). No match → reject.
 * - FIXED agents route to their own tenant.
 * - SIGNED_SESSION agents (Kaivaryn's in-app assistant, shared across tenants) route ONLY via a valid
 *   signed per-call token whose nonce was issued by our server, whose user is still a member of that
 *   tenant, and which is bound to at most one provider call. Anything else → reject.
 * Rejections are written to the platform audit log (organizationId = null) — never to a tenant.
 */
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { effectiveRole } from "@/lib/rbac";
import { verifySessionToken, type SessionClaims } from "./security";
import type { VapiCall } from "./vapi-client";

export type TenantRoute =
  | { ok: true; tenantId: string; agent: { id: string; tenantId: string; kind: string; routing: string; name: string; status: string; providerAssistantId: string | null }; session?: SessionClaims & { role: string } }
  | { ok: false; reason: string };

export function sessionTokenFromCall(call: Pick<VapiCall, "assistantOverrides" | "artifact" | "metadata">): unknown {
  return call.assistantOverrides?.variableValues?.kvToken ?? call.artifact?.variableValues?.kvToken ?? undefined;
}

export async function resolveTenant(input: {
  assistantId: string | null | undefined;
  providerCallId: string | null | undefined;
  sessionToken?: unknown;
  /** Live tool calls need an unexpired token; record routing after the call may use an expired one. */
  requireFreshToken?: boolean;
  bind?: boolean;
}): Promise<TenantRoute> {
  const assistantId = String(input.assistantId || "").trim();
  if (!assistantId) return { ok: false, reason: "missing_assistant_id" };
  const agent = await prisma.voiceAgent.findUnique({
    where: { providerAssistantId: assistantId },
    select: { id: true, tenantId: true, kind: true, routing: true, name: true, status: true, providerAssistantId: true },
  });
  if (!agent) return { ok: false, reason: "unknown_assistant" };
  if (agent.routing === "FIXED") return { ok: true, tenantId: agent.tenantId, agent };
  if (agent.routing !== "SIGNED_SESSION") return { ok: false, reason: "unknown_routing" };

  const v = verifySessionToken(input.sessionToken, undefined, input.requireFreshToken ? undefined : 0);
  if (!v.ok) return { ok: false, reason: `session_${v.reason}` };
  const s = v.claims;
  const row = await prisma.voiceToolSession.findUnique({ where: { nonce: s.n } });
  if (!row || row.tenantId !== s.t || row.userId !== s.u) return { ok: false, reason: "session_unknown" };
  const member = await prisma.membership.findFirst({ where: { organizationId: s.t, userId: s.u }, select: { role: true } });
  const user = await prisma.user.findUnique({ where: { id: s.u }, select: { role: true } });
  const platform = user?.role === "SUPER_ADMIN" || user?.role === "CEO" || user?.role === "CSEO";
  if (!member && !platform) return { ok: false, reason: "session_not_member" };
  const callId = String(input.providerCallId || "");
  if (row.providerCallId && callId && row.providerCallId !== callId) return { ok: false, reason: "session_bound_to_other_call" };
  if (!row.providerCallId && callId && input.bind !== false) {
    // Atomic first-use bind: only succeeds while still unbound.
    const res = await prisma.voiceToolSession.updateMany({ where: { id: row.id, providerCallId: null }, data: { providerCallId: callId } });
    if (res.count !== 1) {
      const again = await prisma.voiceToolSession.findUnique({ where: { id: row.id } });
      if (again?.providerCallId !== callId) return { ok: false, reason: "session_bound_to_other_call" };
    }
  }
  // Role is re-read now (a downgrade since the token was issued takes effect immediately).
  return { ok: true, tenantId: s.t, agent, session: { ...s, role: effectiveRole(user?.role, member?.role) } };
}

export async function logRejected(reason: string, detail: Record<string, unknown>) {
  console.warn(`[voice] rejected: ${reason}`, JSON.stringify({ assistantId: detail.assistantId ?? null, type: detail.type ?? null }));
  await writeAudit({ organizationId: null, action: "voice.rejected", entityType: "VoiceCall", metadata: { reason, ...detail } }).catch(() => undefined);
}
