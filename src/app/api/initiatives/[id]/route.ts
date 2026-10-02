import { withOpCtx } from "@/lib/operate/api";
import { getInitiativeDetail, OpError } from "@/lib/operate";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withOpCtx(async (ctx) => {
    const detail = await getInitiativeDetail(ctx, params.id);
    if (!detail) throw new OpError("not_found", "Initiative not found in this organization", 404);
    return detail;
  });
}
