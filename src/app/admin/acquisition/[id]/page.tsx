import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { authorityScore, buildCheckoutLink, deriveAcquisitionDirective } from "@/lib/acquisition";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  addContactAction,
  addIntentSignalAction,
  generateMicroAuditAction,
  markDemoBookedAction,
  markDemoCompletedAction,
  recordInboundResponseAction,
  runQualificationAction,
  saveOutreachAction,
  saveResearchAction,
  saveSecondaryQualificationAction,
  updateAcquisitionAccount,
} from "../actions";

export const dynamic = "force-dynamic";

const parseArray = (value?: string | null) => {
  if (!value) return [] as string[];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
};

export default async function AcquisitionAccountPage({ params }: { params: { id: string } }) {
  const account = await prisma.acquisitionAccount.findUnique({
    where: { id: params.id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      intentSignals: { orderBy: { occurredAt: "desc" } },
      qualificationSnapshots: { orderBy: { createdAt: "desc" }, take: 5 },
      research: true,
      microAudits: { orderBy: { createdAt: "desc" }, take: 5 },
      outreachMessages: { orderBy: { createdAt: "desc" }, take: 10 },
      activities: { orderBy: { createdAt: "desc" }, take: 40 },
      paymentEvents: { orderBy: { createdAt: "desc" }, take: 10 },
      demoRequest: true,
      onboardingOrganization: true,
    },
  });
  if (!account) notFound();
  const checkoutLink = await buildCheckoutLink(account.id);
  const publicCheckoutUrl = account.checkoutToken ? `/engage/${account.checkoutToken}` : null;
  const latestScore = account.qualificationSnapshots[0];
  const latestAudit = account.microAudits[0];
  const latestOutreach = account.outreachMessages[0];
  const dealValue = account.estimatedDealValueCents ? formatCurrency(account.estimatedDealValueCents / 100) : "Not modeled";
  const secondary = account.secondaryQualificationJson ? (() => { try { return JSON.parse(account.secondaryQualificationJson) as Record<string, unknown>; } catch { return {}; } })() : {};
  const latestResponseClass = account.outreachMessages.find((message) => message.responseClass)?.responseClass || null;
  const directive = deriveAcquisitionDirective({
    stage: account.stage,
    qualificationBand: account.qualificationBand,
    qualificationScore: account.qualificationScore,
    hasDecisionMaker: account.contacts.some((contact) => contact.authorityScore >= 6) || authorityScore(account.primaryTitle) >= 6,
    hasResearch: account.research?.status === "COMPLETE",
    hasAudit: Boolean(latestAudit),
    hasOutreach: account.outreachMessages.some((message) => !message.responseClass),
    latestResponseClass,
    salesQualified: secondary.salesQualified === true,
    demoCompleted: Boolean(account.demoCompletedAt),
    checkoutReady: Boolean(account.checkoutReadyAt),
    paymentStatus: account.paymentStatus,
    onboardingProvisioned: Boolean(account.onboardingOrganizationId),
  });

  return (
    <div>
      <Link href="/admin/acquisition" className="text-xs text-neutral-500 hover:text-white">← Acquisition command center</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-400">{account.stage}</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{account.company}</h1>
          <p className="mt-2 text-sm text-neutral-400">{account.domain || "No domain"} · {account.industry || "Industry unknown"} · {account.companySize || "Size unknown"}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="si-panel px-4 py-3"><p className="text-[10px] uppercase text-neutral-500">Intent</p><p className="mt-1 text-xl font-semibold">{account.intentScore}</p></div>
          <div className="si-panel px-4 py-3"><p className="text-[10px] uppercase text-neutral-500">Qualification</p><p className="mt-1 text-xl font-semibold">{account.qualificationScore}</p></div>
          <div className="si-panel px-4 py-3"><p className="text-[10px] uppercase text-neutral-500">Deal</p><p className="mt-1 text-sm font-semibold">{dealValue}</p></div>
        </div>
      </div>

      <div className="si-panel mt-5 border border-amber-500/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400">Next best action</p>
            <h2 className="mt-2 text-lg font-semibold text-white">{directive.action}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">{directive.reason}</p>
            {account.nextAction ? <p className="mt-3 text-xs text-neutral-500">Recorded response action: <span className="text-neutral-300">{account.nextAction}</span></p> : null}
          </div>
          <span className="rounded-full border border-amber-500/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">{directive.priority}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <form action={updateAcquisitionAccount.bind(null, account.id)} className="si-panel p-5">
          <h2 className="font-semibold text-white">Account + commercial context</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input name="industry" defaultValue={account.industry || ""} placeholder="Industry" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <input name="companySize" defaultValue={account.companySize || ""} placeholder="Company size" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <input name="primaryName" defaultValue={account.primaryName || ""} placeholder="Primary decision-maker" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <input name="primaryTitle" defaultValue={account.primaryTitle || ""} placeholder="Title" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <input type="email" name="primaryEmail" defaultValue={account.primaryEmail || ""} placeholder="Work email" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <select name="selectedProduct" defaultValue={account.selectedProduct || ""} className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm"><option value="">Product not decided</option><option value="REVENUE_RECOVERY">Revenue Recovery</option><option value="OPERATIONS_EFFICIENCY">Operations Efficiency</option><option value="BOTH">Both</option></select>
            <input type="number" min="0" step="100" name="estimatedDealValue" defaultValue={account.estimatedDealValueCents ? account.estimatedDealValueCents / 100 : ""} placeholder="Estimated deal value ($)" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
          </div>
          <textarea name="painSummary" defaultValue={account.painSummary || ""} placeholder="Observed / stated pain. Keep facts separate from inference." rows={4} className="mt-3 w-full rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm" />
          <textarea name="economicHypothesis" defaultValue={account.economicHypothesis || ""} placeholder="Economic hypothesis (modeled, not claimed as fact)" rows={3} className="mt-3 w-full rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm" />
          <button className="mt-3 rounded-md border border-neutral-700 px-4 py-2 text-sm text-white hover:bg-neutral-900">Save account intelligence</button>
        </form>

        <div className="si-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold text-white">Pre-qualification</h2><p className="mt-1 text-xs text-neutral-500">ICP 25 · intent 25 · pain 20 · economics 15 · authority 10 · timing 5</p></div>
            <form action={runQualificationAction.bind(null, account.id)}><button className="rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-neutral-950">Re-score account</button></form>
          </div>
          {latestScore ? (
            <div className="mt-4">
              <div className="flex items-end gap-3"><p className="text-4xl font-semibold text-white">{latestScore.total}</p><p className={`pb-1 text-sm font-semibold ${latestScore.band === "PRIORITY" ? "text-emerald-400" : latestScore.band === "NURTURE" ? "text-amber-400" : "text-neutral-400"}`}>{latestScore.band}</p></div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-neutral-400 sm:grid-cols-6">
                {[['ICP', latestScore.icpFit, 25], ['Intent', latestScore.intentStrength, 25], ['Pain', latestScore.painOpportunity, 20], ['Economics', latestScore.economicValue, 15], ['Authority', latestScore.decisionMakerAccess, 10], ['Timing', latestScore.timingUrgency, 5]].map(([label, score, max]) => <div key={String(label)} className="rounded-lg border border-neutral-800 p-2"><p>{label}</p><p className="mt-1 text-white">{score}/{max}</p></div>)}
              </div>
              <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-neutral-900 bg-black/30 p-3 text-[11px] leading-5 text-neutral-400">{JSON.stringify(JSON.parse(latestScore.reasoningJson), null, 2)}</pre>
            </div>
          ) : <p className="mt-4 text-sm text-neutral-500">No qualification snapshot yet.</p>}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="si-panel p-5">
          <h2 className="font-semibold text-white">Decision-makers + enrichment</h2>
          <div className="mt-4 space-y-3">
            {account.contacts.map((contact) => <div key={contact.id} className="rounded-lg border border-neutral-900 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium text-white">{contact.name || contact.email || "Unnamed contact"}</p><p className="mt-1 text-xs text-neutral-500">{contact.title || "Title unknown"}{contact.email ? ` · ${contact.email}` : ""}</p></div><span className="rounded-full border border-neutral-800 px-2 py-1 text-[10px] text-neutral-400">authority {contact.authorityScore}/10{contact.verified ? " · verified" : ""}</span></div>{contact.publicProfile ? <a href={contact.publicProfile} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-amber-400">Public profile ↗</a> : null}</div>)}
            {!account.contacts.length ? <p className="text-sm text-neutral-500">No decision-makers enriched yet.</p> : null}
          </div>
        </div>
        <form action={addContactAction.bind(null, account.id)} className="si-panel p-5">
          <h2 className="font-semibold text-white">Add / update contact</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><input name="name" placeholder="Name" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" /><input name="title" placeholder="Title" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" /><input name="email" type="email" placeholder="Work email" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" /><input name="phone" placeholder="Phone" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" /><input name="publicProfile" type="url" placeholder="Public profile URL" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm sm:col-span-2" /></div>
          <label className="mt-3 flex items-center gap-2 text-xs text-neutral-400"><input type="checkbox" name="verified" className="accent-amber-500" /> Contact data verified against a legitimate source</label>
          <input type="hidden" name="source" value="MANUAL_RESEARCH" />
          <button className="mt-3 rounded-md border border-neutral-700 px-4 py-2 text-sm text-white">Save contact + re-score</button>
        </form>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <form action={addIntentSignalAction.bind(null, account.id)} className="si-panel p-5">
          <h2 className="font-semibold text-white">Add legitimate intent signal</h2>
          <p className="mt-1 text-xs leading-5 text-neutral-500">Record a public, first-party, permissioned, or provider-supplied signal. Private search behavior is never inferred without an authorized data source.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input name="type" required placeholder="AI_AUTOMATION_HIRING" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <input name="category" required placeholder="HIRING / FUNDING / ENGAGEMENT" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <input name="source" required placeholder="Company careers page" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <input name="sourceUrl" type="url" placeholder="Evidence URL" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <label className="text-xs text-neutral-400">Strength 0–100<input name="strength" type="number" min="0" max="100" defaultValue="70" className="mt-1 h-10 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" /></label>
            <label className="text-xs text-neutral-400">Confidence 0–100<input name="confidence" type="number" min="0" max="100" defaultValue="80" className="mt-1 h-10 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" /></label>
          </div>
          <textarea name="evidence" required rows={3} placeholder="What was actually observed?" className="mt-3 w-full rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm" />
          <button className="mt-3 rounded-md border border-neutral-700 px-4 py-2 text-sm text-white">Add signal + re-score</button>
        </form>

        <div className="si-panel p-5">
          <h2 className="font-semibold text-white">Intent history</h2>
          <div className="mt-4 space-y-3">
            {account.intentSignals.map((signal) => <div key={signal.id} className="rounded-lg border border-neutral-900 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium text-white">{signal.type}</p><p className="text-xs text-neutral-500">{signal.strength} strength · {signal.confidence} confidence</p></div><p className="mt-1 text-xs text-neutral-400">{signal.category} · {signal.source} · {formatDate(signal.occurredAt)}</p>{signal.evidence ? <p className="mt-2 text-sm leading-6 text-neutral-300">{signal.evidence}</p> : null}{signal.sourceUrl ? <a href={signal.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-amber-400">Open evidence ↗</a> : null}</div>)}
            {!account.intentSignals.length ? <p className="text-sm text-neutral-500">No intent signals recorded.</p> : null}
          </div>
        </div>
      </div>

      <form action={saveResearchAction.bind(null, account.id)} className="si-panel mt-5 p-5">
        <h2 className="font-semibold text-white">Account research — facts separated from hypotheses</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div><label className="text-xs text-neutral-500">Business model</label><textarea name="businessModel" defaultValue={account.research?.businessModel || ""} rows={3} className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm" /></div>
          <div><label className="text-xs text-neutral-500">Revenue model</label><textarea name="revenueModel" defaultValue={account.research?.revenueModel || ""} rows={3} className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm" /></div>
          <div><label className="text-xs text-emerald-400">Verified facts — one per line</label><textarea name="verifiedFacts" defaultValue={parseArray(account.research?.verifiedFactsJson).join("\n")} rows={6} className="mt-1 w-full rounded-md border border-emerald-900/60 bg-neutral-950 p-3 text-sm" /></div>
          <div><label className="text-xs text-amber-400">Model / analyst hypotheses — one per line</label><textarea name="hypotheses" defaultValue={parseArray(account.research?.hypothesesJson).join("\n")} rows={6} className="mt-1 w-full rounded-md border border-amber-900/60 bg-neutral-950 p-3 text-sm" /></div>
          <div><label className="text-xs text-neutral-500">Pain hypotheses — one per line</label><textarea name="painHypotheses" defaultValue={parseArray(account.research?.painHypothesesJson).join("\n")} rows={5} className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm" /></div>
          <div><label className="text-xs text-neutral-500">Evidence / source notes — one per line</label><textarea name="evidence" defaultValue={parseArray(account.research?.evidenceJson).join("\n")} rows={5} className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm" /></div>
          <div className="lg:col-span-2"><label className="text-xs text-neutral-500">Observed technology — one per line</label><textarea name="techStack" defaultValue={parseArray(account.research?.techStackJson).join("\n")} rows={3} className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm" /></div>
        </div>
        <button className="mt-4 rounded-md border border-neutral-700 px-4 py-2 text-sm text-white">Save research + re-score</button>
      </form>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="si-panel p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Micro-audit + reverse selling</h2><p className="mt-1 text-xs text-neutral-500">Insight before pitch. Facts stay labeled; economic impact remains a hypothesis until validated.</p></div><form action={generateMicroAuditAction.bind(null, account.id)}><button className="rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-neutral-950">Generate</button></form></div>
          {latestAudit ? <div className="mt-4 space-y-3 text-sm"><div><p className="text-xs uppercase text-neutral-500">Observation</p><p className="mt-1 leading-6 text-neutral-200">{latestAudit.observation}</p></div><div><p className="text-xs uppercase text-neutral-500">Evidence</p><p className="mt-1 leading-6 text-neutral-400">{latestAudit.evidenceSummary}</p></div><div><p className="text-xs uppercase text-neutral-500">Economic hypothesis</p><p className="mt-1 leading-6 text-neutral-300">{latestAudit.economicHypothesis}</p></div><div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3"><p className="text-xs uppercase text-amber-400">Reverse-selling message</p><p className="mt-2 whitespace-pre-wrap leading-6 text-neutral-200">{latestAudit.reverseSellMessage}</p></div></div> : <p className="mt-4 text-sm text-neutral-500">Generate after recording enough evidence to make the outreach specific.</p>}
        </div>

        <div className="si-panel p-5">
          <h2 className="font-semibold text-white">Outreach / response intelligence</h2>
          {latestOutreach ? <form action={saveOutreachAction.bind(null, account.id, latestOutreach.id)} className="mt-4"><input name="subject" defaultValue={latestOutreach.subject || ""} className="h-10 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" /><textarea name="body" defaultValue={latestOutreach.body} rows={9} className="mt-3 w-full rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm" /><div className="mt-3 grid gap-3 sm:grid-cols-2"><select name="status" defaultValue={latestOutreach.status} className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm">{["DRAFT","QUEUED","SENT","PAUSED","COMPLETED","UNSUBSCRIBED"].map(v => <option key={v}>{v}</option>)}</select><select name="responseClass" defaultValue={latestOutreach.responseClass || ""} className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm"><option value="">No response classification</option>{["INTERESTED","CURIOUS","NEEDS_INFORMATION","PRICING","TECHNICAL","OBJECTION","NOT_NOW","REFERRAL","WRONG_PERSON","NOT_INTERESTED","UNSUBSCRIBE","MEETING_REQUEST","OTHER"].map(v => <option key={v}>{v}</option>)}</select></div><button className="mt-3 rounded-md border border-neutral-700 px-4 py-2 text-sm text-white">Save outreach state</button></form> : <p className="mt-4 text-sm text-neutral-500">A reverse-selling outreach draft is created with the micro-audit.</p>}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <form action={recordInboundResponseAction.bind(null, account.id)} className="si-panel p-5">
          <h2 className="font-semibold text-white">Inbound response intelligence</h2>
          <p className="mt-1 text-xs text-neutral-500">Paste the prospect&apos;s response. Kaivaryn classifies intent deterministically and updates the acquisition state without inventing details.</p>
          <select name="channel" className="mt-4 h-10 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm"><option>EMAIL</option><option>LINKEDIN</option><option>PHONE_NOTE</option><option>OTHER</option></select>
          <textarea required name="response" rows={7} placeholder="Paste inbound response here…" className="mt-3 w-full rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm" />
          <button className="mt-3 rounded-md border border-neutral-700 px-4 py-2 text-sm text-white">Classify + record response</button>
          {account.outreachMessages.find((m) => m.responseClass) ? <p className="mt-3 text-xs text-neutral-400">Latest classification: <span className="text-amber-400">{account.outreachMessages.find((m) => m.responseClass)?.responseClass}</span></p> : null}
        </form>

        <form action={saveSecondaryQualificationAction.bind(null, account.id)} className="si-panel p-5">
          <h2 className="font-semibold text-white">Secondary qualification</h2>
          <p className="mt-1 text-xs text-neutral-500">Need, authority, economics, timing, current solution, and cost of doing nothing—captured conversationally after engagement.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><input name="need" defaultValue={String(secondary.need || "")} placeholder="Validated need" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" /><input name="economicCost" defaultValue={String(secondary.economicCost || "")} placeholder="Economic cost / value" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" /><input name="authority" defaultValue={String(secondary.authority || "")} placeholder="Authority / economic buyer" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" /><input name="budgetSignal" defaultValue={String(secondary.budgetSignal || "")} placeholder="Budget signal" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" /><input name="timing" defaultValue={String(secondary.timing || "")} placeholder="Timing" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" /><input name="currentSolution" defaultValue={String(secondary.currentSolution || "")} placeholder="Current solution / process" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" /></div>
          <textarea name="stakeholders" defaultValue={String(secondary.stakeholders || "")} rows={2} placeholder="Stakeholders — one per line" className="mt-3 w-full rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm" />
          <textarea name="costOfInaction" defaultValue={String(secondary.costOfInaction || "")} rows={2} placeholder="What happens if they do nothing?" className="mt-3 w-full rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm" />
          <textarea name="implementationConstraints" defaultValue={String(secondary.implementationConstraints || "")} rows={2} placeholder="Implementation constraints" className="mt-3 w-full rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm" />
          <textarea name="objections" defaultValue={parseArray(account.objectionsJson).join("\n")} rows={2} placeholder="Objections — one per line" className="mt-3 w-full rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm" />
          <input name="nextAction" defaultValue={account.nextAction || ""} placeholder="Next best action" className="mt-3 h-10 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
          <label className="mt-3 flex items-center gap-2 text-xs text-neutral-300"><input type="checkbox" name="salesQualified" defaultChecked={secondary.salesQualified === true} className="accent-amber-500" /> Sales-qualified for executive demo / commercial decision</label>
          <button className="mt-3 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950">Save secondary qualification</button>
        </form>
      </div>

      <div className="si-panel mt-5 p-5">
        <h2 className="font-semibold text-white">Demo → Stripe → immediate onboarding</h2>
        <p className="mt-1 text-sm text-neutral-400">The public Stripe checkout is deliberately gated. Completing the demo creates a private engagement URL; server-side Stripe webhook verification provisions the client workspace and entitlements.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {!['DEMO_BOOKED','DEMO_COMPLETED','CHECKOUT_READY','PAYMENT_SUCCEEDED','ONBOARDING','ACTIVE'].includes(account.stage) ? <form action={markDemoBookedAction.bind(null, account.id)}><button className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-white">Mark demo booked</button></form> : null}
          {!account.demoCompletedAt ? <form action={markDemoCompletedAction.bind(null, account.id)}><button className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950">Mark demo completed + unlock Stripe</button></form> : null}
          {publicCheckoutUrl ? <Link href={publicCheckoutUrl} target="_blank" className="rounded-md border border-amber-500/40 px-4 py-2 text-sm text-amber-300">Open client checkout gate ↗</Link> : null}
          {account.onboardingOrganizationId ? <Link href={`/admin/orgs`} className="rounded-md border border-emerald-500/30 px-4 py-2 text-sm text-emerald-300">Workspace provisioned: {account.onboardingOrganization?.name || account.onboardingOrganizationId}</Link> : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-neutral-900 p-3"><p className="text-[10px] uppercase text-neutral-500">Demo</p><p className="mt-1 text-sm text-white">{account.demoCompletedAt ? `Completed ${formatDate(account.demoCompletedAt)}` : account.stage === 'DEMO_BOOKED' ? 'Booked' : 'Not completed'}</p></div>
          <div className="rounded-lg border border-neutral-900 p-3"><p className="text-[10px] uppercase text-neutral-500">Checkout</p><p className="mt-1 text-sm text-white">{checkoutLink ? 'Unlocked' : 'Locked'}</p></div>
          <div className="rounded-lg border border-neutral-900 p-3"><p className="text-[10px] uppercase text-neutral-500">Payment</p><p className="mt-1 text-sm text-white">{account.paymentStatus}</p></div>
          <div className="rounded-lg border border-neutral-900 p-3"><p className="text-[10px] uppercase text-neutral-500">Onboarding</p><p className="mt-1 text-sm text-white">{account.onboardingOrganizationId ? 'Provisioned' : 'Waiting for verified payment'}</p></div>
        </div>
        {checkoutLink ? <p className="mt-3 text-xs text-neutral-500">Stripe link generated with this account&apos;s private checkout token as <code>client_reference_id</code>. Configure the Payment Link&apos;s post-payment redirect to <code>/activate</code>; the webhook remains the source of truth for payment.</p> : null}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="si-panel p-5"><h2 className="font-semibold text-white">Timeline</h2><div className="mt-4 space-y-3">{account.activities.map((event) => <div key={event.id} className="border-l border-neutral-800 pl-3"><p className="text-xs font-medium text-neutral-200">{event.type}</p><p className="mt-1 text-sm text-neutral-400">{event.summary}</p><p className="mt-1 text-[10px] text-neutral-600">{formatDate(event.createdAt)}</p></div>)}</div></div>
        <div className="si-panel p-5"><h2 className="font-semibold text-white">Payment events</h2><div className="mt-4 space-y-3">{account.paymentEvents.map((event) => <div key={event.id} className="rounded-lg border border-neutral-900 p-3"><p className="text-sm text-white">{event.type}</p><p className="mt-1 text-xs text-neutral-500">{event.amountCents ? formatCurrency(event.amountCents / 100) : 'Amount not supplied'} · {event.eventId}</p></div>)}{!account.paymentEvents.length ? <p className="text-sm text-neutral-500">No verified Stripe payment events yet.</p> : null}</div></div>
      </div>
    </div>
  );
}
