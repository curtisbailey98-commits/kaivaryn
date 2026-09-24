import { NextResponse } from "next/server";
import { runQueuedEmailExecution, syncGmailReplies } from "@/lib/acquisition-execution";

export const runtime = "nodejs";

function authorized(request: Request) {
  const token = process.env.ACQUISITION_AUTOMATION_TOKEN;
  if (!token) return false;
  return request.headers.get("authorization") === `Bearer ${token}` || request.headers.get("x-acquisition-automation-token") === token;
}

export async function POST(request: Request) {
  if (!process.env.ACQUISITION_AUTOMATION_TOKEN) return NextResponse.json({ error: "Acquisition automation is not configured." }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sync = await syncGmailReplies(50).catch((error) => ({ error: error instanceof Error ? error.message : "sync failed" }));
  const sent = await runQueuedEmailExecution(10);
  return NextResponse.json({ ok: true, sync, emailExecution: sent });
}
