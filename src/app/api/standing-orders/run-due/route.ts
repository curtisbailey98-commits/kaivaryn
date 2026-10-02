import { withOpCtx } from "@/lib/operate/api";
import { runDueStandingOrders } from "@/lib/operate";

export const dynamic = "force-dynamic";

export async function POST() {
  return withOpCtx(async (ctx) => {
    const ran = await runDueStandingOrders(ctx);
    return { ran: ran.length, results: ran.map((r) => ({ id: r.id, lastStatus: r.lastStatus, nextRunAt: r.nextRunAt })) };
  });
}
