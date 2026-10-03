/**
 * Registers Kaivaryn's own assistants in voice_agents under the internal Kaivaryn HQ tenant, so the
 * provider-assistant-id → tenant map is explicit and unique. Idempotent; never moves an assistant id
 * that is already mapped to a different tenant.
 */
import type { PrismaClient } from "@prisma/client";
import { KAIVARYN_HQ_SLUG, VIKI_ASSISTANT_ID, KAIVARYN_WEB_ASSISTANT_ID, KAIVARYN_WORKSPACE_ASSISTANT_ID } from "./constants";

type Def = { providerAssistantId: string; kind: string; routing: string; name: string; role: string; phoneConfig?: Record<string, unknown> };

export function kaivarynAgentDefs(): Def[] {
  const defs: Def[] = [
    {
      providerAssistantId: VIKI_ASSISTANT_ID,
      kind: "KAIVARYN_PHONE",
      routing: "FIXED",
      name: "Viki",
      role: "Kaivaryn receptionist on the phone lines (managed in Vapi + n8n; read-only here)",
      phoneConfig: { managedBy: "Vapi + n8n (Curtis)", readOnly: true, lines: ["+1 980 227 4880", "+1 855 619 2864"] },
    },
  ];
  if (KAIVARYN_WEB_ASSISTANT_ID()) defs.push({ providerAssistantId: KAIVARYN_WEB_ASSISTANT_ID(), kind: "KAIVARYN_WEB", routing: "FIXED", name: "Viki (Web)", role: "Kaivaryn website assistant: qualification, RR/OE fit, demo booking, FAQ" });
  if (KAIVARYN_WORKSPACE_ASSISTANT_ID()) defs.push({ providerAssistantId: KAIVARYN_WORKSPACE_ASSISTANT_ID(), kind: "KAIVARYN_WORKSPACE", routing: "SIGNED_SESSION", name: "Viki (Workspace)", role: "In-app assistant for signed-in executives; tenant from a signed per-call token" });
  return defs;
}

export async function ensureKaivarynVoiceAgents(prisma: PrismaClient): Promise<{ registered: number; conflicts: string[] }> {
  const hq = await prisma.organization.findUnique({ where: { slug: KAIVARYN_HQ_SLUG }, select: { id: true } });
  if (!hq) return { registered: 0, conflicts: ["kaivaryn-hq org missing"] };
  const conflicts: string[] = [];
  let registered = 0;
  for (const d of kaivarynAgentDefs()) {
    const existing = await prisma.voiceAgent.findUnique({ where: { providerAssistantId: d.providerAssistantId } });
    if (existing && existing.tenantId !== hq.id) {
      conflicts.push(d.name);
      continue;
    }
    const data = { kind: d.kind, routing: d.routing, origin: "INTERNAL", name: d.name, role: d.role, status: "active", phoneConfigJson: d.phoneConfig ? JSON.stringify(d.phoneConfig) : null };
    if (existing) await prisma.voiceAgent.update({ where: { id: existing.id }, data });
    else await prisma.voiceAgent.create({ data: { ...data, tenantId: hq.id, providerAssistantId: d.providerAssistantId, provisionedAt: new Date() } });
    registered++;
  }
  return { registered, conflicts };
}
