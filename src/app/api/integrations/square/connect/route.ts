import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/tenant";
import { startSquareConnect } from "@/lib/integrations/square/oauth-flow";
import { SQUARE_STATE_COOKIE, SQUARE_STATE_TTL_MS } from "@/lib/integrations/square/state";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts the Square OAuth code flow. Owner/Admin only. Sets a short-lived httpOnly nonce cookie bound into `state`. */
export async function GET(request: Request) {
  const base = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const ctx = await getSessionContext();
  const r = startSquareConnect(ctx ? { userId: ctx.user.id, organizationId: ctx.organizationId, effectiveRole: ctx.effectiveRole } : null);
  const res = NextResponse.redirect(new URL(r.location, base));
  if (r.nonce && ctx?.organizationId) {
    res.cookies.set(SQUARE_STATE_COOKIE, r.nonce, {
      httpOnly: true,
      secure: base.startsWith("https://"),
      sameSite: "lax", // must survive the top-level redirect back from Square
      path: "/api/integrations/square",
      maxAge: Math.floor(SQUARE_STATE_TTL_MS / 1000),
    });
    await writeAudit({ organizationId: ctx.organizationId, actorId: ctx.user.id, action: "square.connect_started", entityType: "IntegrationConnection" });
  }
  return res;
}
