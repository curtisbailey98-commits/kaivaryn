"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { createOrResumeCycle, runCycleToCompletion } from "@/lib/si/cycles";
import { computeMetaReturn81 } from "@/lib/si/meta";
import type { SiProduct } from "@/lib/si/stages";

function revalidateIntelligence() {
  revalidatePath("/app/intelligence");
  revalidatePath("/app/learning");
  revalidatePath("/app/revenue/analytics");
  revalidatePath("/app/operations/analytics");
  revalidatePath("/executive/ceo");
}

export async function startNineReturnCycle(formData: FormData): Promise<void> {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const product = String(formData.get("product") || "") as SiProduct;
  if (product !== "REVENUE_RECOVERY" && product !== "OPERATIONS_EFFICIENCY") {
    throw new Error("invalid_product");
  }
  const role = String(formData.get("methodRole") || "champion") as "champion" | "challenger";
  const intent =
    String(formData.get("intent") || "").trim() ||
    `${product} nine-return intelligence cycle`;
  const idempotencyKey =
    String(formData.get("idempotencyKey") || "").trim() ||
    `cycle:${product}:${Date.now()}`;

  const { cycle } = await createOrResumeCycle({
    organizationId: ctx.organizationId,
    product,
    intent,
    idempotencyKey,
    createdById: ctx.user.id,
    methodRole: role,
  });
  await runCycleToCompletion(cycle.id);
  revalidateIntelligence();
}

export async function requestMeta81(formData: FormData): Promise<void> {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const product = String(formData.get("product") || "") as SiProduct;
  if (product !== "REVENUE_RECOVERY" && product !== "OPERATIONS_EFFICIENCY") {
    throw new Error("invalid_product");
  }
  const idempotencyKey =
    String(formData.get("idempotencyKey") || "").trim() ||
    `meta81:${product}:${Date.now()}`;
  try {
    await computeMetaReturn81({
      organizationId: ctx.organizationId,
      product,
      idempotencyKey,
      actor: ctx.user.email ?? ctx.user.id,
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "insufficient_window" || err.code === "meta_window_cap") {
      // Honest non-completion — surface via revalidated dashboard counts
      revalidateIntelligence();
      return;
    }
    throw e;
  }
  revalidateIntelligence();
}
