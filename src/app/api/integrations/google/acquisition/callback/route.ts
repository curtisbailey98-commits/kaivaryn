import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/tenant";
import { verifyAcquisitionOAuthState } from "@/lib/acquisition-oauth-state";
import { connectGoogleWorkspaceFromCode } from "@/lib/providers/google-workspace";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const base = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) return NextResponse.redirect(new URL(`/admin/acquisition/execution?google=${encodeURIComponent(error)}`, base));
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  if (!code || !stateRaw) return NextResponse.redirect(new URL("/admin/acquisition/execution?google=invalid-callback", base));
  try {
    const state = verifyAcquisitionOAuthState(stateRaw);
    const ctx = await getSessionContext();
    if (!ctx?.isSuperAdmin || ctx.user.id !== state.userId) throw new Error("OAuth session does not match the initiating administrator.");
    await connectGoogleWorkspaceFromCode(code);
    return NextResponse.redirect(new URL("/admin/acquisition/execution?google=connected", base));
  } catch (err) {
    const message = err instanceof Error ? err.message : "connection-failed";
    return NextResponse.redirect(new URL(`/admin/acquisition/execution?google=${encodeURIComponent(message.slice(0, 120))}`, base));
  }
}
