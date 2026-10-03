import { withOpCtx, readJson } from "@/lib/operate/api";
import { previewAutomationPrompt, requireOpPermission } from "@/lib/operate";

export const dynamic = "force-dynamic";

/** POST { prompt } → what Kaivaryn would set up. Read-only: nothing is saved. */
export async function POST(req: Request) {
  return withOpCtx(async (ctx) => {
    requireOpPermission(ctx, "read");
    const b = await readJson(req);
    return { preview: await previewAutomationPrompt(ctx, String(b.prompt || "")) };
  });
}
