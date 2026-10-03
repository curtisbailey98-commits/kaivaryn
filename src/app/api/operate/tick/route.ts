import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { withOpCtx } from "@/lib/operate/api";
import { runDueStandingOrders, platformTick } from "@/lib/operate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
 * - Bearer OPERATE_TICK_TOKEN (external cron, e.g. GitHub Actions): runs due orders across organizations,
 *   each in its own tenant context. Optional `X-Tick-Key` makes retries idempotent; `X-Tick-Source` labels it.
 * - Signed-in user: runs due orders for their own organization only (needs run_intelligence).
 * Every order is claimed atomically, so overlapping ticks never double-run an order.
 */
export async function POST(req: Request) {
  if (req.headers.get("authorization")) {
    if (!tokenOk(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const t = await platformTick({ tickKey: req.headers.get("x-tick-key"), source: req.headers.get("x-tick-source") });
    return NextResponse.json(
      { mode: "platform", tickId: t.tickId, replay: t.replay, status: t.status, organizations: t.organizations, ran: t.ran, startedAt: t.startedAt, finishedAt: t.finishedAt },
      { status: t.status === "FAILED" ? 500 : t.replay && t.status === "RUNNING" ? 202 : 200 },
    );
  }
  return withOpCtx(async (ctx) => {
    const ran = await runDueStandingOrders(ctx, { trigger: "RUN_DUE" });
    return { mode: "organization", ran: ran.length };
  });
}
