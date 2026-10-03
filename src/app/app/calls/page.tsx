import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { listCallsForTenant } from "@/lib/voice/agents";
import { currentUsage } from "@/lib/voice/usage";
import { canVoice } from "@/lib/voice/permissions";
import { KAIVARYN_HQ_SLUG, VOICE_OUTBOUND_ENABLED } from "@/lib/voice/constants";
import { IncludedVoiceUsage, fmtET, fmtDuration, FIT_LABEL, CHANNEL_LABEL } from "@/components/voice/usage-card";
import { syncCallsNow } from "./actions";

export const metadata = { title: "Calls" };
export const dynamic = "force-dynamic";

const QUAL_TONE: Record<string, "success" | "warning" | "danger" | "default"> = { QUALIFIED: "success", NEEDS_REVIEW: "warning", NOT_QUALIFIED: "danger", UNKNOWN: "default" };

export default async function CallsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const vctx = { tenantId: ctx.organizationId, userId: ctx.user.id, role: ctx.effectiveRole };
  const isHq = ctx.organization?.slug === KAIVARYN_HQ_SLUG;
  const [calls, usage, agents] = await Promise.all([
    listCallsForTenant(vctx),
    currentUsage(ctx.organizationId),
    prisma.voiceAgent.findMany({ where: { tenantId: ctx.organizationId }, select: { id: true, name: true, kind: true, status: true, lastSyncedAt: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const canSync = canVoice(ctx.effectiveRole, "voice.sync");
  const showCost = isHq && canVoice(ctx.effectiveRole, "voice.cost.view");
  const lastSync = agents.map((a) => a.lastSyncedAt).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isHq ? "Voice · Kaivaryn internal" : "Voice"}
        title="Calls"
        description={isHq ? "Every call handled by Viki — phone lines and the website — synced into Kaivaryn and linked to pipeline records where a match exists." : "Calls handled by your voice agent and in-app voice. Summaries and fields marked “derived” come from transcript rules, not a person."}
        actions={canSync ? <form action={syncCallsNow}><Button type="submit" variant="outline" size="sm">Sync now</Button></form> : null}
      />
      {searchParams.ok ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{searchParams.msg || "Done"}</p> : null}
      {searchParams.error ? <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{searchParams.msg || "Error"}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <IncludedVoiceUsage usage={usage} showProviderCost={showCost} />
        <div className="si-panel p-5">
          <p className="si-label">Assistants</p>
          {agents.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {agents.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-neutral-200">{a.name}<span className="ml-2 text-[11px] text-neutral-500">{a.kind === "CLIENT" ? "your voice agent" : a.kind === "KAIVARYN_PHONE" ? "phone lines · read-only" : a.kind === "KAIVARYN_WEB" ? "website" : "in-app"}</span></span>
                  <Badge tone={a.status === "active" ? "success" : a.status === "paused" ? "warning" : "default"}>{a.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-neutral-400">No voice agent yet. <Link href="/app/voice-agent" className="text-amber-400 hover:text-amber-300">Create your company&apos;s voice agent →</Link></p>
          )}
          <p className="mt-4 text-[11px] text-neutral-500">Last synced: {lastSync ? fmtET(lastSync) : "not yet"} · syncs automatically about every 15 minutes.</p>
          <p className="mt-1 text-[11px] text-neutral-500">Outbound calling: <span className="text-neutral-300">{VOICE_OUTBOUND_ENABLED ? "on" : "off"}</span> — Kaivaryn does not place autonomous or bulk calls.</p>
        </div>
      </div>

      {!calls.length ? (
        <EmptyState title="No calls yet" description={isHq ? "Viki's calls appear here after the next sync." : "Calls appear here once your voice agent or in-app voice is used."} />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <THead><tr><TH>When</TH><TH>Caller</TH><TH>Channel</TH><TH>Duration</TH><TH>Intent</TH><TH>Fit</TH><TH>Qualification</TH><TH>Next step</TH><TH>Outcome</TH>{showCost ? <TH>Cost</TH> : null}</tr></THead>
              <TBody>
                {calls.map((c) => (
                  <TR key={c.id}>
                    <TD className="whitespace-nowrap text-xs"><Link href={`/app/calls/${c.id}`} className="text-amber-300 hover:text-amber-200">{fmtET(c.startedAt)}</Link></TD>
                    <TD><p className="text-sm">{c.callerName || c.callerNumber || "Unknown caller"}</p><p className="text-[11px] text-neutral-500">{[c.company, c.callerName ? c.callerNumber : null].filter(Boolean).join(" · ")}{c.linkedAccountId || c.linkedDemoRequestId || c.linkedLeadId || c.linkedCustomerId ? <span className="ml-1 text-emerald-400">· linked</span> : null}</p></TD>
                    <TD className="text-xs text-neutral-400">{CHANNEL_LABEL[c.channel || ""] || "—"}<p className="text-[11px] text-neutral-600">{c.assistantName}</p></TD>
                    <TD className="text-xs">{fmtDuration(c.durationSeconds)}</TD>
                    <TD className="max-w-[14rem] text-xs text-neutral-300">{c.intent || "—"}{c.analysisSource === "derived" && c.intent ? <span className="ml-1 text-[10px] text-neutral-600">derived</span> : null}</TD>
                    <TD className="text-xs">{FIT_LABEL[c.productFit || ""] || "—"}</TD>
                    <TD><Badge tone={QUAL_TONE[c.qualification || "UNKNOWN"] ?? "default"}>{(c.qualification || "UNKNOWN").replace(/_/g, " ").toLowerCase()}</Badge></TD>
                    <TD className="max-w-[12rem] text-xs text-neutral-400">{c.nextStep || "—"}</TD>
                    <TD className="text-xs text-neutral-400">{c.outcome || c.status || "—"}</TD>
                    {showCost ? <TD className="text-xs text-neutral-500">{c.costUsd != null ? `$${c.costUsd.toFixed(3)}` : "—"}</TD> : null}
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {calls.map((c) => (
              <Link key={c.id} href={`/app/calls/${c.id}`} className="block rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
                <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium text-white">{c.callerName || c.callerNumber || "Unknown caller"}</p><span className="shrink-0 text-[11px] text-neutral-500">{fmtET(c.startedAt)}</span></div>
                <p className="mt-1 text-xs text-neutral-400">{CHANNEL_LABEL[c.channel || ""] || "—"} · {fmtDuration(c.durationSeconds)} · {FIT_LABEL[c.productFit || ""] || "—"}</p>
                {c.intent ? <p className="mt-2 text-xs text-neutral-300">{c.intent}</p> : null}
                {c.nextStep ? <p className="mt-1 text-[11px] text-amber-300/80">Next: {c.nextStep}</p> : null}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
