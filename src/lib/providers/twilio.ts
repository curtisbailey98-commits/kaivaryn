import { createHmac, timingSafeEqual } from "crypto";

function config() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const baseUrl = (process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  if (!accountSid || !authToken || !fromNumber || !baseUrl) return null;
  return { accountSid, authToken, fromNumber, baseUrl };
}

export function twilioConfigured() {
  return Boolean(config());
}

export function twilioBaseUrl() {
  const cfg = config();
  if (!cfg) throw new Error("Twilio is not configured.");
  return cfg.baseUrl;
}

export async function createTwilioOutboundCall(input: { callId: string; to: string }) {
  const cfg = config();
  if (!cfg) throw new Error("Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.");
  const body = new URLSearchParams({
    To: input.to,
    From: cfg.fromNumber,
    Url: `${cfg.baseUrl}/api/acquisition/calls/twiml?callId=${encodeURIComponent(input.callId)}`,
    Method: "POST",
    StatusCallback: `${cfg.baseUrl}/api/acquisition/calls/status?callId=${encodeURIComponent(input.callId)}`,
    StatusCallbackMethod: "POST",
  });
  for (const event of ["initiated", "ringing", "answered", "completed"]) body.append("StatusCallbackEvent", event);
  const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Calls.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.sid) throw new Error(`Twilio call creation failed (${response.status}): ${payload?.message || "unknown"}`);
  return { sid: String(payload.sid), status: String(payload.status || "queued"), from: cfg.fromNumber };
}

function normalizeWebhookUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export function validateTwilioWebhook(url: string, params: Record<string, string>, signature: string | null) {
  const cfg = config();
  if (!cfg || !signature) return false;
  let data = normalizeWebhookUrl(url);
  for (const key of Object.keys(params).sort()) data += key + params[key];
  const expected = createHmac("sha1", cfg.authToken).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function twimlSayAndGather(input: { text: string; actionUrl: string; finish?: boolean }) {
  const say = `<Say voice="Polly.Joanna">${xmlEscape(input.text)}</Say>`;
  if (input.finish) return `<?xml version="1.0" encoding="UTF-8"?><Response>${say}<Hangup/></Response>`;
  const gather = `<Gather input="speech dtmf" speechTimeout="auto" timeout="7" numDigits="1" action="${xmlEscape(input.actionUrl)}" method="POST">${say}</Gather>`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${gather}<Say voice="Polly.Joanna">I didn't catch that. I'll let you go. Have a good day.</Say><Hangup/></Response>`;
}
