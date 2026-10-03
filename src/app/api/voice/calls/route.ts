import { NextResponse } from "next/server";
import { listCallsForTenant } from "@/lib/voice/agents";
import { voiceApiCtx, voiceErr } from "@/lib/voice/api-ctx";

export const dynamic = "force-dynamic";

export async function GET() {
  const { ctx, error } = await voiceApiCtx();
  if (error) return error;
  try {
    return NextResponse.json({ calls: await listCallsForTenant(ctx) });
  } catch (e) {
    return voiceErr(e);
  }
}
