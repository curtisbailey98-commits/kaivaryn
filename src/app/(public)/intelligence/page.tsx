import Link from "next/link";
import type { Metadata } from "next";
import { NineReturnRing } from "@/components/public/nine-return-ring";
import { NINE_RETURNS } from "@/lib/public-story";

export const metadata: Metadata = { title: "Intelligence" };

export default function IntelligencePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900"><div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24"><p className="public-kicker text-amber-400">A better standard for AI-assisted work</p><h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-6xl">Useful intelligence should make the next step clearer.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">Kaivaryn uses structured analysis to help teams see consequential work sooner—without turning model output into a business result it cannot prove.</p></div></section>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24"><div className="grid gap-5 lg:grid-cols-2"><div className="public-card p-7 sm:p-9"><p className="font-mono text-xs text-emerald-400">FINDING</p><h2 className="mt-4 text-2xl font-semibold text-white">Enough evidence to act.</h2><p className="mt-3 text-sm leading-6 text-neutral-400">A finding includes a summary, confidence, evidence list, impact estimate, and recommendation. It gives an operator something specific to review—not a vague score.</p><div className="mt-7 space-y-2 text-xs text-neutral-500"><p className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">Evidence · 4 source records</p><p className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">Confidence · High</p><p className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">Next step · Assign owner</p></div></div><div className="public-card p-7 sm:p-9"><p className="font-mono text-xs text-amber-400">INSUFFICIENT_DATA</p><h2 className="mt-4 text-2xl font-semibold text-white">Not enough evidence to pretend.</h2><p className="mt-3 text-sm leading-6 text-neutral-400">When signals are missing, Kaivaryn returns the missing inputs and stops. Honest uncertainty is more useful than fabricated precision.</p><div className="mt-7 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-4 text-xs leading-5 text-neutral-400">Required inputs: source history, owner, timeframe, and a measurable impact field.</div></div></div></section>
      <section className="border-t border-neutral-900 bg-neutral-950/60">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <NineReturnRing />
          <div>
            <p className="public-kicker text-amber-400">The nine-return cycle</p>
            <h2 className="public-heading mt-4">Analysis that argues with itself before it advises you.</h2>
            <p className="mt-4 text-sm leading-6 text-neutral-400">Every cycle is bounded: nine stages, then ZERO_RETURN. Each stage is deterministic code over your recorded data — no generative model sits in the analysis path — and the Witness alone signs the state the next cycle inherits.</p>
            <ol className="mt-8 space-y-2">
              {NINE_RETURNS.map((s) => (
                <li key={s.code} className="flex gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm">
                  <span className="w-8 shrink-0 font-mono text-xs leading-5 text-amber-500">{s.code}</span>
                  <span className="text-neutral-300"><span className="font-semibold text-white">{s.name}.</span> <span className="text-neutral-500">{s.line}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      <section className="border-y border-neutral-900 bg-neutral-950/60"><div className="mx-auto flex max-w-6xl flex-col justify-between gap-7 px-4 py-14 sm:px-6 md:flex-row md:items-center"><div><p className="public-kicker">The result</p><p className="mt-2 text-xl font-semibold text-white">A recommendation that knows what it knows.</p></div><Link href="/platform" className="text-sm text-amber-400 hover:text-amber-300">See the full platform <span aria-hidden>→</span></Link></div></section>
    </>
  );
}
