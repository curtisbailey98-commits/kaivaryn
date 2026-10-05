import Link from "next/link";
import type { Metadata } from "next";
import {
  AmbientField,
  BreathGrid,
  SpotlightHero,
  Reveal,
  Magnetic,
  SectionRule,
  CountUpCurrency,
  StatusDot,
} from "@/components/motion";
import { getPublicPriceTeaser } from "@/lib/public-pricing";
import { LeakCalculator } from "@/components/public/leak-calculator";
import { WhatYouGet, BeforeAfterWorkflows, NinetyDayPlan, StayInControl, Faq, buildFaq, LowPressureCta } from "@/components/public/skeptic-sections";
import { TalkToVikiButton } from "@/components/voice/public-viki";

export const metadata: Metadata = {
  title: "Find the money your business is already losing",
  description:
    "Kaivaryn finds unpaid invoices, missed leads, underbilling, and hours lost to manual work in the records you already have, puts a dollar estimate on each, and works the list with your team. You approve every consequential step, and you see what was actually recovered.",
};

const revenueFinds = [
  "Underbilling and missed charges",
  "Underpayments against contract",
  "Pricing, discount, and renewal leakage",
  "Revenue lost to process gaps",
];

const operationsFinds = [
  "Manual, repetitive work",
  "Recurring bottlenecks and delays",
  "Rework and duplicate entry",
  "Automation opportunities worth funding",
];

export const dynamic = "force-dynamic";

/** Static, illustrative preview of the executive view. Not client data. */
function ExecutivePreview() {
  const rows = [
    { title: "Payer underpayments vs. contract", area: "Revenue", value: "$210,000", owner: "Revenue cycle lead", next: "Appeal batch approved" },
    { title: "Duplicate entry across ERP and CRM", area: "Operations", value: "$120,000 / yr", owner: "Operations manager", next: "Automation in progress" },
    { title: "Change orders delivered, not billed", area: "Revenue", value: "$95,500", owner: "Delivery finance", next: "Awaiting approval" },
  ];
  return (
    <div className="public-card relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
      <div className="relative flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">What the executive sees</p>
        <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-neutral-400">Illustrative · not client data</span>
      </div>
      <div className="relative mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06]">
        <div className="bg-neutral-950 p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Estimated revenue opportunity</p>
          <p className="mt-1.5 text-lg font-semibold text-white sm:text-xl">$305.5k</p>
        </div>
        <div className="bg-neutral-950 p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">Verified recovery</p>
          <p className="mt-1.5 text-lg font-semibold text-emerald-400 sm:text-xl">$45k</p>
        </div>
        <div className="bg-neutral-950 p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">Realized savings</p>
          <p className="mt-1.5 text-lg font-semibold text-emerald-400 sm:text-xl">$15k</p>
        </div>
      </div>
      <p className="relative mt-5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Highest-value issues</p>
      <ul className="relative mt-2 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-neutral-950/70">
        {rows.map((r) => (
          <li key={r.title} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-3 py-3 sm:px-4">
            <p className="text-sm font-medium text-white sm:truncate">{r.title}</p>
            <p className="text-right text-sm font-semibold text-amber-300">{r.value}</p>
            <p className="truncate text-[11px] text-neutral-500">{r.area} · {r.owner}</p>
            <p className="text-right text-[11px] text-neutral-400">{r.next}</p>
          </li>
        ))}
      </ul>
      <p className="relative mt-3 text-[11px] text-neutral-600">Estimates and verified results are shown side by side — never added together.</p>
    </div>
  );
}

export default async function HomePage() {
  const price = await getPublicPriceTeaser();
  const faq = buildFaq(price);
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <AmbientField intensity="hero" />
        <BreathGrid opacity={0.32} />
        <SpotlightHero className="relative">
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
            <div>
              <Reveal variant="up">
                <p className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-[11px] sm:tracking-[0.22em] text-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.08)]">
                  AI consulting + software · Revenue &amp; operations
                </p>
              </Reveal>
              <Reveal variant="up" delay={80}>
                <h1 className="mt-7 max-w-3xl text-[2.4rem] font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl lg:text-[3.5rem]">
                  Find the money your business is already losing.
                  <br />
                  <span className="text-neutral-500">Get it back, with your approval on every step.</span>
                </h1>
              </Reveal>
              <Reveal variant="up" delay={140}>
                <div className="mt-5 h-px w-24 bg-gradient-to-r from-amber-400 to-transparent" />
              </Reveal>
              <Reveal variant="up" delay={180}>
                <p className="mt-6 max-w-xl text-base leading-7 text-neutral-300 sm:text-lg">
                  Kaivaryn finds unpaid invoices, missed leads, underbilling, and hours lost to manual work in the records you already have. We put a dollar estimate on each one and work the list with your team. You see what was actually recovered, kept separate from what was estimated.
                </p>
              </Reveal>
              <Reveal variant="up" delay={240}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Magnetic strength={0.22}>
                    <Link href="/demo" className="public-button-primary">Book a demo <span aria-hidden>↗</span></Link>
                  </Magnetic>
                  <a href="#calculator" className="public-button-secondary">Estimate what&apos;s leaking <span aria-hidden>↓</span></a>
                </div>
                <p className="mt-3 text-xs text-neutral-500">Live on Zoom · No preparation needed · No payment link unless you decide it fits</p>
              </Reveal>
              <Reveal variant="fade" delay={320}>
                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-500">
                  <StatusDot tone="ok" label="Your own private workspace" className="text-neutral-400" />
                  <StatusDot tone="ok" label="You approve every consequential step" className="text-neutral-400" />
                  <StatusDot tone="ok" label="Estimates never passed off as results" className="text-neutral-400" />
                </div>
              </Reveal>
            </div>
            <Reveal variant="scale" delay={160}>
              <ExecutivePreview />
            </Reveal>
          </div>
        </SpotlightHero>
      </section>

      <section className="relative border-b border-neutral-900 bg-neutral-950/70" aria-label="What you get">
        <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
          <p className="public-kicker text-amber-400">What you get</p>
        </div>
        <WhatYouGet />
      </section>

      <section id="calculator" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24" aria-labelledby="calc-title">
        <Reveal>
          <div className="max-w-2xl">
            <p className="public-kicker text-amber-400">What&apos;s leaking in your business?</p>
            <h2 id="calc-title" className="public-heading mt-4">Run the math on your own numbers.</h2>
            <p className="mt-4 text-sm leading-6 text-neutral-400">
              Five common leaks. You enter the inputs, every formula is shown, and the result is clearly an estimate. Then compare it with what Kaivaryn costs.
            </p>
          </div>
        </Reveal>
        <div className="mt-10">
          <LeakCalculator introMonthly={price.intro} standardMonthly={price.standard} introSeats={price.seats} />
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-neutral-900 bg-neutral-950/60" aria-labelledby="workflows-title">
        <AmbientField intensity="subtle" grain={false} className="opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <Reveal>
            <div className="max-w-2xl">
              <p className="public-kicker text-amber-400">Before and after</p>
              <h2 id="workflows-title" className="public-heading mt-4">What actually changes on a Monday morning.</h2>
              <p className="mt-4 text-sm leading-6 text-neutral-400">Everyday problems, how they are handled today, and how they run with Kaivaryn, including what still needs your sign-off.</p>
            </div>
          </Reveal>
          <BeforeAfterWorkflows />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24" aria-labelledby="plan-title">
        <Reveal>
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="public-kicker text-amber-400">Your first 90 days</p>
              <h2 id="plan-title" className="public-heading mt-4">What happens, and when you&apos;ll know if it&apos;s working.</h2>
            </div>
            <Link href="/how-it-works" className="text-sm text-amber-400 hover:text-amber-300">How an engagement runs <span aria-hidden>→</span></Link>
          </div>
        </Reveal>
        <NinetyDayPlan />
      </section>

      <section className="relative overflow-hidden border-y border-neutral-900 bg-neutral-950/60" aria-labelledby="control-title">
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <Reveal>
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="public-kicker text-amber-400">How it works · You stay in control</p>
                <h2 id="control-title" className="public-heading mt-4">Nothing consequential happens without your approval.</h2>
                <p className="mt-4 text-sm leading-6 text-neutral-400">Kaivaryn finds the issue and puts a value on it. Your team decides and acts, and the result is recorded and checked.</p>
              </div>
              <Link href="/platform" className="text-sm text-amber-400 hover:text-amber-300">Security and governance detail <span aria-hidden>→</span></Link>
            </div>
          </Reveal>
          <StayInControl />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <div className="max-w-2xl">
            <p className="public-kicker">Two disciplines, one engagement</p>
            <h2 className="public-heading mt-4">Recover revenue you&apos;ve earned. Cut work that shouldn&apos;t exist.</h2>
          </div>
        </Reveal>
        <SectionRule className="mt-8 mb-2" />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <Reveal variant="up" delay={40}>
            <Link href="/solutions/revenue-recovery" className="public-card group relative block h-full overflow-hidden p-7 sm:p-8">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl transition group-hover:bg-amber-400/20" />
              <p className="public-kicker text-amber-400">Revenue Recovery</p>
              <h3 className="mt-5 text-2xl font-semibold text-white">Recover money you have already earned.</h3>
              <p className="mt-3 max-w-lg text-sm leading-6 text-neutral-400">
                Revenue that should be yours but never arrives. Kaivaryn finds it, sizes it, and tracks it until the cash is recovered and verified.
              </p>
              <ul className="mt-5 grid gap-2 text-sm text-neutral-300 sm:grid-cols-2">
                {revenueFinds.map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-amber-400">—</span>{f}</li>
                ))}
              </ul>
              <span className="mt-7 inline-block text-sm font-medium text-amber-400">Revenue Recovery <span aria-hidden>→</span></span>
            </Link>
          </Reveal>
          <Reveal variant="up" delay={120}>
            <Link href="/solutions/operations-efficiency" className="public-card group relative block h-full overflow-hidden p-7 sm:p-8">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl transition group-hover:bg-emerald-400/20" />
              <p className="public-kicker text-emerald-400">Operations Efficiency</p>
              <h3 className="mt-5 text-2xl font-semibold text-white">Stop paying for work that shouldn&apos;t exist.</h3>
              <p className="mt-3 max-w-lg text-sm leading-6 text-neutral-400">
                Labor and time lost to friction your team has learned to live with. Kaivaryn puts a cost on it and tracks savings until they are realized.
              </p>
              <ul className="mt-5 grid gap-2 text-sm text-neutral-300 sm:grid-cols-2">
                {operationsFinds.map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-emerald-400">—</span>{f}</li>
                ))}
              </ul>
              <span className="mt-7 inline-block text-sm font-medium text-emerald-400">Operations Efficiency <span aria-hidden>→</span></span>
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-neutral-900 bg-neutral-950/60" aria-labelledby="pricing-title">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr_0.9fr] lg:items-center">
          <Reveal>
            <p className="public-kicker">Pricing</p>
            <h2 id="pricing-title" className="mt-3 text-2xl font-semibold text-white">One engagement. Both disciplines. Full software access.</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">Is it worth it? Use the <a href="#calculator" className="text-amber-400 hover:text-amber-300">calculator</a> with your own numbers. Terms are agreed in writing before any payment, and the payment link only comes after the demo.</p>
            <Link href="/pricing" className="mt-4 inline-block text-sm text-amber-400 hover:text-amber-300">Pricing details <span aria-hidden>→</span></Link>
          </Reveal>
          <Reveal variant="up" delay={80}>
            <div className="public-card border-amber-500/30 p-6">
              <p className="public-kicker text-amber-400">First {price.seats} clients</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-white"><CountUpCurrency value={price.intro} /><span className="text-sm font-normal text-neutral-500"> / month</span></p>
            </div>
          </Reveal>
          <Reveal variant="up" delay={140}>
            <div className="public-card p-6">
              <p className="public-kicker">Standard</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-white"><CountUpCurrency value={price.standard} /><span className="text-sm font-normal text-neutral-500"> / month</span></p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-24" aria-labelledby="faq-title">
        <Reveal>
          <p className="public-kicker text-amber-400">Straight answers</p>
          <h2 id="faq-title" className="public-heading mt-4">The questions a careful owner asks.</h2>
        </Reveal>
        <Faq items={faq} />
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-labelledby="talk-to-viki">
        <Reveal>
          <div className="relative grid gap-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] via-transparent to-amber-500/[0.05] p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <div className="relative h-16 w-16 shrink-0 rounded-full shadow-[0_0_0_1px_rgba(161,161,170,0.35),0_0_36px_rgba(245,158,11,0.18)]" style={{ background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.85), rgba(212,212,216,0.5) 22%, rgba(82,82,91,0.75) 55%, rgba(10,10,10,0.95) 78%)" }} aria-hidden />
            <div>
              <p className="public-kicker">Prefer to talk it through?</p>
              <h2 id="talk-to-viki" className="mt-3 text-xl font-semibold text-white sm:text-2xl">Talk to Viki, Kaivaryn&apos;s AI voice assistant.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
                Describe what&apos;s happening in your business. Viki asks a few questions, tells you whether Revenue Recovery or Operations Efficiency is the better fit, answers common questions, and points you to an executive demo when it makes sense. She&apos;s an AI, and she won&apos;t quote results she can&apos;t stand behind.
              </p>
            </div>
            <TalkToVikiButton />
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <LowPressureCta heading="Where is your business losing money, and what is it worth?" />
        </Reveal>
      </section>
    </>
  );
}
