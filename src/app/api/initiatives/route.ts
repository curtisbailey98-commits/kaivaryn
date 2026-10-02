import { withOpCtx, readJson } from "@/lib/operate/api";
import { listInitiatives, createInitiative } from "@/lib/operate";

export const dynamic = "force-dynamic";

export async function GET() {
  return withOpCtx(async (ctx) => ({ initiatives: await listInitiatives(ctx) }));
}

export async function POST(req: Request) {
  return withOpCtx(async (ctx) => {
    const b = await readJson(req);
    return { initiative: await createInitiative(ctx, { name: String(b.name || ""), description: b.description ? String(b.description) : "", product: b.product ? String(b.product) : undefined }) };
  });
}
