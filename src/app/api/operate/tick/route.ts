import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { withOpCtx } from "@/lib/operate/api";
import { runDueStandingOrders, tickAllOrganizations } from "@/lib/operate";

export const dynamic = "force-dynamic";

function tokenOk(header: string | null) {
  const expected = process.env.OPERATE_TICK_TOKEN || "";
  if (expected.length < 16 || !header) return false;
  const given = header.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Scheduler tick for standing orders (SI Operate tick equivalent).
 * - Bearer OPERATE_TICK_TOKEN (external cron): runs due orders across organizations, each in its own tenant context.
 * - Signed-in user: runs due orders for their own organization only.
 */
export async function POST(req: Request) {
  if (req.headers.get("authorization")) {
    if (!tokenOk(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const orgs = await tickAllOrganizations();
    return NextResponse.json({ mode: "platform", organizations: orgs.length, ran: orgs.reduce((s, o) => s + o.ran, 0) });
  }
  return withOpCtx(async (ctx) => {
    const ran = await runDueStandingOrders(ctx);
    return { mode: "organization", ran: ran.length };
  });
}
