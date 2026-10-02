import { withOpCtx, readJson } from "@/lib/operate/api";
import { executeCommand, listCommandHistory } from "@/lib/operate";

export const dynamic = "force-dynamic";

export async function GET() {
  return withOpCtx(async (ctx) => ({ commands: await listCommandHistory(ctx, 50) }));
}

export async function POST(req: Request) {
  return withOpCtx(async (ctx) => {
    const body = await readJson(req);
    const text = String(body.text || "");
    return executeCommand(ctx, text, { idempotencyKey: body.idempotencyKey ? String(body.idempotencyKey) : req.headers.get("idempotency-key") });
  });
}
