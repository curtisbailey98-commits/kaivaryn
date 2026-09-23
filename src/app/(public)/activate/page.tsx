import Link from "next/link";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = { title: "Activate your workspace" };

export default async function ActivatePage() {
  const session = await getServerSession(authOptions);
  const callback = "/app/onboarding?from=payment";
  const destination = session?.user?.id ? callback : `/login?callbackUrl=${encodeURIComponent(callback)}`;
  const registerDestination = `/register?callbackUrl=${encodeURIComponent(callback)}`;
  return (
    <div className="relative overflow-hidden">
      <div className="public-grid pointer-events-none absolute inset-0 opacity-25" />
      <div className="relative mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="public-kicker text-amber-400">Payment handoff / workspace activation</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-6xl">Your next step is to make the workspace yours.</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">If you have just completed a Kaivaryn payment or engagement step, continue here to sign in and finish your organization setup. Your onboarding progress is saved as you move.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="public-card p-5"><p className="font-mono text-xs text-amber-500">01</p><p className="mt-3 text-sm font-semibold text-white">Confirm access</p><p className="mt-2 text-xs leading-5 text-neutral-500">Sign in or create the account tied to your engagement.</p></div>
          <div className="public-card p-5"><p className="font-mono text-xs text-amber-500">02</p><p className="mt-3 text-sm font-semibold text-white">Configure scope</p><p className="mt-2 text-xs leading-5 text-neutral-500">Choose products, review integrations, and confirm your team.</p></div>
          <div className="public-card p-5"><p className="font-mono text-xs text-amber-500">03</p><p className="mt-3 text-sm font-semibold text-white">Enter the command center</p><p className="mt-2 text-xs leading-5 text-neutral-500">Start with the signals most likely to create measurable value.</p></div>
        </div>
        <div className="mt-10 flex flex-wrap gap-3"><Link href={destination} className="public-button-primary">Continue to activation <span aria-hidden>↗</span></Link>{!session?.user?.id ? <Link href={registerDestination} className="public-button-secondary">Create client access</Link> : null}<Link href="/contact" className="public-button-secondary">Need help?</Link></div>
        <p className="mt-5 text-xs text-neutral-600">Payment status is verified server-side through the Stripe webhook. Use the same work email from your post-demo engagement so Kaivaryn can attach you to the provisioned workspace.</p>
      </div>
    </div>
  );
}
