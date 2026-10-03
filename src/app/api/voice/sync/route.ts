import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { syncVoiceCalls } from "@/lib/voice/sync";
import { voiceApiCtx } from "@/lib/voice/api-ctx";
import { canVoice } from "@/lib/voice/permissions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function tokenOk(header: string | null) {
  const expected = process.env.OPERATE_TICK_TOKEN || "";
  if (expected.length < 16 || !header) return false;
  const a = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Poll provider calls into Kaivaryn. Bearer OPERATE_TICK_TOKEN syncs every registered assistant;
 *  a signed-in ADMIN+ syncs only their own tenant's assistants. */
export async function POST(req: Request) {
  if (req.headers.get("authorization")) {
    if (!tokenOk(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const r = await syncVoiceCalls();
    return NextResponse.json({ mode: "platform", ...r, errors: r.errors.length });
  }
  const { ctx, error } = await voiceApiCtx();
  if (error) return error;
  if (!canVoice(ctx.role, "voice.sync")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const r = await syncVoiceCalls({ tenantId: ctx.tenantId });
  return NextResponse.json({ mode: "organization", ...r, errors: r.errors.length });
}
