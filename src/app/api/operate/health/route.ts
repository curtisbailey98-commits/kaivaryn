import { withOpCtx } from "@/lib/operate/api";
import { runHealthCheck, listHealthChecks, healthRollup, requireOpPermission } from "@/lib/operate";

export const dynamic = "force-dynamic";

export async function GET() {
  return withOpCtx(async (ctx) => {
    requireOpPermission(ctx, "read");
    const [checks, rollup] = await Promise.all([listHealthChecks(ctx, 10), healthRollup(ctx)]);
    return { latest: checks[0] ?? null, checks, rollup };
  });
}

export async function POST() {
  return withOpCtx(async (ctx) => ({ check: await runHealthCheck(ctx, "MANUAL") }));
}
