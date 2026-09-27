import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireOrgAccess } from "@/lib/tenant";
import { createOrResumeCycle, runCycleToCompletion, listCycles } from "@/lib/si/cycles";
import type { SiProduct } from "@/lib/si/stages";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireOrgAccess();
    const cycles = await listCycles(ctx.organizationId);
    return NextResponse.json({ cycles, protocol: "720SI-Kaivaryn-RR-OE-v1" });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const ctx = await requireOrgAccess();
    const body = await req.json().catch(() => ({}));
    const product = body.product as SiProduct;
    if (product !== "REVENUE_RECOVERY" && product !== "OPERATIONS_EFFICIENCY") {
      return NextResponse.json({ error: "invalid_product" }, { status: 400 });
    }
    const idempotencyKey = String(body.idempotencyKey || `api:${product}:${Date.now()}`);
    const { cycle } = await createOrResumeCycle({
      organizationId: ctx.organizationId,
      product,
      intent: String(body.intent || `${product} API nine-return`),
      idempotencyKey,
      createdById: ctx.user.id,
      methodRole: body.methodRole === "challenger" ? "challenger" : "champion",
    });
    const result = await runCycleToCompletion(cycle.id);
    return NextResponse.json({
      cycleId: result.cycle?.id,
      status: result.cycle?.status,
      stages: result.stages,
      zeroStateId: result.zeroState?.id ?? null,
      invariantId: result.invariant?.id ?? null,
      contentHash: result.zeroState?.contentHash ?? null,
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string; status?: number };
    return NextResponse.json(
      { error: err.code || "error", message: err.message || String(e) },
      { status: err.status || 500 },
    );
  }
}
