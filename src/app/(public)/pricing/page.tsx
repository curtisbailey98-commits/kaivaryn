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

const included = [
  "Revenue Recovery — find, rank, and recover lost revenue",
  "Operations Efficiency — find and remove costly friction",
  "Ranked findings with evidence and a dollar value",
  "An owner, next step, and approval path on every finding",
  "Verified recovery and realized savings, tracked apart from estimates",
  "Executive briefings, reporting, and exports",
  "Private, isolated workspace with role-based access",
  "Data import and implementation support from Kaivaryn operators",
];

const path = [
  ["Working session", "A live executive session on one real business question."],
  ["Fit and agreement", "We confirm scope, data, and fit, and agree terms."],
  ["Secure payment", "A checkout link is shared after the agreement — never before."],
  ["Onboarding", "Your workspace is activated and onboarding starts right away."],
] as const;

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
            <p className="public-kicker text-amber-400">Pricing</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-6xl">One engagement. Both disciplines. Full software access.</h1>
            <div className="mt-5 h-px w-20 bg-gradient-to-r from-amber-400 to-transparent" />
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">Revenue Recovery, Operations Efficiency, the Kaivaryn software, and our operators in one monthly engagement. It starts with a demo, not a checkout page.</p>
          </Reveal>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <Reveal variant="up">
            <div className="public-card border-amber-500/30 p-7 sm:p-9">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="public-kicker text-amber-400">Founding clients</p>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400">First {config.introductorySeats} clients</span>
              </div>
              <p className="mt-6 text-5xl font-semibold tracking-tight text-white">
                <CountUpCurrency value={introCents} />
                <span className="text-base font-normal text-neutral-500"> / month</span>
              </p>
              <p className="mt-4 max-w-md text-sm leading-6 text-neutral-400">Our first clients get the full engagement at founding-client pricing. Same scope as standard — limited by our capacity, not by features.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Magnetic><Link href="/demo" className="public-button-primary inline-block">Book a demo <span aria-hidden>↗</span></Link></Magnetic>
                <a href={zoomUrl} target="_blank" rel="noopener noreferrer" className="public-button-secondary inline-block">Schedule on Zoom</a>
                              </div>
            </div>
          </Reveal>
          <Reveal variant="up" delay={100}>
            <div className="public-card p-7 sm:p-9">
              <p className="public-kicker">Standard</p>
              <p className="mt-6 text-5xl font-semibold tracking-tight text-white">
                <CountUpCurrency value={standardCents} />
                <span className="text-base font-normal text-neutral-500"> / month</span>
              </p>
              <p className="mt-4 text-sm leading-6 text-neutral-400">Standard pricing once the founding seats are filled. The same Revenue Recovery and Operations Efficiency engagement.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/demo" className="public-button-secondary inline-block">Book a demo</Link>
                <Link href="/contact" className="public-button-secondary inline-block">Ask a question</Link>
              </div>
            </div>
          </Reveal>
        </div>
        <SectionRule className="my-12" />
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <Reveal>
            <div>
              <p className="public-kicker">Included</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Everything, at every price point.</h2>
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
        <SectionRule className="my-12" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal>
            <div className="public-card h-full p-6">
              <p className="public-kicker text-amber-400">Is it worth it?</p>
              <h2 className="mt-3 text-xl font-semibold text-white">Check it against your own numbers.</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">The leak calculator uses your overdue invoices, missed calls, quote volume, admin hours, and lost customers, shows every formula, and compares the estimate with the fee. It&apos;s an estimate, not a promise.</p>
              <Link href="/#calculator" className="mt-4 inline-block text-sm font-medium text-amber-400 hover:text-amber-300">Open the calculator →</Link>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="public-card h-full p-6">
              <p className="public-kicker">What if it doesn&apos;t work?</p>
              <h2 className="mt-3 text-xl font-semibold text-white">You&apos;ll know early, in your own workspace.</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">The first findings come with dollar estimates and evidence, targeted for weeks 1–2 once your records are in. Every recovered dollar and saved hour is recorded against the issue that produced it, so the scorecard is yours. Commitment length and terms are agreed in writing before any payment.</p>
            </div>
          </Reveal>
        </div>
        <SectionRule className="my-12" />
        <Reveal>
          <p className="public-kicker">How an engagement starts</p>
        </Reveal>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {path.map(([title, body], i) => (
            <Reveal key={title} delay={i * 60}>
              <li className="h-full rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                <p className="font-mono text-xs text-amber-500">0{i + 1}</p>
                <p className="mt-2 text-base font-semibold text-white">{title}</p>
                <p className="mt-1.5 text-sm leading-6 text-neutral-400">{body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
        <Reveal>
          <div className="mt-10 flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm">
            <span className="text-neutral-400">Already signed and paid?</span>
            <Link href="/activate" className="text-amber-400 hover:text-amber-300">Continue to onboarding →</Link>
          </div>
        </Reveal>
        <p className="mt-6 text-xs text-neutral-600">Payment is verified securely before your workspace is activated.</p>
      </section>
    </>
  );
}
