import Link from "next/link";
import { ExampleFrameworkChart } from "@/components/charts/example-framework-chart";
import type { Metadata } from "next";
import { ZOOM_SCHEDULER_URL } from "@/lib/constants";
import { AmbientField, BreathGrid, Reveal, Magnetic, SectionRule } from "@/components/motion";

export const metadata: Metadata = {
  title: "Revenue Recovery",
  description:
    "Find and recover revenue leakage — underbilling, missed fees, contract variance, denials — with an owned recovery queue and cash recovered tracked separately from estimates.",
};

const problem = [
  ["Hidden leakage", "Underbilling, underpayment, missed change orders, denials, and contract gaps sit in systems your teams already run."],
  ["Spreadsheets as memory", "Worklists fragment across analysts; aging and ownership disappear; estimates get booked as if they were cash."],
  ["No governed close", "Without evidence, approvals, and verified stages, recovery cannot survive an audit or an executive review."],
];

const method = [
  ["Surface", "Detect leakage signals from imports and structured sources — with INSUFFICIENT_DATA when evidence is missing."],
  ["Taxonomy + score", "Classify leakage type, rank by impact × urgency × confidence, and keep potential separate from recovered."],
  ["Own the queue", "Assign owners, attach notes and evidence, advance funnel stages, and gate high-value actions."],
  ["Prove", "Record recovered and verified amounts only when humans confirm — never invent realized cash."],
];

const workflow = [
  ["Identified", "Signal enters the pipeline with estimated potential."],
  ["Under review", "Evidence and owner assigned; confidence checked."],
  ["In recovery", "Approved work underway; in-progress amounts tracked."],
  ["Recovered / Verified", "Cash or credit confirmed; verified ≤ recovered always."],
];

const outcomes = [
  ["Open pipeline", "Estimated value still in motion — labeled estimate."],
  ["Recovery rate", "Recovered ÷ estimated for the portfolio you actually work."],
  ["Verified recovery", "Board-safe figure after human confirmation."],
  ["Decision trail", "Approvals, status history, and audit for every material move."],
];

export default function RevenueRecoveryPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <AmbientField intensity="hero" />
        <BreathGrid opacity={0.28} />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <p className="public-kicker text-amber-400">Solution / Revenue Recovery</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-6xl">
              Recover value that is already hiding in your operation.
            </h1>
            <div className="mt-5 h-px w-20 bg-gradient-to-r from-amber-400 to-transparent" />
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">
              Kaivaryn turns leakage signals into a ranked, owned recovery queue — with estimates never confused for cash.
              Built for finance and revenue leaders who need a consulting-grade operating system, not a vanity dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic><Link href="/demo" className="public-button-primary">Book a working session <span aria-hidden>↗</span></Link></Magnetic>
              <a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="public-button-secondary">Schedule on Zoom</a>
              <Link href="/value" className="public-button-secondary">Estimate opportunity</Link>
              <Link href="/pricing" className="public-button-secondary">View pricing</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="public-kicker text-amber-400">Problem</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Where recovery work usually breaks.</h2>
        <SectionRule className="mt-8 mb-2" />
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {problem.map(([t, b], i) => (
            <Reveal key={t} delay={i * 70}>
              <div className="public-card h-full p-7">
                <p className="font-mono text-xs text-amber-500">0{i + 1}</p>
                <h3 className="mt-4 text-lg font-semibold text-white">{t}</h3>
                <p className="mt-3 text-sm leading-6 text-neutral-500">{b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-neutral-900 bg-neutral-950/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="public-kicker text-amber-400">Method</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Detect → score → assign → prove.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {method.map(([t, b]) => (
              <div key={t} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                <h3 className="text-base font-semibold text-white">{t}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-500">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="public-kicker text-amber-400">Workflow</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">A recovery funnel executives can trust.</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {workflow.map(([t, b], i) => (
            <div key={t} className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
              <p className="font-mono text-xs text-amber-500">Stage {i + 1}</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{t}</h3>
              <p className="mt-2 text-sm text-neutral-500">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-neutral-900">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="public-kicker text-amber-400">Outcomes framework</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold text-white">What success looks like — without invented customer stats.</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {outcomes.map(([t, b]) => (
              <div key={t} className="public-card p-6">
                <h3 className="text-lg font-semibold text-white">{t}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-500">{b}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-neutral-500">
            We do not publish fabricated recovery averages or “trusted by” logos. Your workspace shows only your tenant’s recorded numbers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className="public-button-primary">Book executive demo <span aria-hidden>↗</span></Link>
            <Link href="/value" className="public-button-secondary">Run the value estimator</Link>
            <Link href="/how-it-works" className="public-button-secondary">See the operating loop</Link>
          </div>
        </div>
      </section>
          <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <Reveal variant="scale"><ExampleFrameworkChart /></Reveal>
      </section>
</>
  );
}
