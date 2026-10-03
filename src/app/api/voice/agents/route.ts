import { NextResponse } from "next/server";
import { listAgentsForTenant } from "@/lib/voice/agents";
import { voiceApiCtx, voiceErr } from "@/lib/voice/api-ctx";

export const dynamic = "force-dynamic";

export async function GET() {
  const { ctx, error } = await voiceApiCtx();
  if (error) return error;
  try {
    return NextResponse.json({ agents: await listAgentsForTenant(ctx) });
  } catch (e) {
    return voiceErr(e);
  }
}
