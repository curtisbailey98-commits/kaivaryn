import { withOpCtx, readJson } from "@/lib/operate/api";
import { runPlaybook } from "@/lib/operate";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withOpCtx(async (ctx) => {
    const b = await readJson(req);
    const { playbook, run } = await runPlaybook(ctx, params.id, { initiativeId: b.initiativeId ? String(b.initiativeId) : null });
    return { playbookId: playbook.id, run };
  });
}
