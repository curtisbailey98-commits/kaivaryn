import { withOpCtx, readJson } from "@/lib/operate/api";
import { linkToInitiative, type LinkType } from "@/lib/operate";

export const dynamic = "force-dynamic";

/** POST { entityType, entityId } — target must belong to the caller's organization. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withOpCtx(async (ctx) => {
    const b = await readJson(req);
    const link = await linkToInitiative(ctx, params.id, String(b.entityType || "").toUpperCase() as LinkType, String(b.entityId || ""));
    return { link };
  });
}
