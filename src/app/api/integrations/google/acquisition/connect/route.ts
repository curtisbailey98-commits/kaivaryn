import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/tenant";
import { signAcquisitionOAuthState } from "@/lib/acquisition-oauth-state";
import { buildGoogleWorkspaceAuthorizationUrl, googleOAuthConfigured } from "@/lib/providers/google-workspace";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx?.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!googleOAuthConfigured()) return NextResponse.redirect(new URL("/admin/acquisition/execution?google=not-configured", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  const state = signAcquisitionOAuthState(ctx.user.id);
  return NextResponse.redirect(buildGoogleWorkspaceAuthorizationUrl(state));
}
