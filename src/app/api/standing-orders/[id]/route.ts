import { withOpCtx, readJson } from "@/lib/operate/api";
import { setStandingOrderEnabled, deleteStandingOrder, runStandingOrder, OpError } from "@/lib/operate";

export const dynamic = "force-dynamic";

/** PATCH { enabled } or { run: true } */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return withOpCtx(async (ctx) => {
    const b = await readJson(req);
    if (b.run === true) return { standingOrder: await runStandingOrder(ctx, params.id) };
    if (typeof b.enabled !== "boolean") throw new OpError("invalid", "Provide { enabled: boolean } or { run: true }");
    return { standingOrder: await setStandingOrderEnabled(ctx, params.id, b.enabled) };
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return withOpCtx(async (ctx) => {
    const deleted = await deleteStandingOrder(ctx, params.id);
    if (!deleted) throw new OpError("not_found", "Standing order not found in this organization", 404);
    return { deleted };
  });
}
