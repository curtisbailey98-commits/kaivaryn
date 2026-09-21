import { getPricingConfig, centsToDollars } from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const config = await getPricingConfig();

  async function save(formData: FormData) {
    "use server";
    const ctx = await getSessionContext();
    if (!ctx?.isSuperAdmin) return;
    const current = await getPricingConfig();
    const link = String(formData.get("stripePaymentLink") || "").trim() || current.stripePaymentLink;
    await prisma.pricingConfig.update({
      where: { key: "default" },
      data: {
        introductorySeats: Number(formData.get("introductorySeats") || 10),
        introductoryPriceCents: Math.round(Number(formData.get("introductoryPrice") || 10000) * 100),
        standardPriceCents: Math.round(Number(formData.get("standardPrice") || 20000) * 100),
        stripePaymentLink: link,
      },
    });
    await writeAudit({
      actorId: ctx.user.id,
      action: "pricing_config.updated",
      entityType: "PricingConfig",
      entityId: current.id,
    });
    revalidatePath("/admin/pricing");
    revalidatePath("/pricing");
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold">Pricing config</h1>
      <p className="mt-1 text-xs text-neutral-500">Single source of truth — not hardcoded in product UI.</p>
      <form action={save} className="si-panel mt-6 space-y-4 p-4">
        <label className="block text-xs text-neutral-400">
          Introductory seats
          <Input name="introductorySeats" type="number" defaultValue={config.introductorySeats} className="mt-1" />
        </label>
        <label className="block text-xs text-neutral-400">
          Introductory price (USD / mo)
          <Input name="introductoryPrice" type="number" defaultValue={centsToDollars(config.introductoryPriceCents)} className="mt-1" />
        </label>
        <label className="block text-xs text-neutral-400">
          Standard price (USD / mo)
          <Input name="standardPrice" type="number" defaultValue={centsToDollars(config.standardPriceCents)} className="mt-1" />
        </label>
        <label className="block text-xs text-neutral-400">
          Stripe Payment Link
          <Input name="stripePaymentLink" defaultValue={config.stripePaymentLink} className="mt-1" />
        </label>
        <p className="text-xs text-neutral-500">
          Current: {formatCurrency(centsToDollars(config.introductoryPriceCents))} → {formatCurrency(centsToDollars(config.standardPriceCents))}
        </p>
        <Button type="submit">Save</Button>
      </form>
    </div>
  );
}
