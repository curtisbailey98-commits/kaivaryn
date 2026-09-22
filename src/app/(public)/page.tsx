import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recover Revenue. Eliminate Operational Waste.",
};

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.08),_transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber-500/90">
            Kaivaryn LLC · Enterprise AI consulting
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Recover Revenue.
            <br />
            <span className="text-neutral-400">Eliminate Operational Waste.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg">
            An executive intelligence terminal for organizations that measure leakage and friction
            with discipline — not dashboards that invent progress.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-amber-400"
            >
              Book a Demo
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-md border border-neutral-700 px-5 py-2.5 text-sm font-medium text-neutral-100 hover:bg-neutral-900"
            >
              Explore Kaivaryn
            </Link>
          </div>
          <div className="mt-16 grid gap-4 sm:grid-cols-2">
            <Link
              href="/solutions/revenue-recovery"
              className="group rounded-lg border border-neutral-800 bg-neutral-950/60 p-6 hover:border-amber-500/40"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">Product</p>
              <h2 className="mt-2 text-xl font-semibold text-white group-hover:text-amber-100">
                Revenue Recovery
              </h2>
              <p className="mt-2 text-sm text-neutral-400">
                Identify, prioritize, and recover underbilling, leakage, and underpayment — with
                estimated and recovered amounts always separated.
              </p>
            </Link>
            <Link
              href="/solutions/operations-efficiency"
              className="group rounded-lg border border-neutral-800 bg-neutral-950/60 p-6 hover:border-amber-500/40"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">Product</p>
              <h2 className="mt-2 text-xl font-semibold text-white group-hover:text-amber-100">
                Operations Efficiency
              </h2>
              <p className="mt-2 text-sm text-neutral-400">
                Surface process waste and automation candidates. External actions stay approval-gated —
                never auto-executed.
              </p>
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">Method</h2>
        <p className="mt-3 max-w-2xl text-2xl font-semibold text-white">
          Connect → Analyze → Identify → Prioritize → Execute → Measure
        </p>
        <p className="mt-4 max-w-2xl text-sm text-neutral-400">
          Every stage is auditable. Intelligence returns structured findings or an honest{" "}
          <span className="font-mono text-amber-400/90">INSUFFICIENT_DATA</span> result — never fabricated evidence.
        </p>
        <Link href="/how-it-works" className="mt-6 inline-block text-sm text-amber-400 hover:text-amber-300">
          See how it works →
        </Link>
      </section>
      <section className="border-y border-neutral-900 bg-neutral-950/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-500/90">Executive operating model</p>
            <h2 className="mt-4 max-w-lg text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Intelligence that ends in an accountable next step.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-neutral-400">
              Kaivaryn keeps observed evidence, calculated impact, estimates, and recommendations distinct—so leadership can move quickly without confusing a model output for a business result.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800 sm:grid-cols-2">
            {[
              ["01", "See the signal", "Surface leakage, bottlenecks, and unresolved work from the data your teams already create."],
              ["02", "Rank by consequence", "Focus attention on economic impact, urgency, confidence, and ease of recovery—not volume."],
              ["03", "Govern the action", "Assign ownership, preserve approvals, and keep every material decision traceable."],
              ["04", "Measure the result", "Separate potential value from verified recovery or realized savings after execution."],
            ].map(([number, title, body]) => (
              <div key={number} className="bg-neutral-950 p-5 sm:p-6">
                <p className="font-mono text-xs text-amber-500">{number}</p>
                <h3 className="mt-3 text-base font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
