import Link from "next/link";
import type { Metadata } from "next";
import { ZOOM_SCHEDULER_URL } from "@/lib/constants";

export const metadata: Metadata = { title: "Operations Efficiency" };

const problem = [
  ["Learned friction", "Rework, queue delay, and manual repetition become “how we work” instead of a governed improvement backlog."],
  ["Automation theater", "Tools promise bots while projected savings are treated as realized — without approvals or a ledger."],
  ["No bottleneck truth", "Leaders lack department heat, readiness scores, and a clear gap between projected and realized hours/$."],
];

const method = [
  ["Find", "Surface inefficiencies from process and operational signals with explicit confidence."],
  ["Quantify", "Model annual waste, projected savings, and weekly hours — separately from realized."],
  ["Score readiness", "Automation candidates get a readiness score and an approval gate — never silent external execution."],
  ["Realize", "Record realized savings and hours only after outcomes are confirmed."],
];

const workflow = [
  ["Identified", "Friction enters the initiative backlog."],
  ["Analyzing", "Evidence, owner, and projection refined."],
  ["Implementing", "Approved intervention underway."],
  ["Realized / Verified", "Savings and hours landed — ledger updated."],
];

const outcomes = [
  ["Realization ledger", "Projected vs realized $ and hours with an open gap."],
  ["Automation readiness", "0–100 score from candidate flag, confidence, evidence, impact."],
  ["Bottleneck heat", "Department-level concentration of waste — for prioritization, not vanity."],
  ["Governed change", "Every material automation decision leaves an audit trail."],
];

export default function OperationsEfficiencyPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="public-kicker text-emerald-400">Solution / Operations Efficiency</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-6xl">
            Remove the friction your team has learned to work around.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">
            Kaivaryn turns repeatable waste into a visible improvement queue — without confusing automation potential for
            automation success. Built for operators who need measured realization, not slideware ROI.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className="public-button-primary">Book a working session <span aria-hidden>↗</span></Link>
            <a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="public-button-secondary">Schedule on Zoom</a>
            <Link href="/value" className="public-button-secondary">Estimate opportunity</Link>
            <Link href="/pricing" className="public-button-secondary">View pricing</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="public-kicker text-emerald-400">Problem</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Why efficiency programs stall.</h2>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {problem.map(([t, b], i) => (
            <div key={t} className="public-card p-7">
              <p className="font-mono text-xs text-emerald-400">0{i + 1}</p>
              <h3 className="mt-4 text-lg font-semibold text-white">{t}</h3>
              <p className="mt-3 text-sm leading-6 text-neutral-500">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-neutral-900 bg-neutral-950/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="public-kicker text-emerald-400">Method</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Find → quantify → ready → realize.</h2>
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
        <p className="public-kicker text-emerald-400">Workflow</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">An initiative loop that separates projection from proof.</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {workflow.map(([t, b], i) => (
            <div key={t} className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
              <p className="font-mono text-xs text-emerald-400">Stage {i + 1}</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{t}</h3>
              <p className="mt-2 text-sm text-neutral-500">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-neutral-900">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="public-kicker text-emerald-400">Outcomes framework</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold text-white">What you measure — without fake peer ROI.</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {outcomes.map(([t, b]) => (
              <div key={t} className="public-card p-6">
                <h3 className="text-lg font-semibold text-white">{t}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-500">{b}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className="public-button-primary">Book executive demo <span aria-hidden>↗</span></Link>
            <Link href="/value" className="public-button-secondary">Run the value estimator</Link>
            <Link href="/how-it-works" className="public-button-secondary">See the operating loop</Link>
          </div>
        </div>
      </section>
    </>
  );
}
