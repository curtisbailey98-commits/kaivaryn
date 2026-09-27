import Link from "next/link";
import type { Metadata } from "next";
import { ZOOM_SCHEDULER_URL } from "@/lib/constants";
import { ExampleHowItWorksChart } from "@/components/charts/example-public-charts";
import { AmbientField, BreathGrid, Reveal, Magnetic, SectionRule } from "@/components/motion";

export const metadata: Metadata = { title: "How it works" };

const steps = [
  ["01", "Connect", "Link available data sources or begin with manual and CSV entry. Integration states stay visible and honest."],
  ["02", "Analyze", "Run structured analysis against recorded signals. Missing evidence returns INSUFFICIENT_DATA—not a guess."],
  ["03", "Identify", "Surface opportunities and inefficiencies with source, department, type, and evidence metadata."],
  ["04", "Prioritize", "Rank the queue by impact, urgency, confidence, and ease of recovery—not by volume alone."],
  ["05", "Execute", "Assign owners, capture notes, request approvals, and advance status without fake external success."],
  ["06", "Measure", "Separate estimates from verified recovery and projected savings from realized efficiency."],
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
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-6xl">A six-stage loop for work that deserves an answer.</h1>
            <div className="mt-5 h-px w-20 bg-gradient-to-r from-amber-400 to-transparent" />
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">Kaivaryn is not a black box. It is a visible operating system for turning business signals into decisions that can be assigned, approved, and measured.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic><Link href="/demo" className="public-button-primary">See it with your data <span aria-hidden>↗</span></Link></Magnetic>
              <a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="public-button-secondary">Schedule on Zoom</a>
              <Link href="/intelligence" className="public-button-secondary">Our intelligence standard</Link>
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
