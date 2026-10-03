import Link from "next/link";
import type { Metadata } from "next";
import { getPricingConfig, centsToDollars, resolveZoomSchedulerUrl } from "@/lib/pricing";
import { AmbientField, BreathGrid, Reveal, Magnetic, SectionRule, CountUpCurrency } from "@/components/motion";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Kaivaryn pricing: $10,000/month for our first 10 clients, then $20,000/month. Revenue Recovery and Operations Efficiency workspaces, activated after a demo.",
};
export const dynamic = "force-dynamic";

const included = ["Revenue Recovery and Operations Efficiency workspaces", "Nine-step analysis cycles with a signed record of findings", "Command, playbooks, standing orders, and run history", "Inbox briefings, initiatives, and operate health", "Tenant-isolated data and role-based access", "Evidence-aware intelligence and honest empty states", "Approval-gated actions and auditable decisions", "CSV imports, exports, and implementation guidance"];

export default async function PricingPage() {
  const config = await getPricingConfig();
  const introCents = centsToDollars(config.introductoryPriceCents);
  const standardCents = centsToDollars(config.standardPriceCents);
  const zoomUrl = resolveZoomSchedulerUrl(config.zoomMeetingUrl);
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <AmbientField intensity="hero" />
        <BreathGrid opacity={0.28} />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <p className="public-kicker text-amber-400">Pricing that starts with the work</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-6xl">Choose the engagement that matches your next decision.</h1>
            <div className="mt-5 h-px w-20 bg-gradient-to-r from-amber-400 to-transparent" />
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">Kaivaryn pricing is configuration-driven and capacity-aware. Start with a working session, then activate the operating model that fits your organization.</p>
          </Reveal>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <Reveal variant="up">
            <div className="public-card border-amber-500/30 p-7 sm:p-9">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="public-kicker text-amber-400">Introductory engagement</p>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400">First {config.introductorySeats} clients</span>
              </div>
              <p className="mt-6 text-5xl font-semibold tracking-tight text-white">
                <CountUpCurrency value={introCents} />
                <span className="text-base font-normal text-neutral-500"> / month</span>
              </p>
              <p className="mt-4 max-w-md text-sm leading-6 text-neutral-400">Founder cohort pricing: full platform access for the first engagements while implementation capacity allows. Same product surface as standard — capacity-limited, not feature-limited.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Magnetic><Link href="/demo" className="public-button-primary inline-block">Book executive working session <span aria-hidden>↗</span></Link></Magnetic>
                <a href={zoomUrl} target="_blank" rel="noopener noreferrer" className="public-button-secondary inline-block">Schedule on Zoom</a>
                <span className="inline-flex items-center text-xs text-neutral-500">Checkout unlocks after a completed demo.</span>
              </div>
            </div>
          </Reveal>
          <Reveal variant="up" delay={100}>
            <div className="public-card p-7 sm:p-9">
              <p className="public-kicker">Standard platform</p>
              <p className="mt-6 text-5xl font-semibold tracking-tight text-white">
                <CountUpCurrency value={standardCents} />
                <span className="text-base font-normal text-neutral-500"> / month</span>
              </p>
              <p className="mt-4 text-sm leading-6 text-neutral-400">Standard platform price after the founder cohort fills. Same Revenue Recovery + Operations Efficiency workspaces, tenant isolation, and approval-gated actions.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/demo" className="public-button-primary inline-block">Qualify for an engagement <span aria-hidden>↗</span></Link>
                <Link href="/contact" className="public-button-secondary inline-block">Ask a question</Link>
                <Link href="/value" className="public-button-secondary inline-block">Estimate opportunity</Link>
              </div>
            </div>
          </Reveal>
        </div>
        <SectionRule className="my-12" />
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <Reveal>
            <div>
              <p className="public-kicker">Included in every engagement</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">The standard stays high at every tier.</h2>
            </div>
          </Reveal>
          <ul className="grid gap-3 sm:grid-cols-2">
            {included.map((item, i) => (
              <Reveal key={item} delay={i * 50}>
                <li className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm leading-6 text-neutral-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-white/15 hover:bg-white/[0.04]">
                  <span className="mr-2 text-emerald-400">✓</span>{item}
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
        <Reveal>
          <div className="mt-10 flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm">
            <span className="text-neutral-400">Already completed a Kaivaryn demo and payment?</span>
            <Link href="/activate" className="text-amber-400 hover:text-amber-300">Continue to immediate onboarding →</Link>
          </div>
        </Reveal>
        <p className="mt-6 text-xs text-neutral-600">Checkout is offered only after a completed demo. Payment is verified securely before your workspace is activated, and you move straight into onboarding.</p>
      </section>
    </>
  );
}
