import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { getCallForTenant } from "@/lib/voice/agents";
import { KAIVARYN_HQ_SLUG } from "@/lib/voice/constants";
import { fmtET, fmtDuration, FIT_LABEL, CHANNEL_LABEL } from "@/components/voice/usage-card";

export const metadata = { title: "Call" };
export const dynamic = "force-dynamic";

type Turn = { role: string; text: string; at?: number };

export default async function CallDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const call = await getCallForTenant({ tenantId: ctx.organizationId, userId: ctx.user.id, role: ctx.effectiveRole }, params.id);
  if (!call) notFound();
  const isHq = ctx.organization?.slug === KAIVARYN_HQ_SLUG;
  const events = await prisma.voiceEvent.findMany({ where: { tenantId: ctx.organizationId, OR: [{ voiceCallId: call.id }, { providerCallId: call.providerCallId }] }, orderBy: { createdAt: "asc" }, take: 50, select: { id: true, type: true, level: true, createdAt: true } });
  const turns: Turn[] = call.transcriptJson ? JSON.parse(call.transcriptJson) : [];
  const field = (label: string, value: React.ReactNode) => <div><p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p><p className="mt-1 text-sm text-neutral-200">{value || "—"}</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/calls" className="text-xs text-neutral-500 hover:text-white">← Calls</Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">{call.callerName || call.callerNumber || "Unknown caller"}</h1>
        <p className="mt-1 text-sm text-neutral-400">{fmtET(call.startedAt)} · {fmtDuration(call.durationSeconds)} · {CHANNEL_LABEL[call.channel || ""] || "—"} · {call.assistantName}</p>
      </div>
      <div className="si-panel grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {field("Company", call.company)}
        {field("Caller number", call.callerNumber)}
        {field("Email", call.callerEmail)}
        {field("Intent", call.intent)}
        {field("Product fit", FIT_LABEL[call.productFit || ""])}
        {field("Qualification", call.qualification?.replace(/_/g, " ").toLowerCase())}
        {field("Demo", call.demoStatus?.replace(/_/g, " ").toLowerCase())}
        {field("Next step", call.nextStep)}
        {field("Follow-up", call.followUp)}
        {field("Outcome", call.outcome)}
        {field("Ended", call.endedReason?.replace(/-/g, " "))}
        {call.costUsd != null ? field("Provider cost (internal)", `$${call.costUsd.toFixed(4)}`) : null}
      </div>
      <p className="text-[11px] text-neutral-500">Analysis source: {call.analysisSource === "provider" ? "the voice platform's post-call analysis" : "derived from the transcript by fixed rules"}. Demo status is never marked “booked” unless a booking is confirmed.</p>
      {call.linkedAccountId || call.linkedDemoRequestId || call.linkedLeadId || call.linkedCustomerId ? (
        <div className="si-panel p-5 text-sm">
          <p className="si-label">Linked records</p>
          <ul className="mt-2 space-y-1">
            {call.linkedAccountId && isHq ? <li>{ctx.isSuperAdmin ? <Link className="text-amber-300 hover:text-amber-200" href={`/admin/acquisition/${call.linkedAccountId}`}>Pipeline account →</Link> : <span className="text-neutral-300">Pipeline account linked</span>}</li> : null}
            {call.linkedDemoRequestId && isHq ? <li>{ctx.isSuperAdmin ? <Link className="text-amber-300 hover:text-amber-200" href="/admin/demos">Demo request →</Link> : <span className="text-neutral-300">Demo request linked</span>}</li> : null}
            {call.linkedLeadId ? <li className="text-neutral-300">Lead linked</li> : null}
            {call.linkedCustomerId ? <li className="text-neutral-300">Customer linked</li> : null}
          </ul>
        </div>
      ) : null}
      <div className="si-panel p-5">
        <p className="si-label">Summary</p>
        <p className="mt-2 text-sm leading-6 text-neutral-300">{call.summary || "No summary available for this call."}</p>
      </div>
      <div className="si-panel p-5">
        <p className="si-label">Transcript</p>
        {call.transcriptHidden ? (
          <p className="mt-2 text-sm text-neutral-400">Transcripts are visible to managers and above.</p>
        ) : turns.length ? (
          <div className="mt-3 space-y-2">
            {turns.map((t, i) => (
              <div key={i} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${t.role === "assistant" ? "bg-neutral-900 text-neutral-200" : "ml-auto bg-amber-500/10 text-amber-100"}`}>
                <p className="text-[10px] uppercase tracking-wider text-neutral-500">{t.role === "assistant" ? call.assistantName || "Assistant" : "Caller"}{typeof t.at === "number" ? ` · ${t.at}s` : ""}</p>
                <p className="mt-0.5 leading-6">{t.text}</p>
              </div>
            ))}
          </div>
        ) : call.transcript ? (
          <pre className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">{call.transcript}</pre>
        ) : (
          <p className="mt-2 text-sm text-neutral-400">No transcript available.</p>
        )}
      </div>
      {events.length ? (
        <div className="si-panel p-5">
          <p className="si-label">Activity</p>
          <ul className="mt-2 space-y-1 text-xs text-neutral-400">
            {events.map((e) => <li key={e.id}>{fmtET(e.createdAt)} · {e.type}{e.level ? <Badge className="ml-2">{e.level}</Badge> : null}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
