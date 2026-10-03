import Link from "next/link";
import type { Metadata } from "next";
import { ZOOM_SCHEDULER_URL } from "@/lib/constants";
import { ExampleHowItWorksChart } from "@/components/charts/example-public-charts";
import { AmbientField, BreathGrid, Reveal, Magnetic, SectionRule } from "@/components/motion";
import { OPERATING_LOOP } from "@/lib/public-story";
import { CommandRoutingDemo } from "@/components/public/command-routing-demo";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How a Kaivaryn engagement runs: connect, analyze, identify, prioritize, execute with approvals, and measure what was actually recovered or saved.",
};

const steps = OPERATING_LOOP.map((s) => [s.n, s.name, s.body] as const);

const engagement = [
  ["Week 1", "Evidence in", "CSV or manual import of the records behind one business question. Integration states stay visible and honest."],
  ["Week 1–2", "First cycle", "Detection and a nine-return cycle per product. Findings carry evidence, confidence, and an owner field."],
  ["Week 2+", "Operating rhythm", "Playbooks and standing orders keep the analysis current; briefings land in the Inbox; approvals gate every plan."],
  ["Ongoing", "Measured outcomes", "Recovered cash and realized savings are recorded against the findings that produced them."],
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <AmbientField intensity="hero" />
        <BreathGrid opacity={0.28} />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <p className="public-kicker text-amber-400">The operating model</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-6xl">Ask. Route. Analyze. Gate. Brief. Measure.</h1>
            <div className="mt-5 h-px w-20 bg-gradient-to-r from-amber-400 to-transparent" />
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">Kaivaryn is not a black box. Every question becomes a recorded run — analysis you can inspect, a plan someone owns, an approval someone gives, and a result someone can verify.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic><Link href="/demo" className="public-button-primary">See it with your data <span aria-hidden>↗</span></Link></Magnetic>
              <a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="public-button-secondary">Schedule on Zoom</a>
              <Link href="/platform" className="public-button-secondary">See the platform</Link>
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
                <p className="mt-3 text-sm leading-6 text-neutral-500">{detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <Reveal>
          <p className="public-kicker">Step 02, up close</p>
          <h2 className="public-heading mt-4">Routing you can read.</h2>
          <p className="mt-4 text-sm leading-6 text-neutral-400">Command uses plain keyword rules — no generative model — so the same sentence always lands in the same place, and the reason is stored with the command. This panel runs those exact rules.</p>
        </Reveal>
        <Reveal variant="scale" delay={100}><CommandRoutingDemo /></Reveal>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <Reveal><p className="public-kicker">A typical engagement</p></Reveal>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {engagement.map(([when, name, body], i) => (
            <Reveal key={name} variant="up" delay={i * 60}>
              <div className="public-card h-full p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400">{when}</p>
                <p className="mt-3 text-base font-semibold text-white">{name}</p>
                <p className="mt-2 text-xs leading-5 text-neutral-500">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <Reveal variant="scale"><ExampleHowItWorksChart /></Reveal>
      </section>
      <section className="relative border-y border-neutral-900 bg-neutral-950/60">
        <AmbientField intensity="subtle" grain={false} />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 md:grid-cols-3">
          <Reveal><div><p className="public-kicker">Every output has a type</p><p className="mt-3 text-lg font-semibold text-white">Observed. Calculated. Recommended.</p></div></Reveal>
          <Reveal delay={80}><p className="text-sm leading-6 text-neutral-400">Evidence is kept distinct from analysis, and analysis is kept distinct from a recommendation. That separation is how trust compounds.</p></Reveal>
          <Reveal delay={140}><p className="text-sm leading-6 text-neutral-400">No data? You see the missing input. No integration? You see the blocker. No approval? The action waits.</p></Reveal>
        </div>
      </section>
    </>
  );
}
