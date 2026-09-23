import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { buildCheckoutLink } from "@/lib/acquisition";
import { formatCurrency } from "@/lib/utils";
import { startPostDemoCheckout } from "./actions";

export const metadata: Metadata = { title: "Begin implementation" };
export const dynamic = "force-dynamic";

export default async function EngagementCheckoutPage({ params }: { params: { token: string } }) {
  const account = await prisma.acquisitionAccount.findUnique({ where: { checkoutToken: params.token } });
  if (!account) notFound();
  const checkout = await buildCheckoutLink(account.id);
  const paid = account.paymentStatus === "PAID";

  return (
    <div className="relative overflow-hidden">
      <div className="public-grid pointer-events-none absolute inset-0 opacity-25" />
      <div className="relative mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="public-kicker text-amber-400">Post-demo engagement</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">{paid ? "Payment confirmed. Move straight into onboarding." : "The demo is complete. Begin implementation."}</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400">This private handoff belongs to <span className="text-neutral-200">{account.company}</span>. The acquisition context already collected by Kaivaryn carries into implementation so your team does not start over.</p>
        <div className="public-card mt-8 p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><p className="text-[10px] uppercase tracking-wider text-neutral-500">Engagement</p><p className="mt-2 text-sm font-medium text-white">{account.selectedProduct || "Kaivaryn implementation"}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-neutral-500">Qualification</p><p className="mt-2 text-sm font-medium text-white">{account.qualificationScore}/100 · {account.qualificationBand}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-neutral-500">Modeled value</p><p className="mt-2 text-sm font-medium text-white">{account.estimatedDealValueCents ? formatCurrency(account.estimatedDealValueCents / 100) : "Validated in consultation"}</p></div>
          </div>
          {account.painSummary ? <div className="mt-6 border-t border-neutral-900 pt-5"><p className="text-[10px] uppercase tracking-wider text-neutral-500">Validated / stated context</p><p className="mt-2 text-sm leading-6 text-neutral-300">{account.painSummary}</p></div> : null}
          <div className="mt-7 flex flex-wrap gap-3">
            {paid ? <Link href="/activate" className="public-button-primary">Continue to onboarding <span aria-hidden>↗</span></Link> : checkout ? <form action={startPostDemoCheckout.bind(null, params.token)}><button className="public-button-primary">Begin implementation with Stripe <span aria-hidden>↗</span></button></form> : <span className="rounded-md border border-neutral-800 px-4 py-2 text-sm text-neutral-500">Checkout is not currently available.</span>}
            <Link href="/contact" className="public-button-secondary">Questions before activation?</Link>
          </div>
          {!paid ? <p className="mt-4 text-xs leading-5 text-neutral-600">Payment is verified server-side through Stripe before workspace entitlements are activated. A browser redirect alone never marks an engagement paid.</p> : null}
        </div>
      </div>
    </div>
  );
}
