import { NextResponse } from "next/server";
import { handleVoiceWebhook } from "@/lib/voice/webhook";

export const dynamic = "force-dynamic";

/** Vapi server messages for assistants Kaivaryn created (web, in-app, client agents). Viki's own
 *  server URL stays on Curtis's n8n flow; her calls arrive by polling instead. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 2_000_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const r = await handleVoiceWebhook(raw, req.headers);
  return NextResponse.json(r.body, { status: r.status });
}
