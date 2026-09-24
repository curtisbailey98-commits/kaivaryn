import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recover Revenue. Remove Friction.",
  description: "Kaivaryn turns operational signals into governed, measurable action for finance and operations leaders.",
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
        <div className="public-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -right-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-400">
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">Executive AI Consulting</span>
              <span className="text-neutral-500">Private intelligence for consequential decisions</span>
            </div>
            <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
              Find the money.
              <br />
              <span className="text-neutral-500">Remove the friction.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-neutral-300 sm:text-lg">
              Kaivaryn combines executive AI advisory, operating infrastructure, and enterprise intelligence to turn hidden revenue and operational friction into governed, measurable action.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/demo" className="public-button-primary">Book a working session <span aria-hidden>↗</span></Link>
              <Link href="/how-it-works" className="public-button-secondary">See the operating model</Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-500">
              <span><span className="mr-2 text-emerald-400">●</span>Tenant-isolated</span>
              <span><span className="mr-2 text-emerald-400">●</span>Approval-gated</span>
              <span><span className="mr-2 text-emerald-400">●</span>Evidence-aware</span>
            </div>
          </div>

          <div className="relative">
            <div className="public-terminal relative overflow-hidden rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                <span>Executive signal room</span>
                <span className="flex items-center gap-2 text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Live model</span>
              </div>
              <div className="grid grid-cols-2 gap-3 py-5">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Recovery pipeline</p>
                  <p className="mt-3 text-2xl font-semibold text-white">$2.48M</p>
                  <p className="mt-1 text-xs text-emerald-400">+14.8% surfaced this cycle</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Open decisions</p>
                  <p className="mt-3 text-2xl font-semibold text-white">12</p>
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
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-neutral-800"><div className="h-full w-[76%] rounded-full bg-amber-400" /></div>
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
        </div>
      </section>

      <section className="border-b border-neutral-900 bg-neutral-950/70">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">For finance leaders</p><p className="mt-2 text-sm text-neutral-300">Turn leakage into an owned recovery queue.</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">For operations leaders</p><p className="mt-2 text-sm text-neutral-300">Turn recurring friction into governed improvement.</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">For executives</p><p className="mt-2 text-sm text-neutral-300">See what matters, why it matters, and what happens next.</p></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div><p className="public-kicker">Two products. One operating standard.</p><h2 className="public-heading mt-4 max-w-2xl">A sharper way to move from signal to outcome.</h2></div>
          <Link href="/solutions/revenue-recovery" className="text-sm text-amber-400 hover:text-amber-300">Explore solutions <span aria-hidden>↗</span></Link>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <Link href="/solutions/revenue-recovery" className="public-card group relative overflow-hidden p-7 sm:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl transition group-hover:bg-amber-400/20" />
            <p className="public-kicker text-amber-400">01 / Revenue Recovery</p>
            <h3 className="mt-5 text-2xl font-semibold text-white">Recover what should already be yours.</h3>
            <p className="mt-3 max-w-lg text-sm leading-6 text-neutral-400">Find underbilling, underpayment, missed change orders, and policy gaps. Prioritize the work. Track estimated value separately from verified recovery.</p>
            <span className="mt-8 inline-block text-sm font-medium text-amber-400">View the revenue workflow <span aria-hidden>→</span></span>
          </Link>
          <Link href="/solutions/operations-efficiency" className="public-card group relative overflow-hidden p-7 sm:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl transition group-hover:bg-emerald-400/20" />
            <p className="public-kicker text-emerald-400">02 / Operations Efficiency</p>
            <h3 className="mt-5 text-2xl font-semibold text-white">Remove the friction your team has learned to ignore.</h3>
            <p className="mt-3 max-w-lg text-sm leading-6 text-neutral-400">Surface rework, queue delay, and repeatable manual effort. Approve automation candidates without pretending an external action happened.</p>
            <span className="mt-8 inline-block text-sm font-medium text-emerald-400">View the operations workflow <span aria-hidden>→</span></span>
          </Link>
        </div>
      </section>

      <section className="border-y border-neutral-900 bg-neutral-950/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <div><p className="public-kicker">The Kaivaryn standard</p><h2 className="public-heading mt-4 max-w-lg">Fast enough for the business. Disciplined enough for the board.</h2><p className="mt-5 max-w-lg text-sm leading-6 text-neutral-400">Every recommendation is grounded in recorded signals, explicit confidence, and a visible next step. When the data is not enough, Kaivaryn says so.</p><Link href="/intelligence" className="mt-7 inline-block text-sm text-amber-400 hover:text-amber-300">How intelligence stays honest <span aria-hidden>→</span></Link></div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-800 sm:grid-cols-2">
            {operatingModel.map(([number, title, body]) => <div key={number} className="bg-neutral-950 p-6 sm:p-7"><p className="font-mono text-xs text-amber-500">{number}</p><h3 className="mt-4 text-base font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-neutral-500">{body}</p></div>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="public-card flex flex-col items-start justify-between gap-8 bg-amber-500/[0.06] p-7 sm:flex-row sm:items-center sm:p-10">
          <div><p className="public-kicker text-amber-400">Start with the business question</p><h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">Where is value being lost—and who owns the next move?</h2></div>
          <Link href="/demo" className="public-button-primary shrink-0">Book a working session <span aria-hidden>↗</span></Link>
        </div>
      </section>
    </>
  );
}
