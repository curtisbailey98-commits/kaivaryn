import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/tenant";
import { disconnectGoogleWorkspace } from "@/lib/providers/google-workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx?.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await disconnectGoogleWorkspace();
  return NextResponse.redirect(new URL("/admin/acquisition/execution?google=disconnected", process.env.NEXTAUTH_URL || new URL(request.url).origin), 303);
}
