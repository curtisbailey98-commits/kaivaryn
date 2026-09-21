import Link from "next/link";
import type { Metadata } from "next";
import { getPricingConfig, centsToDollars } from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const config = await getPricingConfig();
  const intro = formatCurrency(centsToDollars(config.introductoryPriceCents), config.currency);
  const std = formatCurrency(centsToDollars(config.standardPriceCents), config.currency);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold text-white">Pricing</h1>
      <p className="mt-3 text-neutral-400">
        Engagement pricing is stored in configuration — not scattered through the codebase.
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-amber-500/30 bg-neutral-950 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
            Introductory — first {config.introductorySeats} clients
          </p>
          <p className="mt-4 text-4xl font-semibold text-white">
            {intro}
            <span className="text-base font-normal text-neutral-500"> / mo</span>
          </p>
          <p className="mt-3 text-sm text-neutral-400">
            Full platform access for early engagements while capacity allows.
          </p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Standard</p>
          <p className="mt-4 text-4xl font-semibold text-white">
            {std}
            <span className="text-base font-normal text-neutral-500"> / mo</span>
          </p>
          <p className="mt-3 text-sm text-neutral-400">
            After introductory seats are filled.
          </p>
        </div>
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/demo"
          className="rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-amber-400"
        >
          Book a Demo
        </Link>
        <a
          href={config.stripePaymentLink}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-neutral-700 px-5 py-2.5 text-sm font-medium text-neutral-100 hover:bg-neutral-900"
        >
          Activate / Start Engagement
        </a>
      </div>
      <p className="mt-4 text-xs text-neutral-600">
        Payment is processed by Stripe Payment Link. Subscription entitlement is confirmed by Kaivaryn after payment.
      </p>
    </div>
  );
}
