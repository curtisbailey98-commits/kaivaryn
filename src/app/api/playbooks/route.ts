import { withOpCtx, readJson } from "@/lib/operate/api";
import { listPlaybooks, savePlaybook } from "@/lib/operate";

export const dynamic = "force-dynamic";

export async function GET() {
  return withOpCtx(async (ctx) => ({ playbooks: await listPlaybooks(ctx) }));
}

/** POST { name, summary?, product?, steps? | directive? } */
export async function POST(req: Request) {
  return withOpCtx(async (ctx) => {
    const b = await readJson(req);
    const pb = await savePlaybook(ctx, {
      name: String(b.name || ""),
      summary: b.summary ? String(b.summary) : undefined,
      product: b.product ? String(b.product) : undefined,
      steps: b.steps,
      directive: b.directive ? String(b.directive) : undefined,
    });
    return { playbook: pb };
  });
}
