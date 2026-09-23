import { callAgentContext, processCallTurn } from "@/lib/call-agent";
import { twimlSayAndGather, validateTwilioWebhook } from "@/lib/providers/twilio";

export const runtime = "nodejs";

function asParams(form: FormData) {
  const out: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") out[key] = value;
  });
  return out;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const callId = url.searchParams.get("callId");
  if (!callId) return new Response("Missing callId", { status: 400 });
  const form = await request.formData();
  const params = asParams(form);
  const publicUrl = new URL(`${url.pathname}${url.search}`, process.env.NEXTAUTH_URL || url.origin).toString();
  if (!validateTwilioWebhook(publicUrl, params, request.headers.get("x-twilio-signature"))) return new Response("Unauthorized", { status: 401 });
  const speech = String(params.SpeechResult || "").trim();
  const digits = String(params.Digits || "").trim();
  const utterance = speech || (digits === "9" ? "do not call me again" : digits ? `DTMF ${digits}` : "");
  if (!utterance) {
    const ctx = await callAgentContext(callId);
    const xml = twimlSayAndGather({ text: "I didn't catch that. Could you repeat that briefly?", actionUrl: ctx.turnUrl });
    return new Response(xml, { headers: { "content-type": "text/xml; charset=utf-8" } });
  }
  const result = await processCallTurn(callId, utterance);
  const ctx = await callAgentContext(callId);
  const xml = twimlSayAndGather({ text: result.text, actionUrl: ctx.turnUrl, finish: result.finish });
  return new Response(xml, { headers: { "content-type": "text/xml; charset=utf-8" } });
}
