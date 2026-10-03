import Link from "next/link";
import { ExampleFrameworkChart } from "@/components/charts/example-framework-chart";
import { AmbientField, BreathGrid, Reveal, Magnetic, SectionRule } from "@/components/motion";

type Pair = readonly [string, string];

export type SolutionContent = {
  tone: "amber" | "emerald";
  kicker: string;
  title: string;
  lede: string;
  problem: { heading: string; intro: string; items: readonly Pair[] };
  finds: { heading: string; items: readonly Pair[] };
  financial: { heading: string; body: string; points: readonly string[] };
  executiveView: { heading: string; body: string; metrics: readonly { label: string; note: string; realized?: boolean }[]; columns: readonly string[] };
  nextAction: { heading: string; steps: readonly Pair[] };
  verification: { heading: string; body: string; stages: readonly Pair[]; rule: string };
  closing: string;
};

const TONES = {
  amber: {
    kicker: "text-amber-400",
    rule: "from-amber-400",
    num: "text-amber-500",
    stage: "border-amber-500/20 bg-amber-500/[0.04]",
    dot: "bg-amber-400",
  },
  emerald: {
    kicker: "text-emerald-400",
    rule: "from-emerald-400",
    num: "text-emerald-400",
    stage: "border-emerald-500/20 bg-emerald-500/[0.04]",
    dot: "bg-emerald-400",
  },
} as const;

export function SolutionPage({ c }: { c: SolutionContent }) {
  const t = TONES[c.tone];
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <AmbientField intensity="hero" />
        <BreathGrid opacity={0.28} />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <p className={`public-kicker ${t.kicker}`}>{c.kicker}</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-6xl">{c.title}</h1>
            <div className={`mt-5 h-px w-20 bg-gradient-to-r ${t.rule} to-transparent`} />
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg">{c.lede}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic><Link href="/demo" className="public-button-primary">Book a working session <span aria-hidden>↗</span></Link></Magnetic>
              <Link href="/pricing" className="public-button-secondary">View pricing</Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 1 — Problem */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <p className={`public-kicker ${t.kicker}`}>The problem</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold text-white">{c.problem.heading}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-400">{c.problem.intro}</p>
        </Reveal>
        <SectionRule className="mt-8 mb-2" />
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {c.problem.items.map(([title, body], i) => (
            <Reveal key={title} delay={i * 70}>
              <div className="public-card h-full p-7">
                <p className={`font-mono text-xs ${t.num}`}>0{i + 1}</p>
                <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-neutral-400">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 2 — What Kaivaryn finds  +  3 — Why it matters financially */}
      <section className="border-y border-neutral-900 bg-neutral-950/50">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <Reveal>
              <p className={`public-kicker ${t.kicker}`}>What Kaivaryn finds</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">{c.finds.heading}</h2>
            </Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {c.finds.items.map(([title, body], i) => (
                <Reveal key={title} delay={i * 50}>
                  <div className="h-full rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                    <h3 className="text-base font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-400">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <Reveal delay={80}>
            <div className="public-card h-full p-7">
              <p className={`public-kicker ${t.kicker}`}>Why it matters financially</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{c.financial.heading}</h2>
              <p className="mt-4 text-sm leading-6 text-neutral-400">{c.financial.body}</p>
              <ul className="mt-6 space-y-3 text-sm text-neutral-300">
                {c.financial.points.map((p) => (
                  <li key={p} className="flex items-start gap-3"><span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />{p}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 4 — What the executive sees */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <p className={`public-kicker ${t.kicker}`}>What the executive sees</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold text-white">{c.executiveView.heading}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-400">{c.executiveView.body}</p>
        </Reveal>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {c.executiveView.metrics.map((m, i) => (
            <Reveal key={m.label} delay={i * 50}>
              <div className={`h-full rounded-xl border p-5 ${m.realized ? "border-emerald-500/25 bg-emerald-500/[0.04]" : "border-white/[0.08] bg-neutral-950"}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${m.realized ? "text-emerald-300" : "text-neutral-400"}`}>{m.label}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">{m.note}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs text-neutral-400">
            <span className="mr-1 font-semibold uppercase tracking-wider text-neutral-500">For every item:</span>
            {c.executiveView.columns.map((col) => (
              <span key={col} className="rounded-full border border-white/[0.09] bg-white/[0.03] px-3 py-1 text-neutral-300">{col}</span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* 5 — What happens next */}
      <section className="border-y border-neutral-900 bg-neutral-950/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal>
            <p className={`public-kicker ${t.kicker}`}>What happens next</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold text-white">{c.nextAction.heading}</h2>
          </Reveal>
          <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-800 sm:grid-cols-2 lg:grid-cols-4">
            {c.nextAction.steps.map(([title, body], i) => (
              <Reveal key={title} variant="fade" delay={i * 60}>
                <div className="h-full bg-neutral-950 p-6">
                  <p className={`font-mono text-xs ${t.num}`}>0{i + 1}</p>
                  <h3 className="mt-3 text-base font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 6 — How the result is verified */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <Reveal>
            <p className={`public-kicker ${t.kicker}`}>How the result is verified</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">{c.verification.heading}</h2>
            <p className="mt-4 text-sm leading-6 text-neutral-400">{c.verification.body}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {c.verification.stages.map(([title, body], i) => (
                <div key={title} className={`rounded-xl border p-4 ${t.stage}`}>
                  <p className={`font-mono text-[11px] ${t.num}`}>Stage {i + 1}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-400">{body}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs text-neutral-500">{c.verification.rule}</p>
          </Reveal>
          <Reveal variant="scale" delay={80}>
            <ExampleFrameworkChart />
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        <Reveal>
          <div className="public-card relative flex flex-col items-start justify-between gap-6 overflow-hidden bg-amber-500/[0.06] p-7 sm:flex-row sm:items-center sm:p-10">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" />
            <h2 className="max-w-2xl text-2xl font-semibold text-white sm:text-3xl">{c.closing}</h2>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Magnetic><Link href="/demo" className="public-button-primary relative">Book a working session <span aria-hidden>↗</span></Link></Magnetic>
              <Link href="/how-it-works" className="public-button-secondary">How it works</Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
