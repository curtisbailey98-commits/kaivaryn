import { withOpCtx, readJson } from "@/lib/operate/api";
import { listBriefings, buildDigest, buildRecall } from "@/lib/operate";

export const dynamic = "force-dynamic";

export async function GET() {
  return withOpCtx(async (ctx) => ({ briefings: await listBriefings(ctx, 30) }));
}

/** POST { kind: "DIGEST" | "RECALL" } — generate a briefing now. */
export async function POST(req: Request) {
  return withOpCtx(async (ctx) => {
    const body = await readJson(req);
    const res = body.kind === "RECALL" ? await buildRecall(ctx, "MANUAL") : await buildDigest(ctx, "MANUAL");
    return { briefingId: res.briefing.id, kind: res.briefing.kind, body: res.body };
  });
}
