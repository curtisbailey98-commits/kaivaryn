import { markCallStatus } from "@/lib/call-agent";
import { validateTwilioWebhook } from "@/lib/providers/twilio";

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
  await markCallStatus(callId, { callSid: params.CallSid, callStatus: params.CallStatus, duration: params.CallDuration });
  return new Response("ok");
}
