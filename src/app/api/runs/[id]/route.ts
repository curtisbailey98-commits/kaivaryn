import { withOpCtx } from "@/lib/operate/api";
import { getRun, OpError } from "@/lib/operate";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withOpCtx(async (ctx) => {
    const run = await getRun(ctx, params.id);
    if (!run) throw new OpError("not_found", "Run not found in this organization", 404);
    return { run };
  });
}
