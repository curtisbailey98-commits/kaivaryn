import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { writeAudit } from "@/lib/audit";
import { recomputeUsage } from "@/lib/voice/usage";
import { voiceReadiness } from "@/lib/voice/session";
import { VOICE_OUTBOUND_ENABLED } from "@/lib/voice/constants";
import { fmtET } from "@/components/voice/usage-card";

export const metadata = { title: "Voice" };
export const dynamic = "force-dynamic";

async function setAllowance(formData: FormData) {
  "use server";
  const ctx = await getSessionContext();
  if (!ctx?.isSuperAdmin) redirect("/app");
  const orgId = String(formData.get("orgId") || "");
  const raw = String(formData.get("minutes") || "").trim();
  const minutes = raw === "" ? null : Math.max(0, Math.min(1_000_000, Number(raw)));
  if (minutes !== null && !Number.isFinite(minutes)) redirect("/admin/voice");
  const s = await prisma.orgSettings.findUnique({ where: { organizationId: orgId } });
  const json = (() => { try { return JSON.parse(s?.settingsJson || "{}"); } catch { return {}; } })();
  if (minutes === null || minutes === 0) delete json.voiceIncludedMinutes;
  else json.voiceIncludedMinutes = minutes;
  await prisma.orgSettings.upsert({ where: { organizationId: orgId }, update: { settingsJson: JSON.stringify(json) }, create: { organizationId: orgId, settingsJson: JSON.stringify(json) } });
  const now = new Date();
  await recomputeUsage(orgId, `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`);
  await writeAudit({ organizationId: orgId, actorId: ctx.user.id, action: "voice.allowance.set", metadata: { minutes } });
  revalidatePath("/admin/voice");
}

/** Platform view: assistants per tenant, status, sync, rejections. No transcripts here. */
export default async function AdminVoicePage() {
  const [agents, orgs, rejected, readiness] = await Promise.all([
    prisma.voiceAgent.findMany({ orderBy: [{ tenantId: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, kind: true, status: true, routing: true, providerAssistantId: true, lastSyncedAt: true, provisionError: true, tenant: { select: { name: true } }, _count: { select: { calls: true } } } }),
    prisma.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, settings: { select: { settingsJson: true } } } }),
    prisma.auditLog.count({ where: { organizationId: null, action: "voice.rejected", createdAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
    Promise.resolve(voiceReadiness()),
  ]);
  const allowance = (j?: string | null) => { try { return JSON.parse(j || "{}").voiceIncludedMinutes ?? ""; } catch { return ""; } };
  return (
    <div className="space-y-6">
      <div><p className="si-label text-amber-500">Platform</p><h1 className="mt-1 text-2xl font-semibold text-white">Voice</h1><p className="mt-1 text-sm text-neutral-400">Assistant → tenant map, provisioning state, and sync health. Unknown assistants are rejected and counted here, never stored in a tenant.</p></div>
      <div className="grid gap-3 sm:grid-cols-5 text-sm">
        {Object.entries(readiness).map(([k, v]) => <div key={k} className="si-panel p-3"><p className="text-[11px] text-neutral-500">{k}</p><Badge tone={v ? "success" : "warning"}>{v ? "configured" : "missing"}</Badge></div>)}
        <div className="si-panel p-3"><p className="text-[11px] text-neutral-500">Rejected (7d)</p><p className="text-lg font-semibold text-white">{rejected}</p></div>
      </div>
      <p className="text-xs text-neutral-500">Outbound calling: {VOICE_OUTBOUND_ENABLED ? "on" : "off (hard-disabled)"}.</p>
      <div className="si-panel overflow-x-auto p-0">
        <table className="w-full text-left text-sm"><thead className="border-b border-neutral-800 text-xs uppercase text-neutral-500"><tr><th className="px-3 py-2">Tenant</th><th className="px-3 py-2">Agent</th><th className="px-3 py-2">Kind</th><th className="px-3 py-2">Routing</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Calls</th><th className="px-3 py-2">Last sync</th><th className="px-3 py-2">Provider</th></tr></thead>
          <tbody className="divide-y divide-neutral-900">{agents.map((a) => <tr key={a.id}><td className="px-3 py-2">{a.tenant.name}</td><td className="px-3 py-2">{a.name}</td><td className="px-3 py-2 text-xs">{a.kind}</td><td className="px-3 py-2 text-xs">{a.routing}</td><td className="px-3 py-2"><Badge>{a.status}</Badge></td><td className="px-3 py-2">{a._count.calls}</td><td className="px-3 py-2 text-xs">{fmtET(a.lastSyncedAt)}</td><td className="px-3 py-2 text-xs">{a.providerAssistantId ? `…${a.providerAssistantId.slice(-6)}` : "not provisioned"}{a.provisionError ? <span className="ml-1 text-red-400">error</span> : null}</td></tr>)}</tbody></table>
      </div>
      <div className="si-panel p-5">
        <p className="si-label">Included Voice Usage allowance (minutes / month)</p>
        <p className="mt-1 text-xs text-neutral-500">Blank = not set. No pricing is attached here.</p>
        <div className="mt-3 space-y-2">{orgs.map((o) => <form key={o.id} action={setAllowance} className="flex flex-wrap items-center gap-2 text-sm"><input type="hidden" name="orgId" value={o.id} /><span className="w-56 truncate text-neutral-300">{o.name}</span><input name="minutes" defaultValue={String(allowance(o.settings?.settingsJson))} inputMode="numeric" className="h-8 w-28 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm" /><Button type="submit" size="sm" variant="outline">Save</Button></form>)}</div>
      </div>
    </div>
  );
}
