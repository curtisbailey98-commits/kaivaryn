import { NextRequest } from "next/server";
import { withOpCtx } from "@/lib/operate/api";
import { listRuns } from "@/lib/operate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") || undefined;
  return withOpCtx(async (ctx) => ({ runs: await listRuns(ctx, { take: 50, status }) }));
}
