/**
 * Deterministic "Let Kaivaryn build it for me" generator. Same answers → same recommended config.
 * (No LLM key is configured in this app, so no model is called; the template is the product.)
 */
import { defaultToolMap, sanitizeToolMap, type ActionLevel } from "./action-levels";
import { buildClientAgentPrompt } from "./prompts";
import { restaurantPresetAdditions } from "@/lib/industry/restaurant-voice";

export const VOICE_OPTIONS = [
  { id: "Layla", label: "Layla — warm, polished" },
  { id: "Elliot", label: "Elliot — calm, measured" },
  { id: "Savannah", label: "Savannah — bright, friendly" },
  { id: "Rohan", label: "Rohan — confident, clear" },
  { id: "Paige", label: "Paige — composed, professional" },
  { id: "Cole", label: "Cole — steady, low-key" },
] as const;

export const TONE_OPTIONS = [
  { id: "warm_professional", label: "Warm and professional", text: "warm, calm, and professional — like a polished front desk" },
  { id: "concise", label: "Concise and efficient", text: "concise and efficient; gets to the point politely" },
  { id: "friendly", label: "Friendly and approachable", text: "friendly and approachable, never overly casual" },
  { id: "formal", label: "Formal", text: "formal and precise, suited to legal, financial, or clinical settings" },
] as const;

export const CALLER_TYPES = [
  ["prospects", "New prospects"],
  ["customers", "Existing customers or clients"],
  ["patients", "Patients"],
  ["vendors", "Vendors and suppliers"],
  ["partners", "Partners"],
] as const;

export const HANDLE_OPTIONS = [
  ["faq", "Answer common questions"],
  ["messages", "Take messages"],
  ["callbacks", "Arrange callbacks"],
  ["appointments", "Capture appointment requests"],
  ["order_status", "Order or ticket status"],
  ["billing_questions", "Basic billing questions"],
] as const;

export const HUMAN_ALWAYS_OPTIONS = [
  ["complaints", "Complaints or upset callers"],
  ["billing_disputes", "Billing disputes and refunds"],
  ["legal", "Anything legal or contractual"],
  ["emergencies", "Emergencies or urgent safety issues"],
  ["vip", "Named key accounts"],
  ["pricing", "Custom pricing or quotes"],
] as const;

export const APPROVAL_OPTIONS = [
  ["refunds", "Refunds"],
  ["discounts", "Discounts or credits"],
  ["contracts", "Contract changes"],
  ["cancellations", "Cancellations"],
  ["account_changes", "Account or payment-method changes"],
] as const;

export type Questionnaire = {
  agentName: string;
  companyName: string;
  whatCompanyDoes: string;
  whoCalls: string[];
  whatToHandle: string[];
  alwaysHuman: string[];
  alwaysHumanNotes?: string;
  hours: string;
  tone: string;
  canSchedule: "none" | "request_only";
  systems: string[];
  needsApproval: string[];
  restaurantPresets?: string[];
};

export type GeneratedConfig = {
  name: string;
  voice: string;
  tone: string;
  greeting: string;
  role: string;
  responsibilities: string[];
  hours: string;
  afterHoursBehavior: string;
  escalationRules: string[];
  approvedKnowledge: string;
  allowedTools: Record<string, ActionLevel>;
  systems: string[];
  systemPrompt: string;
};

const label = (pairs: readonly (readonly [string, string])[], ids: string[]) => ids.map((id) => pairs.find(([k]) => k === id)?.[1]).filter(Boolean) as string[];

export function safeAgentName(raw: string | null | undefined, companyName: string): string {
  const name = String(raw || "").replace(/[^A-Za-z0-9\u00C0-\u024F .'&-]/g, "").trim().slice(0, 40);
  // Never default a client agent to "Viki" — that is Kaivaryn's own assistant.
  if (!name || /^viki$/i.test(name)) return `${companyName.trim().slice(0, 30) || "Company"} Assistant`;
  return name;
}

export function generateConfig(q: Questionnaire): GeneratedConfig {
  const company = q.companyName.trim() || "the company";
  const name = safeAgentName(q.agentName, company);
  const tone = (TONE_OPTIONS.find((t) => t.id === q.tone) ?? TONE_OPTIONS[0]).text;
  const callers = label(CALLER_TYPES, q.whoCalls);
  const handles = new Set(q.whatToHandle);

  const responsibilities: string[] = [];
  if (handles.has("faq")) responsibilities.push("Answer common questions using only approved knowledge");
  if (handles.has("messages")) responsibilities.push("Take clear messages: name, callback number, reason, urgency");
  if (handles.has("callbacks")) responsibilities.push("Arrange callbacks with the right team member");
  if (handles.has("appointments")) responsibilities.push(q.canSchedule === "request_only" ? "Capture appointment requests (preferred day/time) for a person to confirm" : "Take appointment interest as a message — scheduling is not enabled");
  if (handles.has("order_status")) responsibilities.push("Help callers check order or ticket status when that system is connected; otherwise take details");
  if (handles.has("billing_questions")) responsibilities.push("Answer basic billing questions from approved knowledge; route disputes to a person");
  if (!responsibilities.length) responsibilities.push("Greet callers, understand the reason for the call, and route to the right person");
  if (callers.length) responsibilities.push(`Typical callers: ${callers.join(", ").toLowerCase()}`);

  const tools = defaultToolMap();
  if (!handles.has("appointments") || q.canSchedule === "none") delete tools.request_appointment;
  if (!handles.has("order_status")) delete tools.lookup_order_status;
  if (!handles.has("billing_questions")) delete tools.check_invoice_status;
  if (!handles.has("faq")) tools.answer_faq = "ANSWER";

  const escalation = [
    ...label(HUMAN_ALWAYS_OPTIONS, q.alwaysHuman).map((x) => `Always hand off: ${x.toLowerCase()}`),
    ...label(APPROVAL_OPTIONS, q.needsApproval).map((x) => `Needs approval before anything is promised: ${x.toLowerCase()}`),
  ];
  if (q.alwaysHumanNotes?.trim()) escalation.push(`Also hand off: ${q.alwaysHumanNotes.trim().slice(0, 300)}`);

  const restaurant = restaurantPresetAdditions(q.restaurantPresets);
  for (const r of restaurant.responsibilities) if (!responsibilities.includes(r)) responsibilities.push(r);
  for (const e of restaurant.escalation) if (!escalation.includes(e)) escalation.push(e);

  const hours = q.hours.trim() || "Not provided — treat every call as after hours until hours are confirmed";
  const config: Omit<GeneratedConfig, "systemPrompt"> = {
    name,
    voice: "Layla",
    tone,
    greeting: `Thank you for calling ${company}. This is ${name}, ${company}'s AI assistant. How can I help today?`,
    role: `AI front-desk assistant for ${company}${q.whatCompanyDoes.trim() ? ` (${q.whatCompanyDoes.trim().slice(0, 160)})` : ""}`,
    responsibilities,
    hours,
    afterHoursBehavior: "Let the caller know the office is closed, take a detailed message, and promise only that the team will follow up next business day.",
    escalationRules: escalation,
    approvedKnowledge: q.whatCompanyDoes.trim() ? `About ${company}: ${q.whatCompanyDoes.trim().slice(0, 1200)}` : "",
    allowedTools: sanitizeToolMap(tools),
    systems: Array.from(new Set(q.systems)).slice(0, 40),
  };
  return { ...config, systemPrompt: buildClientAgentPrompt({ companyName: company, ...config, tools: config.allowedTools }) };
}
