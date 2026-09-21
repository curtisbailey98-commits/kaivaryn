import type { Product } from "@/lib/enums";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";

export async function requireEntitlement(organizationId: string, product: Product) {
  const ent = await prisma.entitlement.findUnique({
    where: { organizationId_product: { organizationId, product } },
  });
  if (!ent?.active) {
    redirect("/app?missing_entitlement=1");
  }
  return ent;
}
