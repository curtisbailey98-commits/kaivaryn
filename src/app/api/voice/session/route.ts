import { NextResponse } from "next/server";
import { publicSession, workspaceSession, previewSession, rateLimited } from "@/lib/voice/session";
import { voiceApiCtx } from "@/lib/voice/api-ctx";

export const dynamic = "force-dynamic";

/** Issues a short-lived browser voice session. Never returns the provider private key. */
export async function POST(req: Request) {
  let body: { mode?: string; agentId?: string } = {};
  try {
    body = await req.json();
  } catch { /* empty body = public */ }
  const mode = body.mode === "workspace" || body.mode === "preview" ? body.mode : "public";
  const headers = { "cache-control": "no-store" };
  if (mode === "public") {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0]!.trim() || "unknown";
    if (rateLimited(`pub:${ip}`, 12)) return NextResponse.json({ available: false, reason: "Please try again a little later." }, { status: 429, headers });
    return NextResponse.json(await publicSession(), { headers });
  }
  const { ctx, error } = await voiceApiCtx();
  if (error) return error;
  if (rateLimited(`ws:${ctx.userId}`, 30)) return NextResponse.json({ available: false, reason: "Please try again a little later." }, { status: 429, headers });
  if (mode === "preview") return NextResponse.json(await previewSession({ tenantId: ctx.tenantId, role: ctx.role, agentId: String(body.agentId || "") }), { headers });
  return NextResponse.json(await workspaceSession({ userId: ctx.userId, userName: ctx.userName, tenantId: ctx.tenantId, orgName: ctx.orgName, role: ctx.role }), { headers });
}
