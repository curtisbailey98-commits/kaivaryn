/**
 * Route-handler helper: session → tenant OpCtx, OpError → JSON status. Never trusts a client-sent org id.
 */
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/tenant";
import { OpError, opCtxFromSession, type OpCtx } from "./context";

export async function withOpCtx(handler: (ctx: OpCtx) => Promise<unknown>) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!session.organizationId) return NextResponse.json({ error: "no_org", message: "Organization membership required" }, { status: 403 });
  try {
    const ctx = opCtxFromSession(session);
    const body = await handler(ctx);
    if (body instanceof NextResponse) return body;
    return NextResponse.json(body ?? { ok: true });
  } catch (e) {
    if (e instanceof OpError) return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
    return NextResponse.json({ error: "error", message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
