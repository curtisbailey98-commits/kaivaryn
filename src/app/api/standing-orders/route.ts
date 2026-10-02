import { withOpCtx, readJson } from "@/lib/operate/api";
import { listStandingOrders, createStandingOrder } from "@/lib/operate";

export const dynamic = "force-dynamic";

export async function GET() {
  return withOpCtx(async (ctx) => ({ standingOrders: await listStandingOrders(ctx) }));
}

export async function POST(req: Request) {
  return withOpCtx(async (ctx) => {
    const b = await readJson(req);
    const order = await createStandingOrder(ctx, {
      directive: String(b.directive || ""),
      cadence: b.cadence ? String(b.cadence) : null,
      title: b.title ? String(b.title) : undefined,
      playbookId: b.playbookId ? String(b.playbookId) : null,
      kind: b.playbookId ? "PLAYBOOK" : undefined,
    });
    return { standingOrder: order };
  });
}
