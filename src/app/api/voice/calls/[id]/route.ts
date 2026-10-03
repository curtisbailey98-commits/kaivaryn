import { NextResponse } from "next/server";
import { getCallForTenant } from "@/lib/voice/agents";
import { voiceApiCtx, voiceErr } from "@/lib/voice/api-ctx";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { ctx, error } = await voiceApiCtx();
  if (error) return error;
  try {
    const call = await getCallForTenant(ctx, params.id);
    if (!call) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ call });
  } catch (e) {
    return voiceErr(e);
  }
}
