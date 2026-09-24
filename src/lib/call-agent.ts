import { prisma } from "@/lib/prisma";
import {
  addAcquisitionActivity,
  classifyResponseText,
  nextActionForResponse,
  stageForResponse,
} from "@/lib/acquisition";
import { createTwilioOutboundCall, twilioBaseUrl } from "@/lib/providers/twilio";
import { getPricingConfig } from "@/lib/pricing";

const CALLABLE_STAGES = new Set(["PREQUALIFIED", "QUALIFIED", "AUDITED", "OUTREACH_READY", "CONTACTED", "ENGAGED", "SALES_QUALIFIED"]);

function maxCallTurns() {
  const raw = Number(process.env.ACQUISITION_CALL_MAX_TURNS || "6");
  return Number.isFinite(raw) ? Math.min(10, Math.max(2, Math.floor(raw))) : 6;
}

export function isE164Phone(value?: string | null) {
  return Boolean(value && /^\+[1-9]\d{7,14}$/.test(value.trim()));
}

function safeJsonArray(value?: string | null): unknown[] {
  if (!value) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function contactLocalHour(timeZone: string, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hour12: false }).format(now));
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
  return { hour, weekday };
}

export async function getCallEligibility(accountId: string, contactId?: string | null) {
  const account = await prisma.acquisitionAccount.findUnique({
    where: { id: accountId },
    include: { contacts: true, calls: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!account) return { eligible: false, reason: "Account not found." } as const;
  const contact = contactId
    ? account.contacts.find((item) => item.id === contactId)
    : account.contacts.find((item) => item.isPrimary) || account.contacts.find((item) => item.phone);
  if (!contact?.phone) return { eligible: false, reason: "A contact phone number is required." } as const;
  if (!isE164Phone(contact.phone)) return { eligible: false, reason: "Phone number must use E.164 format, for example +17045551212." } as const;
  if (!contact.verified) return { eligible: false, reason: "Verify the contact before provider-backed calling." } as const;
  if (contact.doNotCallAt) return { eligible: false, reason: "Contact is on the do-not-call list." } as const;
  if (!contact.phoneConsentAt || !contact.phoneConsentSource) {
    return { eligible: false, reason: "Automated AI voice calls require recorded phone consent and its source." } as const;
  }
  if (!contact.timezone) return { eligible: false, reason: "Contact timezone is required before an automated call." } as const;
  if (!CALLABLE_STAGES.has(account.stage)) return { eligible: false, reason: `Account stage ${account.stage} is not eligible for acquisition calling.` } as const;
  if (account.qualificationScore < 75 || account.qualificationBand !== "PRIORITY") {
    return { eligible: false, reason: "AI calling is restricted to PRIORITY accounts scoring at least 75." } as const;
  }
  if (contact.authorityScore < 6) return { eligible: false, reason: "AI calling is restricted to decision-makers with authority score 6+." } as const;
  let local;
  try { local = contactLocalHour(contact.timezone); } catch { return { eligible: false, reason: "Contact timezone is invalid. Use an IANA timezone such as America/New_York." } as const; }
  const { hour, weekday } = local;
  if (["Sat", "Sun"].includes(weekday) || hour < 9 || hour >= 17) {
    return { eligible: false, reason: `Outside the configured weekday 9:00–17:00 calling window in ${contact.timezone}.` } as const;
  }
  const recent = account.calls.find((call) => call.contactId === contact.id && call.createdAt.getTime() > Date.now() - 72 * 60 * 60_000);
  if (recent) return { eligible: false, reason: "A call attempt already occurred within the last 72 hours." } as const;
  return { eligible: true, reason: "Qualified, verified, consented decision-maker within the call window.", account, contact } as const;
}

export async function startAcquisitionCall(accountId: string, contactId?: string | null) {
  const eligibility = await getCallEligibility(accountId, contactId);
  if (!eligibility.eligible) throw new Error(eligibility.reason);
  const { account, contact } = eligibility;
  const call = await prisma.acquisitionCall.create({
    data: {
      accountId: account.id,
      contactId: contact.id,
      provider: "TWILIO",
      status: "QUEUED",
      toNumber: contact.phone!,
      consentBasis: `${contact.phoneConsentSource} @ ${contact.phoneConsentAt!.toISOString()}`,
    },
  });
  try {
    const result = await createTwilioOutboundCall({ callId: call.id, to: contact.phone! });
    const updated = await prisma.acquisitionCall.update({
      where: { id: call.id },
      data: { providerCallId: result.sid, status: result.status.toUpperCase(), fromNumber: result.from },
    });
    await addAcquisitionActivity(account.id, "AI_CALL_STARTED", `Consent-gated AI call started for ${contact.name || contact.email || contact.phone}.`, {
      callId: call.id,
      providerCallId: result.sid,
    });
    return updated;
  } catch (error) {
    await prisma.acquisitionCall.update({ where: { id: call.id }, data: { status: "FAILED", endedAt: new Date() } }).catch(() => undefined);
    throw error;
  }
}

export async function getCallOpening(callId: string) {
  const call = await prisma.acquisitionCall.findUnique({
    where: { id: callId },
    include: {
      account: { include: { microAudits: { orderBy: { createdAt: "desc" }, take: 1 } } },
      contact: true,
    },
  });
  if (!call) throw new Error("Call not found.");
  const firstName = call.contact?.name?.split(/\s+/)[0] || "there";
  const signal = call.account.microAudits[0]?.observation || call.account.painSummary || "your current workflow";
  return `Hi ${firstName}, this is Kaivaryn's AI assistant. This is an automated business call. I wanted to ask one quick question about ${signal.replace(/^Observable signal:\s*/i, "").replace(/[.]+$/, "")}. Is now a bad time for a brief question?`;
}

function deterministicCallReply(classification: string, account: { company: string }, currentPriceCents: number) {
  switch (classification) {
    case "UNSUBSCRIBE": return { text: "Understood. I will mark this number do-not-call and end the outreach. Take care.", finish: true, disposition: "DO_NOT_CALL" };
    case "NOT_INTERESTED": return { text: "Understood. I won't keep you. Thank you for the clear answer, and have a good day.", finish: true, disposition: "NOT_INTERESTED" };
    case "NOT_NOW": return { text: "That makes sense. I’ll note that the timing is not right and leave this for a later follow-up rather than pushing now. Thanks for your time.", finish: true, disposition: "NURTURE" };
    case "MEETING_REQUEST": return { text: "Absolutely. I’ll mark this for an executive demo and have the calendar invitation handled through the verified contact information on file. Thank you.", finish: true, disposition: "MEETING_REQUEST" };
    case "PRICING": {
      const price = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(currentPriceCents / 100);
      return { text: `The current Kaivaryn engagement price is ${price} per month, but we do not recommend implementation until the economics justify it. Roughly how often does the problem happen and what does it cost when it does?`, finish: false, disposition: "ENGAGED" };
    }
    case "TECHNICAL": return { text: "That is a fair diligence question. I’ll keep the answer tied to the actual architecture rather than guess. What is the specific integration, security, or data concern you need resolved first?", finish: false, disposition: "ENGAGED" };
    case "OBJECTION": return { text: "Understood. I don’t want to argue past the blocker. What is the main issue for you: the business case, implementation risk, timing, or your current vendor?", finish: false, disposition: "ENGAGED" };
    case "INTERESTED":
    case "CURIOUS": return { text: `Good. The useful question for ${account.company} is whether the observed issue is economically material. How often does it happen in a normal month, and what is the operational or revenue impact when it does?`, finish: false, disposition: "ENGAGED" };
    default: return { text: `Thanks. I want to keep this specific to ${account.company}. What would have to be true for solving this problem to be worth an executive demo?`, finish: false, disposition: "ENGAGED" };
  }
}

async function generateModelReply(input: {
  company: string;
  contactName: string | null;
  painSummary: string | null;
  economicHypothesis: string | null;
  latestAudit: string | null;
  currentPriceCents: number;
  conversation: Array<{ speaker: string; text: string }>;
  prospectText: string;
  deterministicFallback: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return input.deterministicFallback;
  const model = process.env.OPENAI_CALL_MODEL || "gpt-5.6-luna";
  const system = [
    "You are Kaivaryn's disclosed AI business-development call assistant.",
    "Speak naturally and briefly: one or two sentences, then one focused question at most.",
    "Never pretend to be human. Never invent facts, customer results, losses, urgency, discounts, integrations, or authority.",
    "Use reverse selling: validate the economics before recommending implementation.",
    "If the prospect asks to stop, says do not call, or opts out, acknowledge and end immediately.",
    "Do not collect payment, card numbers, passwords, secrets, SSNs, medical information, or other sensitive data.",
    "Do not pressure the prospect. If they are not interested or timing is wrong, end politely.",
    "If they request a meeting, confirm that a calendar follow-up will be sent; do not invent a booked time.",
  ].join(" ");
  const context = JSON.stringify({
    company: input.company,
    contactName: input.contactName,
    painSummary: input.painSummary,
    economicHypothesis: input.economicHypothesis,
    latestAudit: input.latestAudit,
    currentPriceCents: input.currentPriceCents,
    recentConversation: input.conversation.slice(-6),
    latestProspectUtterance: input.prospectText,
  });
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: system,
        input: context,
        max_output_tokens: 120,
        reasoning: { effort: "none" },
      }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return input.deterministicFallback;
    const direct = typeof payload?.output_text === "string" ? payload.output_text.trim() : "";
    if (direct) return direct;
    const parts = Array.isArray(payload?.output) ? payload.output.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || []) : [];
    const text = parts.map((part: { text?: string }) => part.text || "").join(" ").trim();
    return text || input.deterministicFallback;
  } catch {
    return input.deterministicFallback;
  }
}

export async function processCallTurn(callId: string, prospectText: string) {
  const call = await prisma.acquisitionCall.findUnique({
    where: { id: callId },
    include: {
      account: { include: { microAudits: { orderBy: { createdAt: "desc" }, take: 1 } } },
      contact: true,
    },
  });
  if (!call) throw new Error("Call not found.");
  const classification = classifyResponseText(prospectText);
  const existingTurns = safeJsonArray(call.turnsJson) as Array<{ speaker: string; text: string; at?: string }>;
  const prospectTurnCount = existingTurns.filter((turn) => turn.speaker === "prospect").length;
  if (prospectTurnCount >= maxCallTurns() && !["UNSUBSCRIBE", "NOT_INTERESTED", "NOT_NOW", "MEETING_REQUEST"].includes(classification)) {
    const handoffText = "Thanks for the context. I have enough to hand this back to the Kaivaryn team rather than keep you on an automated call. We’ll follow up only through the contact path you’ve agreed to.";
    const cappedTurns = [...existingTurns,
      { speaker: "prospect", text: prospectText, at: new Date().toISOString() },
      { speaker: "kaivaryn_ai", text: handoffText, at: new Date().toISOString() },
    ];
    await prisma.acquisitionCall.update({
      where: { id: call.id },
      data: { turnsJson: JSON.stringify(cappedTurns), disposition: "MAX_TURNS_HANDOFF", status: "COMPLETED", endedAt: new Date(), summary: `Call reached the ${maxCallTurns()}-turn automation ceiling.` },
    });
    await prisma.acquisitionAccount.update({ where: { id: call.accountId }, data: { nextAction: "Review the AI call transcript and choose the next human follow-up step." } });
    await addAcquisitionActivity(call.accountId, "AI_CALL_HANDOFF", "AI call reached its configured turn ceiling and handed the conversation back for review.", { callId: call.id });
    return { text: handoffText, finish: true, classification, disposition: "MAX_TURNS_HANDOFF" };
  }
  const [pricing, paidClients] = await Promise.all([
    getPricingConfig(),
    prisma.acquisitionAccount.count({ where: { paymentStatus: "PAID" } }),
  ]);
  const currentPriceCents = paidClients < pricing.introductorySeats ? pricing.introductoryPriceCents : pricing.standardPriceCents;
  const turns = existingTurns;
  turns.push({ speaker: "prospect", text: prospectText, at: new Date().toISOString() });
  const fallback = deterministicCallReply(classification, call.account, currentPriceCents);
  const highPriorityFinish = ["UNSUBSCRIBE", "NOT_INTERESTED", "NOT_NOW", "MEETING_REQUEST"].includes(classification);
  const replyText = highPriorityFinish ? fallback.text : await generateModelReply({
    company: call.account.company,
    contactName: call.contact?.name || null,
    painSummary: call.account.painSummary,
    economicHypothesis: call.account.economicHypothesis,
    latestAudit: call.account.microAudits[0]?.reverseSellMessage || null,
    currentPriceCents,
    conversation: turns,
    prospectText,
    deterministicFallback: fallback.text,
  });
  turns.push({ speaker: "kaivaryn_ai", text: replyText, at: new Date().toISOString() });

  const finish = highPriorityFinish || fallback.finish;
  const disposition = fallback.disposition || classification;
  await prisma.acquisitionCall.update({
    where: { id: call.id },
    data: {
      turnsJson: JSON.stringify(turns),
      disposition,
      status: finish ? "COMPLETED" : "IN_PROGRESS",
      endedAt: finish ? new Date() : undefined,
      summary: `Latest response classified as ${classification}.`,
    },
  });

  const nextStage = stageForResponse(call.account.stage, classification);
  await prisma.acquisitionAccount.update({
    where: { id: call.accountId },
    data: { stage: nextStage, nextAction: nextActionForResponse(classification) },
  });
  if (classification === "UNSUBSCRIBE" && call.contactId) {
    await prisma.acquisitionContact.update({ where: { id: call.contactId }, data: { doNotCallAt: new Date() } });
  }
  await addAcquisitionActivity(call.accountId, "AI_CALL_TURN", `Call response classified as ${classification}.`, {
    callId: call.id,
    classification,
    finish,
  });
  return { text: replyText, finish, classification, disposition };
}

export async function markCallStatus(callId: string, input: { callSid?: string | null; callStatus?: string | null; duration?: string | null }) {
  const current = await prisma.acquisitionCall.findUnique({ where: { id: callId } });
  if (!current) return null;
  const status = (input.callStatus || current.status).toUpperCase();
  const startedAt = ["IN-PROGRESS", "IN_PROGRESS", "ANSWERED"].includes(status) && !current.startedAt ? new Date() : current.startedAt;
  const terminal = ["COMPLETED", "BUSY", "NO-ANSWER", "NO_ANSWER", "FAILED", "CANCELED"].includes(status);
  const updated = await prisma.acquisitionCall.update({
    where: { id: callId },
    data: {
      providerCallId: current.providerCallId || input.callSid || undefined,
      status,
      startedAt,
      endedAt: terminal ? current.endedAt || new Date() : current.endedAt,
    },
  });
  if (terminal) {
    await addAcquisitionActivity(updated.accountId, "AI_CALL_STATUS", `AI call ended with status ${status}.`, { callId, providerCallId: updated.providerCallId });
  }
  return updated;
}

export async function callAgentContext(callId: string) {
  const call = await prisma.acquisitionCall.findUnique({ where: { id: callId }, include: { account: true, contact: true } });
  if (!call) throw new Error("Call not found.");
  const pricing = await getPricingConfig();
  return {
    call,
    pricing,
    turnUrl: `${twilioBaseUrl()}/api/acquisition/calls/turn?callId=${encodeURIComponent(callId)}`,
  };
}
