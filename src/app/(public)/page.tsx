import Link from "next/link";
import type { Metadata } from "next";
import { ZOOM_SCHEDULER_URL } from "@/lib/constants";
import { ExampleFrameworkChart } from "@/components/charts/example-framework-chart";
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
import { CommandRoutingDemo } from "@/components/public/command-routing-demo";
import { NineReturnRing } from "@/components/public/nine-return-ring";
import { OPERATING_LOOP, PLATFORM_LAYERS } from "@/lib/public-story";
import { getPricingConfig, centsToDollars } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Executive AI Consulting Firm",
  description: "Kaivaryn diagnoses leakage and operational friction, recommends interventions, and measures results through a private intelligence workspace.",
};

const operatingModel = [
  ["01", "See the signal", "Surface leakage, bottlenecks, and unresolved work from the data your teams already create."],
  ["02", "Rank consequence", "Focus attention on economic impact, urgency, confidence, and ease of recovery—not volume."],
  ["03", "Govern the action", "Assign ownership, preserve approvals, and keep every material decision traceable."],
  ["04", "Measure the result", "Separate potential value from verified recovery or realized savings after execution."],
];

export const dynamic = "force-dynamic";

async function pricingTeaser() {
  try {
    const c = await getPricingConfig();
    return { seats: c.introductorySeats, intro: centsToDollars(c.introductoryPriceCents), standard: centsToDollars(c.standardPriceCents) };
  } catch {
    // Pricing still renders if the database is briefly unavailable; values mirror the seeded PricingConfig.
    return { seats: 10, intro: 10_000, standard: 20_000 };
  }
}

export default async function HomePage() {
  const price = await pricingTeaser();
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <AmbientField intensity="hero" />
        <BreathGrid opacity={0.32} />
        <SpotlightHero className="relative">
          <div className="relative mx-auto grid max-w-6xl gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
            <div>
              <Reveal variant="up">
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-400">
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 shadow-[0_0_24px_rgba(245,158,11,0.08)]">Executive AI Consulting</span>
                  <span className="text-neutral-500">Private intelligence for consequential decisions</span>
                </div>
              </Reveal>
              <Reveal variant="up" delay={80}>
                <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
                  Find the money.
                  <br />
                  <span className="text-neutral-500">Remove the friction.</span>
                </h1>
              </Reveal>
              <Reveal variant="up" delay={140}>
                <div className="mt-5 h-px w-24 bg-gradient-to-r from-amber-400 to-transparent" />
              </Reveal>
              <Reveal variant="up" delay={180}>
                <p className="mt-7 max-w-xl text-base leading-7 text-neutral-300 sm:text-lg">
                  Kaivaryn is an operating intelligence for revenue and operations. Ask a question, and it routes the work: evidence-backed analysis, an owned plan behind an approval gate, and a briefing on what changed — measured against what was actually recovered.
                </p>
              </Reveal>
              <Reveal variant="up" delay={240}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Magnetic strength={0.22}>
                    <Link href="/demo" className="public-button-primary">Book a working session <span aria-hidden>↗</span></Link>
                  </Magnetic>
                  <a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="public-button-secondary">Schedule on Zoom</a>
                  <Link href="/platform" className="public-button-secondary">See the platform</Link>
                </div>
              </Reveal>
              <Reveal variant="fade" delay={320}>
                <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-500">
                  <StatusDot tone="ok" label="Tenant-isolated" className="text-neutral-400" />
                  <StatusDot tone="ok" label="Approval-gated" className="text-neutral-400" />
                  <StatusDot tone="ok" label="Evidence-aware" className="text-neutral-400" />
                  <StatusDot tone="ok" label="Deterministic engines" className="text-neutral-400" />
                </div>
              </Reveal>
            </div>
            <Reveal variant="scale" delay={160}>
              <div className="relative">
                <CommandRoutingDemo />
                <p className="mt-3 text-right text-[10px] uppercase tracking-[0.16em] text-neutral-600">The product&apos;s real routing rules · no customer data</p>
              </div>
            </Reveal>
          </div>
        </SpotlightHero>
      </section>

      <section className="relative border-b border-neutral-900 bg-neutral-950/70">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
          {[
            ["For finance leaders", "Turn leakage into an owned recovery queue."],
            ["For operations leaders", "Turn recurring friction into governed improvement."],
            ["For executives", "See what matters, why it matters, and what happens next."],
          ].map(([t, b], i) => (
            <Reveal key={t} variant="up" delay={i * 80}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t}</p>
                <p className="mt-2 text-sm text-neutral-300">{b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal>
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="public-kicker">Two products. One operating standard.</p>
              <h2 className="public-heading mt-4 max-w-2xl">A sharper way to move from signal to outcome.</h2>
            </div>
            <Link href="/solutions/revenue-recovery" className="text-sm text-amber-400 hover:text-amber-300">Explore solutions <span aria-hidden>↗</span></Link>
          </div>
        </Reveal>
        <SectionRule className="mt-8 mb-2" />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <Reveal variant="up" delay={40}>
            <Link href="/solutions/revenue-recovery" className="public-card group relative block overflow-hidden p-7 sm:p-8">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl transition group-hover:bg-amber-400/20" />
              <p className="public-kicker text-amber-400">01 / Revenue Recovery</p>
              <h3 className="mt-5 text-2xl font-semibold text-white">Recover what should already be yours.</h3>
              <p className="mt-3 max-w-lg text-sm leading-6 text-neutral-400">Find underbilling, underpayment, missed change orders, and policy gaps. Prioritize the work. Track estimated value separately from verified recovery.</p>
              <span className="mt-8 inline-block text-sm font-medium text-amber-400">View the revenue workflow <span aria-hidden>→</span></span>
            </Link>
          </Reveal>
          <Reveal variant="up" delay={120}>
            <Link href="/solutions/operations-efficiency" className="public-card group relative block overflow-hidden p-7 sm:p-8">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl transition group-hover:bg-emerald-400/20" />
              <p className="public-kicker text-emerald-400">02 / Operations Efficiency</p>
              <h3 className="mt-5 text-2xl font-semibold text-white">Remove the friction your team has learned to ignore.</h3>
              <p className="mt-3 max-w-lg text-sm leading-6 text-neutral-400">Surface rework, queue delay, and repeatable manual effort. Approve automation candidates without pretending an external action happened.</p>
              <span className="mt-8 inline-block text-sm font-medium text-emerald-400">View the operations workflow <span aria-hidden>→</span></span>
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-neutral-900 bg-neutral-950/60">
        <AmbientField intensity="subtle" grain={false} className="opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <Reveal>
                <p className="public-kicker text-amber-400">How the operating intelligence works</p>
                <h2 className="public-heading mt-4 max-w-xl">From a sentence to a governed, measured outcome.</h2>
                <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-400">Every step below is a recorded run inside your private workspace. Analysis is rule-based and repeatable; a person approves before anything consequential moves.</p>
              </Reveal>
              <ol className="mt-10 grid gap-3 sm:grid-cols-2">
                {OPERATING_LOOP.map((s, i) => (
                  <Reveal key={s.n} variant="up" delay={i * 60}>
                    <li className="group h-full rounded-xl border border-white/[0.08] bg-neutral-950/70 p-4 transition hover:border-amber-500/30">
                      <p className="flex items-center gap-2 font-mono text-[11px] text-amber-500">{s.n}<span className="h-px flex-1 bg-gradient-to-r from-amber-500/40 to-transparent transition-all group-hover:from-amber-400" /></p>
                      <p className="mt-2 text-base font-semibold text-white">{s.name}</p>
                      <p className="mt-1 text-xs leading-5 text-neutral-500">{s.body}</p>
                    </li>
                  </Reveal>
                ))}
              </ol>
            </div>
            <Reveal variant="scale" delay={120}>
              <div className="public-card p-6 sm:p-8">
                <NineReturnRing />
                <p className="mt-4 text-center text-sm text-neutral-400">The analysis step runs nine bounded stages — from what the data shows to a signed record — then stops. No open-ended loops.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="public-kicker">The platform</p>
              <h2 className="public-heading mt-4 max-w-2xl">Five layers. One accountable system.</h2>
            </div>
            <Link href="/platform" className="text-sm text-amber-400 hover:text-amber-300">Explore the architecture <span aria-hidden>↗</span></Link>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-3 md:grid-cols-5">
          {[...PLATFORM_LAYERS].reverse().map((layer, i) => (
            <Reveal key={layer.n} variant="up" delay={i * 60}>
              <Link href="/platform" className="public-card group relative block h-full overflow-hidden p-5">
                <div className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-amber-500 to-amber-300 transition duration-500 group-hover:scale-x-100" />
                <p className="font-mono text-xs text-amber-500">{layer.n}</p>
                <p className="mt-3 text-sm font-semibold text-white">{layer.name}</p>
                <p className="mt-2 text-[11px] leading-5 text-neutral-500">{layer.items.slice(0, 3).join(" · ")}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative border-y border-neutral-900 bg-neutral-950/60">
        <AmbientField intensity="subtle" grain={false} className="opacity-70" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <Reveal>
            <div>
              <p className="public-kicker">The Kaivaryn standard</p>
              <h2 className="public-heading mt-4 max-w-lg">Fast enough for the business. Disciplined enough for the board.</h2>
              <p className="mt-5 max-w-lg text-sm leading-6 text-neutral-400">Every recommendation is grounded in recorded signals, explicit confidence, and a visible next step. When the data is not enough, Kaivaryn says so.</p>
              <Link href="/intelligence" className="mt-7 inline-block text-sm text-amber-400 hover:text-amber-300">How intelligence stays honest <span aria-hidden>→</span></Link>
            </div>
          </Reveal>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-800 sm:grid-cols-2">
            {operatingModel.map(([number, title, body], i) => (
              <Reveal key={number} variant="fade" delay={i * 70}>
                <div className="h-full bg-neutral-950 p-6 transition hover:bg-neutral-900/80 sm:p-7">
                  <p className="font-mono text-xs text-amber-500">{number}</p>
                  <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <div className="mb-8 max-w-2xl">
            <p className="public-kicker">Example framework</p>
            <h2 className="public-heading mt-4">How modeled opportunity becomes verified result.</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              An illustrative series showing Kaivaryn&apos;s operating rhythm. Not a customer&apos;s live data and not a performance claim.
            </p>
          </div>
        </Reveal>
        <Reveal variant="scale" delay={80}>
          <ExampleFrameworkChart />
        </Reveal>
      </section>

      <section className="border-y border-neutral-900 bg-neutral-950/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1fr_1fr] lg:items-center">
          <Reveal>
            <p className="public-kicker">Pricing</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">One platform. Capacity-limited, not feature-limited.</h2>
            <Link href="/pricing" className="mt-5 inline-block text-sm text-amber-400 hover:text-amber-300">Full pricing <span aria-hidden>→</span></Link>
          </Reveal>
          <Reveal variant="up" delay={80}>
            <div className="public-card border-amber-500/30 p-6">
              <p className="public-kicker text-amber-400">Founder cohort · first {price.seats} clients</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-white"><CountUpCurrency value={price.intro} /><span className="text-sm font-normal text-neutral-500"> / month</span></p>
            </div>
          </Reveal>
          <Reveal variant="up" delay={140}>
            <div className="public-card p-6">
              <p className="public-kicker">Standard platform · after the cohort</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-white"><CountUpCurrency value={price.standard} /><span className="text-sm font-normal text-neutral-500"> / month</span></p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <div className="public-card relative flex flex-col items-start justify-between gap-8 overflow-hidden bg-amber-500/[0.06] p-7 sm:flex-row sm:items-center sm:p-10">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" />
            <div>
              <p className="public-kicker text-amber-400">Start with the business question</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">Where is value being lost—and who owns the next move?</h2>
            </div>
            <Magnetic>
              <Link href="/demo" className="public-button-primary relative shrink-0">Book a working session <span aria-hidden>↗</span></Link>
            </Magnetic>
          </div>
        </Reveal>
      </section>
    </>
  );
}
