/**
 * Call normalisation: provider call → sanitized VoiceCall fields. Only whitelisted fields are kept
 * (no raw payloads, recordings URLs, or secrets reach the database or UI). Analysis comes from the
 * provider when present ("provider"), otherwise from deterministic transcript rules ("derived").
 */
import { prisma } from "@/lib/prisma";
import type { VapiCall } from "./vapi-client";
import { recomputeUsage } from "./usage";

export type TranscriptTurn = { role: "assistant" | "caller" | "tool"; text: string; at?: number };

const clip = (s: unknown, n: number) => (typeof s === "string" && s.trim() ? s.trim().slice(0, n) : null);

/** Strip anything that looks like a credential or kv token from free text before storage. */
export function scrubText(s: string): string {
  return s
    .replace(/kv1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[token]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[token]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[number removed]");
}

export function transcriptTurns(call: VapiCall): TranscriptTurn[] {
  const msgs = (call.artifact?.messages || call.messages || []) as Array<Record<string, unknown>>;
  const out: TranscriptTurn[] = [];
  for (const m of msgs) {
    const role = String(m.role || "");
    const text = typeof m.message === "string" ? m.message : typeof m.content === "string" ? m.content : "";
    if (!text.trim()) continue;
    if (role === "system") continue;
    const r: TranscriptTurn["role"] = role === "bot" || role === "assistant" ? "assistant" : role === "user" ? "caller" : "tool";
    if (r === "tool") continue; // tool payloads stay server-side
    out.push({ role: r, text: scrubText(text).slice(0, 2000), at: typeof m.secondsFromStart === "number" ? Math.round(m.secondsFromStart) : undefined });
  }
  return out.slice(0, 400);
}

const RR_WORDS = /\b(revenue|billing|underbill|invoice|leak|leakage|underpay|payer|claims?|denial|pricing|discount|renewal|collections?|receivables?|cash|margin|recover)/i;
const OE_WORDS = /\b(manual|process|workflow|automat|efficien|bottleneck|rework|duplicate|spreadsheet|operations?|throughput|backlog|hours|labor|overtime|re-?key)/i;

export function deriveProductFit(text: string): "REVENUE_RECOVERY" | "OPERATIONS_EFFICIENCY" | "BOTH" | "UNCLEAR" {
  const rr = RR_WORDS.test(text);
  const oe = OE_WORDS.test(text);
  return rr && oe ? "BOTH" : rr ? "REVENUE_RECOVERY" : oe ? "OPERATIONS_EFFICIENCY" : "UNCLEAR";
}

export function deriveAnalysis(callerText: string, fullText: string, durationSeconds: number | null) {
  const fit = deriveProductFit(callerText);
  const demoTalk = /\b(demo|meeting|schedule|book|call with|talk to curtis|zoom)\b/i.test(fullText);
  const human = /\b(human|real person|representative|speak to (someone|a person)|manager)\b/i.test(callerText);
  let intent = "General inquiry";
  if (/\b(price|pricing|cost|how much)\b/i.test(callerText)) intent = "Pricing question";
  if (fit !== "UNCLEAR") intent = fit === "REVENUE_RECOVERY" ? "Revenue leakage problem" : fit === "OPERATIONS_EFFICIENCY" ? "Operational efficiency problem" : "Revenue + operations problem";
  if (demoTalk && fit !== "UNCLEAR") intent += " — interested in a demo";
  if (human) intent += " — asked for a person";
  const qualification = !callerText.trim() || (durationSeconds ?? 0) < 15 ? "UNKNOWN" : fit !== "UNCLEAR" ? "NEEDS_REVIEW" : "UNKNOWN";
  return {
    intent,
    productFit: fit,
    qualification,
    demoStatus: demoTalk ? "DISCUSSED" : "NONE",
    nextStep: human ? "Call back — caller asked for a person" : demoTalk && fit !== "UNCLEAR" ? "Confirm whether the demo was booked; follow up if not" : fit !== "UNCLEAR" ? "Review call and decide on follow-up" : null,
    handoffRequested: human,
  };
}

function channelFor(call: VapiCall, routing: string): string {
  if (call.type === "webCall") return routing === "SIGNED_SESSION" ? "web_workspace" : "web_public";
  if (call.type === "outboundPhoneCall") return "phone_outbound";
  return "phone_inbound";
}

export function normalizeCall(call: VapiCall, routing: string) {
  const turns = transcriptTurns(call);
  const transcript = turns.length ? turns.map((t) => `${t.role === "assistant" ? "AI" : "Caller"}: ${t.text}`).join("\n") : clip(call.artifact?.transcript ?? call.transcript, 60000);
  const callerText = turns.filter((t) => t.role === "caller").map((t) => t.text).join(" ");
  const startedAt = call.startedAt ? new Date(call.startedAt) : call.createdAt ? new Date(call.createdAt) : null;
  const endedAt = call.endedAt ? new Date(call.endedAt) : null;
  const durationSeconds = startedAt && endedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) : null;
  const sd = (call.analysis?.structuredData || {}) as Record<string, unknown>;
  const derived = deriveAnalysis(callerText, transcript || "", durationSeconds);
  const providerFit = typeof sd.productFit === "string" && ["REVENUE_RECOVERY", "OPERATIONS_EFFICIENCY", "BOTH", "UNCLEAR"].includes(sd.productFit) ? (sd.productFit as string) : null;
  const providerQual = typeof sd.qualification === "string" && ["QUALIFIED", "NEEDS_REVIEW", "NOT_QUALIFIED", "UNKNOWN"].includes(sd.qualification) ? (sd.qualification as string) : null;
  const hasProvider = Boolean(call.analysis?.summary || Object.keys(sd).length);
  const vv = { ...(call.artifact?.variableValues || {}), ...(call.assistantOverrides?.variableValues || {}) } as Record<string, unknown>;
  const customerNumber = call.customer?.number || null;
  return {
    providerCallId: call.id,
    providerAssistantId: call.assistantId || null,
    channel: channelFor(call, routing),
    callerName: clip(sd.callerName, 120) || clip(call.customer?.name, 120) || (routing === "SIGNED_SESSION" ? clip(vv.userName, 120) : null),
    callerNumber: customerNumber ? customerNumber.slice(0, 32) : null,
    callerEmail: clip(sd.email, 200) || clip(call.customer?.email, 200),
    company: clip(sd.company, 200) || (routing === "SIGNED_SESSION" ? clip(vv.orgName, 200) : null),
    status: clip(call.status, 40),
    endedReason: clip(call.endedReason, 120),
    startedAt,
    endedAt,
    durationSeconds,
    transcript: transcript ? scrubText(transcript) : null,
    transcriptJson: turns.length ? JSON.stringify(turns) : null,
    summary: clip(call.analysis?.summary ?? call.summary, 4000),
    intent: clip(sd.intent, 300) || (callerText ? derived.intent : null),
    qualification: providerQual || derived.qualification,
    productFit: providerFit || (callerText ? derived.productFit : "UNCLEAR"),
    nextStep: clip(sd.nextStep, 400) || derived.nextStep,
    demoStatus: sd.demoRequested === true ? "DISCUSSED" : derived.demoStatus,
    followUp: clip(sd.followUp, 400) || (derived.handoffRequested ? "Human follow-up requested" : null),
    outcome: clip(sd.outcome, 200) || (call.endedReason ? humanEnded(call.endedReason, durationSeconds) : null),
    analysisSource: hasProvider ? "provider" : "derived",
    handoffRequested: derived.handoffRequested || sd.handoffRequested === true,
    costUsd: typeof call.cost === "number" ? Math.round(call.cost * 10000) / 10000 : null,
  };
}

function humanEnded(reason: string, dur: number | null): string {
  if (/customer-ended|customer-did-not|hangup/i.test(reason)) return dur !== null && dur < 20 ? "Caller hung up early" : "Caller ended the call";
  if (/assistant-ended|assistant-said-end/i.test(reason)) return "Completed";
  if (/silence/i.test(reason)) return "Ended after silence";
  if (/max-duration|exceeded/i.test(reason)) return "Reached time limit";
  if (/error|failed/i.test(reason)) return "Ended with a provider error";
  return reason.replace(/[-.]/g, " ").slice(0, 80);
}

/** Link a call to an existing lead/account in the SAME tenant only. */
export async function linkCall(tenantId: string, isHq: boolean, f: { callerNumber: string | null; callerEmail: string | null }) {
  const out: { linkedAccountId?: string | null; linkedDemoRequestId?: string | null; linkedCustomerId?: string | null; linkedLeadId?: string | null } = {};
  const digits = (f.callerNumber || "").replace(/\D/g, "").slice(-10);
  if (isHq) {
    if (f.callerEmail) {
      const acct = await prisma.acquisitionAccount.findFirst({ where: { primaryEmail: { equals: f.callerEmail, mode: "insensitive" } }, select: { id: true } });
      if (acct) out.linkedAccountId = acct.id;
      const dr = await prisma.demoRequest.findFirst({ where: { email: { equals: f.callerEmail, mode: "insensitive" } }, orderBy: { createdAt: "desc" }, select: { id: true } });
      if (dr) out.linkedDemoRequestId = dr.id;
    }
    if (digits.length === 10 && !out.linkedAccountId) {
      const acct = await prisma.acquisitionAccount.findFirst({ where: { phone: { contains: digits.slice(-7) } }, select: { id: true, phone: true } });
      if (acct && (acct.phone || "").replace(/\D/g, "").endsWith(digits)) out.linkedAccountId = acct.id;
    }
    if (digits.length === 10 && !out.linkedDemoRequestId) {
      const drs = await prisma.demoRequest.findMany({ where: { phone: { contains: digits.slice(-4) } }, select: { id: true, phone: true }, take: 50 });
      const hit = drs.find((d) => (d.phone || "").replace(/\D/g, "").endsWith(digits));
      if (hit) out.linkedDemoRequestId = hit.id;
    }
    return out;
  }
  if (f.callerEmail) {
    const c = await prisma.customer.findFirst({ where: { organizationId: tenantId, email: { equals: f.callerEmail, mode: "insensitive" } }, select: { id: true } }).catch(() => null);
    if (c) out.linkedCustomerId = c.id;
  }
  if (out.linkedCustomerId) {
    const lead = await prisma.lead.findFirst({ where: { organizationId: tenantId, customerId: out.linkedCustomerId }, orderBy: { updatedAt: "desc" }, select: { id: true } });
    if (lead) out.linkedLeadId = lead.id;
  }
  return out;
}

/** Idempotent upsert of a provider call into the routed tenant. Returns the stored row id. */
export async function upsertCall(input: { tenantId: string; agent: { id: string; name: string; routing: string }; call: VapiCall; source: "poll" | "webhook"; userId?: string | null; isHq: boolean }) {
  const n = normalizeCall(input.call, input.agent.routing);
  const existing = await prisma.voiceCall.findUnique({ where: { providerCallId: n.providerCallId }, select: { id: true, tenantId: true } });
  if (existing && existing.tenantId !== input.tenantId) {
    // A call id already owned by another tenant is never moved or overwritten.
    throw new Error("cross_tenant_call_conflict");
  }
  const links = await linkCall(input.tenantId, input.isHq, { callerNumber: n.callerNumber, callerEmail: n.callerEmail });
  const data = { ...n, ...links, tenantId: input.tenantId, voiceAgentId: input.agent.id, assistantName: input.agent.name, userId: input.userId ?? null, source: input.source };
  const row = existing
    ? await prisma.voiceCall.update({ where: { id: existing.id }, data: { ...data, source: input.source } })
    : await prisma.voiceCall.create({ data });
  if (!existing) {
    await prisma.voiceEvent.create({ data: { tenantId: input.tenantId, voiceAgentId: input.agent.id, voiceCallId: row.id, providerCallId: row.providerCallId, type: `call.${input.source === "poll" ? "synced" : "received"}`, detailJson: JSON.stringify({ channel: n.channel, status: n.status }) } });
  }
  if (n.startedAt) await recomputeUsage(input.tenantId, periodOf(n.startedAt));
  return { id: row.id, created: !existing };
}

export function periodOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
