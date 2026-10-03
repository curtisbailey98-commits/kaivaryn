import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/tenant";
import type { VoiceCtx } from "./agents";

/** Session → voice context, or a JSON error response. Tenant always comes from the session. */
export async function voiceApiCtx(): Promise<{ ctx: VoiceCtx & { orgName: string; userName: string | null }; error?: never } | { ctx?: never; error: NextResponse }> {
  const s = await getSessionContext();
  if (!s) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!s.organizationId) return { error: NextResponse.json({ error: "no_organization" }, { status: 403 }) };
  return { ctx: { tenantId: s.organizationId, userId: s.user.id, role: s.effectiveRole, orgName: s.organization?.name || "your organization", userName: s.user.name ?? null } };
}

export function voiceErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("Forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ error: msg.slice(0, 200) }, { status: 400 });
}
