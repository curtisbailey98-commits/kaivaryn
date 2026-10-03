import Link from "next/link";
import type { Metadata } from "next";
import { AmbientField, BreathGrid, Reveal, Magnetic, SectionRule } from "@/components/motion";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How a Kaivaryn engagement runs: bring the evidence, find and rank the issues by financial impact, assign owners and approvals, and measure what was actually recovered or saved.",
};

const steps = [
  ["01", "Bring the evidence", "We start with the records behind one business question — billing exports, contracts, claims, time studies, queue data. Imported securely into your private workspace."],
  ["02", "Find the issues", "Kaivaryn analyzes the evidence for revenue leakage and operating friction. Where the data is thin, it says so instead of guessing."],
  ["03", "Quantify and rank", "Every issue gets a dollar value and a confidence level, then is ranked so your team sees the highest-value work first."],
  ["04", "Assign and approve", "Each finding gets an owner, a next step, and an approval path. Consequential actions wait for a decision."],
  ["05", "Execute", "Your team does the work. Kaivaryn tracks status, tasks, and evidence — it never acts in your systems on its own."],
  ["06", "Measure and verify", "Recovered revenue and realized savings are recorded against the finding that produced them, then verified. Estimates stay separate."],
] as const;

const engagement = [
  ["Week 1", "Evidence in", "We agree the business question and import the records behind it. Connection status for each system is always visible."],
  ["Weeks 1–2", "First findings", "A ranked list of revenue and operations issues, each with a value, evidence, and confidence."],
  ["Week 2 onward", "Operating rhythm", "Owners work the list. Approvals gate the big moves. Executives get a regular briefing on what changed."],
  ["Ongoing", "Measured results", "Recovered cash and realized savings are recorded and verified against the original findings."],
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <AmbientField intensity="hero" />
        <BreathGrid opacity={0.28} />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <p className="public-kicker text-amber-400">How it works</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-6xl">Find it. Rank it. Fix it. Prove it.</h1>
            <div className="mt-5 h-px w-20 bg-gradient-to-r from-amber-400 to-transparent" />
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg">Kaivaryn is not a black box. Every finding comes with its evidence, every action has an owner and an approval, and every result is recorded and verified.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic><Link href="/demo" className="public-button-primary">Book a working session <span aria-hidden>↗</span></Link></Magnetic>
              <Link href="/pricing" className="public-button-secondary">View pricing</Link>
            </div>
          </Reveal>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionRule className="mb-10" />
        <div className="grid gap-px overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-800 md:grid-cols-2 lg:grid-cols-3">
          {steps.map(([number, name, detail], i) => (
            <Reveal key={number} delay={i * 60} variant="up">
              <div className="h-full bg-neutral-950 p-6 transition hover:bg-neutral-900/80 sm:p-8">
                <p className="font-mono text-xs text-amber-500">{number}</p>
                <h2 className="mt-5 text-xl font-semibold text-white">{name}</h2>
                <p className="mt-3 text-sm leading-6 text-neutral-400">{detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <Reveal>
          <p className="public-kicker">A typical engagement</p>
          <h2 className="public-heading mt-4 max-w-2xl">First findings in weeks, not quarters.</h2>
        </Reveal>
        <div className="mt-8 grid gap-3 md:grid-cols-4">
          {engagement.map(([when, name, body], i) => (
            <Reveal key={name} variant="up" delay={i * 60}>
              <div className="public-card h-full p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400">{when}</p>
                <p className="mt-3 text-base font-semibold text-white">{name}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="relative border-y border-neutral-900 bg-neutral-950/60">
        <AmbientField intensity="subtle" grain={false} />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 md:grid-cols-3">
          <Reveal><div><p className="public-kicker">Every number has a source</p><p className="mt-3 text-lg font-semibold text-white">Evidence. Estimate. Result.</p></div></Reveal>
          <Reveal delay={80}><p className="text-sm leading-6 text-neutral-400">What the data shows, what Kaivaryn estimates, and what your team has recorded are always kept apart. That separation is how trust is earned.</p></Reveal>
          <Reveal delay={140}><p className="text-sm leading-6 text-neutral-400">Missing data? You see what is missing. System not connected? It is labeled. No approval? The action waits.</p></Reveal>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <p className="public-kicker">Want the technical detail?</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Architecture, analysis method, governance controls, and integrations are documented on the platform page.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href="/demo" className="public-button-primary">Book a working session <span aria-hidden>↗</span></Link>
              <Link href="/platform" className="public-button-secondary">Platform and governance</Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
