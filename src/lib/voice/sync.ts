/**
 * Polling baseline: GET /call?assistantId=… for every assistant registered in voice_agents.
 * This is how calls to Viki (whose server URL belongs to Curtis's n8n flow and is never changed)
 * reach Kaivaryn. Idempotent: calls are upserted by provider call id. Unroutable calls are skipped
 * and logged; they never land in any tenant.
 */
import { prisma } from "@/lib/prisma";
import { listCalls, vapiConfigured, type FetchLike } from "./vapi-client";
import { resolveTenant, logRejected, sessionTokenFromCall } from "./tenancy";
import { upsertCall } from "./calls";
import { isHqTenant } from "./webhook";

const OVERLAP_MS = 6 * 60 * 60 * 1000; // re-read the last 6h so late analysis/summary lands

export type SyncResult = { configured: boolean; agents: number; fetched: number; stored: number; created: number; skipped: number; errors: string[] };

export async function syncVoiceCalls(opts?: { fetch?: FetchLike; tenantId?: string }): Promise<SyncResult> {
  const out: SyncResult = { configured: vapiConfigured(), agents: 0, fetched: 0, stored: 0, created: 0, skipped: 0, errors: [] };
  if (!out.configured) return out;
  const agents = await prisma.voiceAgent.findMany({ where: { providerAssistantId: { not: null }, ...(opts?.tenantId ? { tenantId: opts.tenantId } : {}) }, select: { id: true, tenantId: true, providerAssistantId: true, lastSyncedAt: true, name: true } });
  out.agents = agents.length;
  for (const a of agents) {
    const startedSync = new Date();
    try {
      const since = a.lastSyncedAt ? new Date(a.lastSyncedAt.getTime() - OVERLAP_MS).toISOString() : undefined;
      const calls = await listCalls({ assistantId: a.providerAssistantId!, createdAtGt: since, limit: 100 }, opts?.fetch);
      out.fetched += calls.length;
      for (const c of calls) {
        if (c.assistantId && c.assistantId !== a.providerAssistantId) { out.skipped++; continue; }
        const route = await resolveTenant({ assistantId: a.providerAssistantId, providerCallId: c.id, sessionToken: sessionTokenFromCall(c), requireFreshToken: false });
        if (!route.ok) {
          out.skipped++;
          await logRejected(route.reason, { assistantId: a.providerAssistantId, type: "poll" });
          continue;
        }
        if (c.status && c.status !== "ended" && c.status !== "in-progress") { out.skipped++; continue; }
        try {
          const r = await upsertCall({ tenantId: route.tenantId, agent: route.agent, call: { ...c, assistantId: a.providerAssistantId }, source: "poll", userId: route.session?.u ?? null, isHq: await isHqTenant(route.tenantId) });
          out.stored++;
          if (r.created) out.created++;
        } catch (e) {
          out.skipped++;
          out.errors.push((e as Error).message.slice(0, 120));
        }
      }
      await prisma.voiceAgent.update({ where: { id: a.id }, data: { lastSyncedAt: startedSync } });
    } catch (e) {
      out.errors.push(`${a.name}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  return out;
}
