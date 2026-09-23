import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/tenant";
import { syncGmailReplies } from "@/lib/acquisition-execution";

export const runtime = "nodejs";

async function authorized(request: Request) {
  const token = process.env.ACQUISITION_SYNC_TOKEN;
  const bearer = request.headers.get("authorization");
  const header = request.headers.get("x-acquisition-sync-token");
  if (token && (bearer === `Bearer ${token}` || header === token)) return true;
  const ctx = await getSessionContext();
  return Boolean(ctx?.isSuperAdmin);
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await syncGmailReplies(50);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gmail sync failed" }, { status: 503 });
  }
}
