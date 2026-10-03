import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTenantClientAgent } from "@/lib/voice/agents";
import { canVoice } from "@/lib/voice/permissions";
import { currentUsage } from "@/lib/voice/usage";
import { AGENT_STATUS_LABEL, type AgentStatus } from "@/lib/voice/constants";
import { CLIENT_TOOLS, ACTION_LEVELS, ACTION_LEVEL_LABEL, sanitizeToolMap, systemStateFromIntegration, type SystemState } from "@/lib/voice/action-levels";
import { VOICE_OPTIONS, TONE_OPTIONS, CALLER_TYPES, HANDLE_OPTIONS, HUMAN_ALWAYS_OPTIONS, APPROVAL_OPTIONS } from "@/lib/voice/generator";
import { IncludedVoiceUsage } from "@/components/voice/usage-card";
import { AgentPreviewCall } from "@/components/voice/agent-preview-call";
import { generateAction, saveSelfAction, toolLevelsAction, provisionAction, submitAction, approveAction, activateAction, pauseAction } from "./actions";

export const metadata = { title: "Voice agent" };
export const dynamic = "force-dynamic";

const STEPS = ["Choose", "Configure", "Review", "Test", "Approve", "Activate"] as const;
const stepFor = (status: string | null): number => (!status ? 0 : status === "draft" || status === "generated" ? 2 : status === "in_review" ? 4 : status === "testing" ? 3 : status === "approved" ? 5 : 6);

const inputCls = "mt-1.5 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-amber-500/60 focus:outline-none";
const optionCls = "flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm transition has-[:checked]:border-amber-500/50 has-[:checked]:bg-amber-500/[0.06]";
const STATE_LABEL: Record<SystemState, string> = { selected: "Selected", planned: "Planned", configured: "Configured", connected: "Connected", verified: "Verified" };
const STATE_TONE: Record<SystemState, "default" | "info" | "warning" | "success"> = { selected: "default", planned: "default", configured: "info", connected: "success", verified: "success" };
const SYSTEM_LABEL = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace("Crm", "CRM").replace("Erp", "ERP").replace("Hr", "HR").replace("Api", "API").replace("Sftp", "SFTP").replace("Csv", "CSV");

async function orgSystems(tenantId: string) {
  const rows = await prisma.onboardingProgress.findMany({ where: { organizationId: tenantId }, select: { dataJson: true } });
  const selected = new Set<string>();
  for (const r of rows) {
    try {
      const d = JSON.parse(r.dataJson || "{}");
      for (const s of d?.integrations?.integrations || []) selected.add(String(s));
    } catch { /* ignore */ }
  }
  const conns = await prisma.integrationConnection.findMany({ where: { organizationId: tenantId }, select: { provider: true, status: true } });
  const out = new Map<string, SystemState>();
  for (const s of Array.from(selected)) out.set(s, "selected");
  for (const c of conns) {
    const st = systemStateFromIntegration(c.status, selected.has(c.provider));
    if (st) out.set(c.provider, st);
  }
  return out;
}

export default async function VoiceAgentPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const role = ctx.effectiveRole;
  const [agent, sub, paidAcct, usage, systems] = await Promise.all([
    getTenantClientAgent(ctx.organizationId),
    prisma.subscription.findFirst({ where: { organizationId: ctx.organizationId, status: "ACTIVE" }, select: { id: true } }),
    prisma.acquisitionAccount.findFirst({ where: { onboardingOrganizationId: ctx.organizationId, paymentStatus: "PAID" }, select: { id: true } }),
    currentUsage(ctx.organizationId),
    orgSystems(ctx.organizationId),
  ]);
  const activated = Boolean(sub || paidAcct);
  const canEdit = canVoice(role, "voice.agent.edit");
  const mode = searchParams.mode === "build" || searchParams.mode === "self" ? searchParams.mode : null;
  const editing = Boolean(mode) || !agent;
  const status = (agent?.status as AgentStatus | undefined) ?? null;
  const step = mode ? 1 : stepFor(status);
  const company = ctx.organization?.name || "your company";
  const systemKeys = Array.from(systems.keys());
  const tools = agent ? sanitizeToolMap(JSON.parse(agent.allowedToolsJson || "{}")) : {};
  const pendingApproval = agent ? await prisma.approvalRequest.findFirst({ where: { organizationId: ctx.organizationId, type: "VOICE_AGENT_ACTIVATION", status: "PENDING", payloadJson: { contains: agent.id } }, select: { id: true } }) : null;
  const q = agent?.questionnaireJson ? (JSON.parse(agent.questionnaireJson) as Record<string, unknown>) : {};
  const qa = (k: string) => (Array.isArray(q[k]) ? (q[k] as string[]) : []);

  if (!activated) {
    return (
      <div className="max-w-3xl">
        <p className="si-label text-amber-500">After activation</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Create your company&apos;s voice agent</h1>
        <div className="si-panel mt-6 p-6">
          <p className="text-sm leading-6 text-neutral-300">This step opens once your Kaivaryn engagement is active. You&apos;ll design an AI voice employee around how {company} works — what it handles, what always goes to a person, and what needs approval.</p>
          <div className="mt-5 flex flex-wrap gap-3"><Link href="/app/onboarding" className="rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-neutral-950">Back to setup</Link><Link href="/pricing" className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200">Pricing</Link></div>
        </div>
      </div>
    );
  }

  const toolRows = (current: Record<string, string>, disabled: boolean) => (
    <div className="divide-y divide-neutral-900 rounded-xl border border-neutral-800">
      {CLIENT_TOOLS.map((t) => {
        const usable = !t.systems?.length || t.systems.some((s) => systems.get(s) === "connected" || systems.get(s) === "verified");
        const backing = (t.systems || []).filter((s) => systems.has(s));
        return (
          <div key={t.key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-neutral-100">{t.label}</p>
              <p className="text-[11px] text-neutral-500">{t.description}{t.systems?.length ? (usable ? " · system connected" : backing.length ? ` · ${backing.map(SYSTEM_LABEL).join(", ")}: ${STATE_LABEL[systems.get(backing[0]!)!].toLowerCase()}, not connected — will take details and hand off` : " · no backing system connected — will take details and hand off") : ""}</p>
            </div>
            {t.consequential ? (
              <span className="shrink-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300">Always needs approval</span>
            ) : (
              <select name={`tool_${t.key}`} defaultValue={current[t.key] || "OFF"} disabled={disabled} className="h-9 shrink-0 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-xs text-neutral-200">
                <option value="OFF">Off</option>
                {ACTION_LEVELS.filter((l) => l !== "REQUIRE_APPROVAL" ? ACTION_LEVELS.indexOf(l) <= ACTION_LEVELS.indexOf(t.maxLevel) : true).map((l) => <option key={l} value={l}>{ACTION_LEVEL_LABEL[l].split(" — ")[0]}</option>)}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );

  const systemChecks = (checked: string[]) =>
    systemKeys.length ? (
      <div className="grid gap-2 sm:grid-cols-2">
        {systemKeys.map((s) => (
          <label key={s} className={optionCls}>
            <input type="checkbox" name="systems" value={s} defaultChecked={checked.length ? checked.includes(s) : true} className="mt-1 accent-amber-500" />
            <span className="flex flex-1 items-center justify-between gap-2"><span className="text-neutral-100">{SYSTEM_LABEL(s)}</span><Badge tone={STATE_TONE[systems.get(s)!]}>{STATE_LABEL[systems.get(s)!]}</Badge></span>
          </label>
        ))}
      </div>
    ) : (
      <p className="text-xs text-neutral-500">No business systems selected yet. <Link href="/app/onboarding" className="text-amber-400">Choose them in setup</Link> — selecting a system plans it; it isn&apos;t connected until Kaivaryn connects it.</p>
    );

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <p className="si-label text-amber-500">Setup · after activation</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Create your company&apos;s voice agent</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Kaivaryn configures an AI voice employee around {company}: what it handles, how it sounds, what always goes to a person, and what needs your approval. Nothing goes live until you approve and activate it.</p>
      </div>
      {searchParams.ok ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{searchParams.msg || "Saved"}</p> : null}
      {searchParams.error ? <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{searchParams.msg || "Error"}</p> : null}

      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className={`rounded-lg border p-2.5 ${i < step ? "border-emerald-500/30 bg-emerald-500/[0.06]" : i === step ? "border-amber-500/40 bg-amber-500/[0.06]" : "border-neutral-800 bg-neutral-950"}`}>
            <p className="font-mono text-[10px] text-neutral-500">{String(i + 1).padStart(2, "0")}</p>
            <p className="mt-1 text-xs font-medium text-white">{s}</p>
          </li>
        ))}
      </ol>

      {!canEdit && editing ? <p className="si-panel p-5 text-sm text-neutral-400">A manager, admin, or owner sets up the voice agent. You&apos;ll see it here once it exists.</p> : null}

      {canEdit && editing && !mode ? (
        <div className="grid gap-4 md:grid-cols-2" data-testid="voice-agent-choose">
          <Link href="/app/voice-agent?mode=build" className="group si-panel block p-6 transition hover:border-amber-500/50">
            <Badge tone="warning">Recommended</Badge>
            <h2 className="mt-3 text-lg font-semibold text-white">Let Kaivaryn build it for me</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">Answer a few questions about how {company} works. Kaivaryn drafts the whole configuration — greeting, responsibilities, handoff rules, and safe action levels — for you to review.</p>
            <p className="mt-4 text-sm text-amber-400 group-hover:text-amber-300">Start the questionnaire →</p>
          </Link>
          <Link href="/app/voice-agent?mode=self" className="group si-panel block p-6 transition hover:border-neutral-600">
            <Badge>Full control</Badge>
            <h2 className="mt-3 text-lg font-semibold text-white">I&apos;ll configure it myself</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">Set every detail: name, voice, tone, greeting, role, hours, after-hours behavior, escalation rules, approved knowledge, phone preferences, and what it may do.</p>
            <p className="mt-4 text-sm text-neutral-300 group-hover:text-white">Open the full form →</p>
          </Link>
        </div>
      ) : null}

      {canEdit && mode === "build" ? (
        <form action={generateAction} className="si-panel space-y-6 p-6" data-testid="voice-agent-questionnaire">
          <div><h2 className="text-lg font-semibold text-white">Tell us about {company}</h2><p className="mt-1 text-xs text-neutral-500">About three minutes. You&apos;ll review and edit everything before anything goes live.</p></div>
          <label className="block text-xs font-medium text-neutral-300">What should your voice agent be called?<input name="agentName" required maxLength={40} defaultValue={agent?.name || ""} placeholder={`e.g. Ava, Morgan, or “${company} Front Desk”`} className={inputCls} /></label>
          <label className="block text-xs font-medium text-neutral-300">What does {company} do?<textarea name="whatCompanyDoes" rows={3} defaultValue={String(q.whatCompanyDoes || "")} placeholder="Example: Regional HVAC installer and service company serving Charlotte. Residential and light commercial." className={inputCls} /></label>
          <fieldset><legend className="text-xs font-medium text-neutral-300">Who calls?</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{CALLER_TYPES.map(([v, l]) => <label key={v} className={optionCls}><input type="checkbox" name="whoCalls" value={v} defaultChecked={qa("whoCalls").includes(v)} className="mt-1 accent-amber-500" /><span className="text-neutral-100">{l}</span></label>)}</div></fieldset>
          <fieldset><legend className="text-xs font-medium text-neutral-300">What should it handle?</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{HANDLE_OPTIONS.map(([v, l]) => <label key={v} className={optionCls}><input type="checkbox" name="whatToHandle" value={v} defaultChecked={qa("whatToHandle").length ? qa("whatToHandle").includes(v) : ["faq", "messages", "callbacks"].includes(v)} className="mt-1 accent-amber-500" /><span className="text-neutral-100">{l}</span></label>)}</div></fieldset>
          <fieldset><legend className="text-xs font-medium text-neutral-300">What must always go to a person?</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{HUMAN_ALWAYS_OPTIONS.map(([v, l]) => <label key={v} className={optionCls}><input type="checkbox" name="alwaysHuman" value={v} defaultChecked={qa("alwaysHuman").length ? qa("alwaysHuman").includes(v) : ["complaints", "billing_disputes", "legal", "emergencies"].includes(v)} className="mt-1 accent-amber-500" /><span className="text-neutral-100">{l}</span></label>)}</div><input name="alwaysHumanNotes" defaultValue={String(q.alwaysHumanNotes || "")} placeholder="Anything else? e.g. calls from our two largest accounts" className={inputCls} /></fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-neutral-300">Business hours<input name="hours" defaultValue={String(q.hours || "")} placeholder="Mon–Fri 8am–6pm ET" className={inputCls} /></label>
            <label className="block text-xs font-medium text-neutral-300">Tone<select name="tone" defaultValue={String(q.tone || "warm_professional")} className={inputCls}>{TONE_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          </div>
          <fieldset><legend className="text-xs font-medium text-neutral-300">What can it schedule?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><label className={optionCls}><input type="radio" name="canSchedule" value="request_only" defaultChecked={q.canSchedule !== "none"} className="mt-1 accent-amber-500" /><span><span className="block text-neutral-100">Appointment requests</span><span className="text-[11px] text-neutral-500">Captures a preferred time; a person confirms. Real booking needs a connected calendar.</span></span></label><label className={optionCls}><input type="radio" name="canSchedule" value="none" defaultChecked={q.canSchedule === "none"} className="mt-1 accent-amber-500" /><span><span className="block text-neutral-100">Nothing</span><span className="text-[11px] text-neutral-500">It takes a message instead.</span></span></label></div></fieldset>
          <fieldset><legend className="text-xs font-medium text-neutral-300">Which of your systems should it plan around?</legend><p className="mb-2 mt-1 text-[11px] text-neutral-500">From your setup. These shape its capabilities; a system is only used once it&apos;s actually connected.</p>{systemChecks(qa("systems"))}</fieldset>
          <fieldset><legend className="text-xs font-medium text-neutral-300">What needs approval before anything is promised?</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{APPROVAL_OPTIONS.map(([v, l]) => <label key={v} className={optionCls}><input type="checkbox" name="needsApproval" value={v} defaultChecked={qa("needsApproval").length ? qa("needsApproval").includes(v) : true} className="mt-1 accent-amber-500" /><span className="text-neutral-100">{l}</span></label>)}</div><p className="mt-2 text-[11px] text-neutral-500">Refunds, contract changes, and financial commitments always need approval, whatever you pick.</p></fieldset>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-900 pt-5"><Link href="/app/voice-agent" className="text-xs text-neutral-500 hover:text-white">Cancel</Link><Button type="submit">Build my recommended agent</Button></div>
        </form>
      ) : null}

      {canEdit && mode === "self" ? (
        <form action={saveSelfAction} className="si-panel space-y-6 p-6" data-testid="voice-agent-self-form">
          <div><h2 className="text-lg font-semibold text-white">Configure your voice agent</h2><p className="mt-1 text-xs text-neutral-500">Everything here can be changed until you activate.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-neutral-300">Name<input name="name" required maxLength={40} defaultValue={agent?.name || ""} placeholder="e.g. Ava" className={inputCls} /></label>
            <label className="block text-xs font-medium text-neutral-300">Voice<select name="voice" defaultValue={agent?.voice || "Layla"} className={inputCls}>{VOICE_OPTIONS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
            <label className="block text-xs font-medium text-neutral-300">Tone<input name="tone" defaultValue={agent?.tone || ""} placeholder="Warm, calm, professional" className={inputCls} /></label>
            <label className="block text-xs font-medium text-neutral-300">Role<input name="role" defaultValue={agent?.role || ""} placeholder="Front desk for new and existing customers" className={inputCls} /></label>
          </div>
          <label className="block text-xs font-medium text-neutral-300">Greeting<input name="greeting" defaultValue={agent?.greeting || ""} placeholder={`Thank you for calling ${company}. This is Ava, our AI assistant. How can I help?`} className={inputCls} /></label>
          <label className="block text-xs font-medium text-neutral-300">Responsibilities <span className="font-normal text-neutral-500">(one per line)</span><textarea name="responsibilities" rows={4} defaultValue={agent ? (JSON.parse(agent.responsibilitiesJson) as string[]).join("\n") : ""} className={inputCls} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-neutral-300">Hours<input name="hours" defaultValue={agent?.hoursJson || ""} placeholder="Mon–Fri 8am–6pm ET" className={inputCls} /></label>
            <label className="block text-xs font-medium text-neutral-300">After-hours behavior<input name="afterHoursBehavior" defaultValue={agent?.afterHoursBehavior || ""} placeholder="Take a message; team follows up next business day" className={inputCls} /></label>
          </div>
          <label className="block text-xs font-medium text-neutral-300">Escalation rules <span className="font-normal text-neutral-500">(one per line — added to Kaivaryn&apos;s built-in handoff rules)</span><textarea name="escalationRules" rows={3} defaultValue={agent ? (JSON.parse(agent.escalationRulesJson) as string[]).join("\n") : ""} className={inputCls} /></label>
          <label className="block text-xs font-medium text-neutral-300">Approved knowledge <span className="font-normal text-neutral-500">(the only facts it may state)</span><textarea name="approvedKnowledge" rows={5} defaultValue={agent?.approvedKnowledge || ""} placeholder="Services, service area, policies, FAQs…" className={inputCls} /></label>
          <fieldset className="grid gap-3 sm:grid-cols-3"><legend className="mb-2 text-xs font-medium text-neutral-300">Phone</legend>
            <label className={optionCls}><input type="checkbox" name="wantsNumber" className="mt-1 accent-amber-500" defaultChecked={Boolean(agent?.phoneConfigJson && JSON.parse(agent.phoneConfigJson).wantsNumber)} /><span className="text-neutral-100">I&apos;d like a phone line for it</span></label>
            <input name="areaCode" placeholder="Preferred area code" defaultValue={agent?.phoneConfigJson ? JSON.parse(agent.phoneConfigJson).areaCode || "" : ""} className={inputCls} />
            <input name="forwardTo" placeholder="Number for handoffs" defaultValue={agent?.phoneConfigJson ? JSON.parse(agent.phoneConfigJson).forwardTo || "" : ""} className={inputCls} />
            <p className="text-[11px] text-neutral-500 sm:col-span-3">Kaivaryn arranges phone lines with you after activation; nothing is assigned automatically.</p>
          </fieldset>
          <div><p className="text-xs font-medium text-neutral-300">What it may do</p><p className="mb-2 mt-1 text-[11px] text-neutral-500">Safe by default. Levels are capped per capability.</p>{toolRows(agent ? tools : Object.fromEntries(CLIENT_TOOLS.map((t) => [t.key, t.defaultLevel])), false)}</div>
          <fieldset><legend className="mb-2 text-xs font-medium text-neutral-300">Business systems</legend>{systemChecks(agent ? JSON.parse(agent.systemsJson || "[]") : [])}</fieldset>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-900 pt-5"><Link href="/app/voice-agent" className="text-xs text-neutral-500 hover:text-white">Cancel</Link><Button type="submit">Save configuration</Button></div>
        </form>
      ) : null}

      {agent && !mode ? (
        <div className="space-y-5" data-testid="voice-agent-review">
          <div className="si-panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="si-label">Your AI employee</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{agent.name}</h2>
                <p className="mt-1 text-sm text-neutral-400">{agent.role || "Voice assistant"}</p>
              </div>
              <div className="text-right"><Badge tone={status === "active" ? "success" : status === "approved" ? "info" : status === "paused" ? "warning" : "default"}>{AGENT_STATUS_LABEL[status!] ?? status}</Badge><p className="mt-1 text-[11px] text-neutral-500">{agent.origin === "KAIVARYN_BUILT" ? "Built by Kaivaryn from your answers" : "Configured by your team"}</p></div>
            </div>
            <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div><p className="text-[11px] uppercase tracking-wider text-neutral-500">Greeting</p><p className="mt-1 text-neutral-200">“{agent.greeting || "—"}”</p></div>
              <div><p className="text-[11px] uppercase tracking-wider text-neutral-500">Voice · tone</p><p className="mt-1 text-neutral-200">{agent.voice || "—"} · {agent.tone || "—"}</p></div>
              <div><p className="text-[11px] uppercase tracking-wider text-neutral-500">Hours</p><p className="mt-1 text-neutral-200">{agent.hoursJson || "—"}</p></div>
              <div><p className="text-[11px] uppercase tracking-wider text-neutral-500">After hours</p><p className="mt-1 text-neutral-200">{agent.afterHoursBehavior || "—"}</p></div>
              <div><p className="text-[11px] uppercase tracking-wider text-neutral-500">Responsibilities</p><ul className="mt-1 list-disc space-y-0.5 pl-4 text-neutral-300">{(JSON.parse(agent.responsibilitiesJson) as string[]).map((r) => <li key={r}>{r}</li>)}</ul></div>
              <div><p className="text-[11px] uppercase tracking-wider text-neutral-500">Always goes to a person</p><ul className="mt-1 list-disc space-y-0.5 pl-4 text-neutral-300">{(JSON.parse(agent.escalationRulesJson) as string[]).map((r) => <li key={r}>{r}</li>)}<li className="text-neutral-500">Plus Kaivaryn&apos;s built-in rules: uncertainty, upset callers, sensitive financial or legal matters, unsupported requests, permission limits, consequential actions, and any request for a person.</li></ul></div>
              <div><p className="text-[11px] uppercase tracking-wider text-neutral-500">Phone line</p><p className="mt-1 text-neutral-200">Not assigned yet{agent.phoneConfigJson && JSON.parse(agent.phoneConfigJson).wantsNumber ? " — requested; Kaivaryn will arrange it with you" : ""}</p></div>
              <div><p className="text-[11px] uppercase tracking-wider text-neutral-500">Business systems</p><div className="mt-1 flex flex-wrap gap-1.5">{(JSON.parse(agent.systemsJson || "[]") as string[]).length ? (JSON.parse(agent.systemsJson) as string[]).map((s) => <Badge key={s} tone={STATE_TONE[systems.get(s) || "selected"]}>{SYSTEM_LABEL(s)} · {STATE_LABEL[systems.get(s) || "selected"]}</Badge>) : <span className="text-neutral-500">None selected</span>}</div></div>
            </div>
            {canEdit && status !== "active" ? <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-900 pt-4"><Link href="/app/voice-agent?mode=self" className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500">Edit details</Link><Link href="/app/voice-agent?mode=build" className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500">Rebuild from questionnaire</Link></div> : null}
          </div>

          <form action={toolLevelsAction} className="si-panel space-y-3 p-6">
            <input type="hidden" name="agentId" value={agent.id} />
            <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="si-label">What {agent.name} may do</p><p className="text-[11px] text-neutral-500">Read · Answer · Suggest · Draft · Execute · Needs approval</p></div>
            {toolRows(tools, !canEdit || status === "active")}
            {canEdit && status !== "active" ? <div className="flex justify-end"><Button type="submit" variant="outline" size="sm">Save action levels</Button></div> : null}
          </form>

          <details className="si-panel p-6"><summary className="cursor-pointer text-sm text-neutral-300">See the instructions Kaivaryn generated</summary><pre className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-neutral-400">{agent.systemPrompt}</pre></details>

          <div className="si-panel space-y-4 p-6">
            <p className="si-label">Next steps</p>
            {agent.provisionError ? <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">The last attempt to create the test assistant didn&apos;t succeed. Try again, or Kaivaryn will follow up.</p> : null}
            {status !== "active" && canVoice(role, "voice.agent.test") ? (
              <form action={provisionAction} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 p-4"><input type="hidden" name="agentId" value={agent.id} /><div><p className="text-sm text-white">{agent.providerAssistantId ? "Update the test assistant" : "Create a test assistant"}</p><p className="text-xs text-neutral-500">Builds a private test version of {agent.name} you can call from this browser. No phone line, nothing live.</p></div><Button type="submit" variant="outline" size="sm">{agent.providerAssistantId ? "Update test assistant" : "Create test assistant"}</Button></form>
            ) : null}
            {agent.providerAssistantId && canVoice(role, "voice.agent.test") ? <AgentPreviewCall agentId={agent.id} agentName={agent.name} /> : null}
            {canEdit && ["draft", "generated", "testing"].includes(status!) && !pendingApproval ? (
              <form action={submitAction} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 p-4"><input type="hidden" name="agentId" value={agent.id} /><div><p className="text-sm text-white">Send for approval</p><p className="text-xs text-neutral-500">An admin or owner approves it here or in Approvals.</p></div><Button type="submit" variant="outline" size="sm">Send for approval</Button></form>
            ) : null}
            {pendingApproval ? <p className="text-xs text-neutral-400">Waiting for approval · <Link href="/app/approvals" className="text-amber-400">open Approvals</Link></p> : null}
            {["in_review", "testing"].includes(status!) && canVoice(role, "voice.agent.approve") ? (
              <form action={approveAction} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 p-4"><input type="hidden" name="agentId" value={agent.id} /><div><p className="text-sm text-white">Approve this configuration</p><p className="text-xs text-neutral-500">Approving does not put it live. Activation is the next, separate step.</p></div><Button type="submit" size="sm">Approve</Button></form>
            ) : null}
            {status === "approved" && canVoice(role, "voice.agent.activate") ? (
              <form action={activateAction} className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4" data-testid="voice-agent-activate"><input type="hidden" name="agentId" value={agent.id} /><p className="text-sm text-white">Activate {agent.name}</p>
                {!agent.providerAssistantId ? <p className="text-xs text-amber-300">Create and test the assistant first.</p> : null}
                <label className="flex items-start gap-2 text-xs text-neutral-300"><input type="checkbox" name="confirm" value="yes" required className="mt-0.5 accent-amber-500" />I confirm {agent.name} may speak for {company} as configured above, and that anything needing approval will come to our team.</label>
                <Button type="submit" size="sm" disabled={!agent.providerAssistantId}>Activate</Button></form>
            ) : null}
            {status === "active" ? (
              <div className="space-y-3"><p className="text-sm text-emerald-300">{agent.name} is active. Phone line: not assigned yet — Kaivaryn connects a number with you as a separate step.</p>{canVoice(role, "voice.agent.activate") ? <form action={pauseAction}><input type="hidden" name="agentId" value={agent.id} /><Button type="submit" variant="outline" size="sm">Pause</Button></form> : null}</div>
            ) : null}
            {!canEdit ? <p className="text-xs text-neutral-500">You can view this agent. Managers and above can change it; admins and owners approve and activate.</p> : null}
          </div>
        </div>
      ) : null}

      <IncludedVoiceUsage usage={usage} />
    </div>
  );
}
