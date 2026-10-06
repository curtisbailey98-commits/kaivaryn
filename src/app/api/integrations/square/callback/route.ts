import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionContext } from "@/lib/tenant";
import { completeSquareCallback } from "@/lib/integrations/square/oauth-flow";
import { SQUARE_STATE_COOKIE } from "@/lib/integrations/square/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Square redirects here with ?code&state (or ?error). Verifies state, exchanges the code, stores sealed tokens. */
export async function GET(request: Request) {
  const base = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const url = new URL(request.url);
  const ctx = await getSessionContext();
  const r = await completeSquareCallback({
    ctx: ctx ? { userId: ctx.user.id, organizationId: ctx.organizationId, effectiveRole: ctx.effectiveRole } : null,
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    error: url.searchParams.get("error"),
    cookieNonce: cookies().get(SQUARE_STATE_COOKIE)?.value ?? null,
  });
  const res = NextResponse.redirect(new URL(r.location, base));
  res.cookies.set(SQUARE_STATE_COOKIE, "", { httpOnly: true, path: "/api/integrations/square", maxAge: 0 });
  return res;
}
