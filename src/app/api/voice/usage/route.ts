import { NextResponse } from "next/server";
import { currentUsage } from "@/lib/voice/usage";
import { canVoice } from "@/lib/voice/permissions";
import { voiceApiCtx } from "@/lib/voice/api-ctx";

export const dynamic = "force-dynamic";

/** Included Voice Usage for the session's tenant. Provider cost is never returned here. */
export async function GET() {
  const { ctx, error } = await voiceApiCtx();
  if (error) return error;
  if (!canVoice(ctx.role, "voice.usage.view")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const u = await currentUsage(ctx.tenantId);
  return NextResponse.json({ usage: { period: u.period, calls: u.calls, minutes: u.minutes, includedMinutes: u.includedMinutes, remainingMinutes: u.remainingMinutes, percentUsed: u.percentUsed, state: u.overageState } });
}
