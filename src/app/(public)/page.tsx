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
  CountUp,
  CountUpCurrency,
  StatusDot,
} from "@/components/motion";

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

export default function HomePage() {
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
                  Kaivaryn combines executive AI advisory, operating infrastructure, and enterprise intelligence to turn hidden revenue and operational friction into governed, measurable action.
                </p>
              </Reveal>
              <Reveal variant="up" delay={240}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Magnetic strength={0.22}>
                    <Link href="/demo" className="public-button-primary">Book a working session <span aria-hidden>↗</span></Link>
                  </Magnetic>
                  <a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="public-button-secondary">Schedule on Zoom</a>
                  <Link href="/how-it-works" className="public-button-secondary">See the operating model</Link>
                </div>
              </Reveal>
              <Reveal variant="fade" delay={320}>
                <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-500">
                  <StatusDot tone="ok" label="Tenant-isolated" className="text-neutral-400" />
                  <StatusDot tone="ok" label="Approval-gated" className="text-neutral-400" />
                  <StatusDot tone="ok" label="Evidence-aware" className="text-neutral-400" />
                </div>
              </Reveal>
            </div>
            <Reveal variant="scale" delay={160}>
              <div className="relative">
                <div className="public-terminal relative overflow-hidden rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                    <span>Executive signal room</span>
                    <StatusDot tone="ok" label="Illustrative" className="text-emerald-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 py-5">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Recovery pipeline</p>
                      <p className="mt-3 text-2xl font-semibold text-white">
                        <CountUpCurrency value={2480000} />
                      </p>
                      <p className="mt-1 text-xs text-emerald-400">+14.8% surfaced this cycle</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Open decisions</p>
                      <p className="mt-3 text-2xl font-semibold text-white">
                        <CountUp value={12} />
                      </p>
                      <p className="mt-1 text-xs text-amber-400">3 need executive review</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-amber-400">Priority signal</p>
                        <h2 className="mt-2 text-base font-semibold text-white">Unbilled change orders</h2>
                        <p className="mt-1 text-xs leading-5 text-neutral-400">18 records · high confidence · owner unassigned</p>
                      </div>
                      <span className="rounded-full border border-amber-500/30 px-2 py-1 text-[10px] font-semibold text-amber-400">REVIEW</span>
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                      <div className="h-full w-[76%] rounded-full bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.45)]" />
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-neutral-500"><span>Impact score 76</span><span>Evidence 4/4</span></div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                    <div className="rounded-lg bg-white/[0.03] px-2 py-3"><span className="block text-amber-400">01</span>Observed</div>
                    <div className="rounded-lg bg-white/[0.03] px-2 py-3"><span className="block text-amber-400">02</span>Assigned</div>
                    <div className="rounded-lg bg-white/[0.03] px-2 py-3"><span className="block text-amber-400">03</span>Measured</div>
                  </div>
                </div>
                <p className="mt-3 text-right text-[10px] uppercase tracking-[0.16em] text-neutral-600">Illustrative workspace · no fabricated customer data</p>
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
