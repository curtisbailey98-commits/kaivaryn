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
  CountUpCurrency,
  StatusDot,
} from "@/components/motion";
import { getPricingConfig, centsToDollars } from "@/lib/pricing";
import { TalkToVikiButton } from "@/components/voice/public-viki";

export const metadata: Metadata = {
  title: "Executive AI Consulting Firm",
  description:
    "Kaivaryn finds the revenue your business is already losing and the operating cost it doesn't need to carry — then ranks it by financial impact, assigns the work, and measures what was actually recovered.",
};

const pillars = [
  ["Find the money", "Underbilling, underpayment, missed revenue, and pricing or contract leakage — ranked by what it is worth."],
  ["Remove the friction", "Manual work, rework, bottlenecks, and delays that quietly add labor and operating cost."],
  ["Measure the result", "Estimated value and verified results are tracked separately, so every number holds up in the boardroom."],
] as const;

const revenueFinds = [
  "Underbilling and missed charges",
  "Underpayments against contract",
  "Pricing, discount, and renewal leakage",
  "Revenue lost to process gaps",
];

const operationsFinds = [
  "Manual, repetitive work",
  "Recurring bottlenecks and delays",
  "Rework and duplicate entry",
  "Automation opportunities worth funding",
];

const actionSteps = [
  ["01", "Find", "Kaivaryn analyzes the evidence your systems already hold and surfaces where money or time is being lost."],
  ["02", "Rank", "Every issue is quantified and ranked by financial impact, so your team sees what deserves attention first."],
  ["03", "Act", "Each finding gets an owner, a next step, and an approval path. Nothing consequential moves without a decision."],
  ["04", "Verify", "Recovered revenue and realized savings are recorded against the finding that produced them — and verified."],
] as const;

export const dynamic = "force-dynamic";

async function pricingTeaser() {
  try {
    const c = await getPricingConfig();
    return { seats: c.introductorySeats, intro: centsToDollars(c.introductoryPriceCents), standard: centsToDollars(c.standardPriceCents) };
  } catch {
    // Pricing still renders if the database is briefly unavailable; values mirror the seeded PricingConfig.
    return { seats: 10, intro: 10_000, standard: 20_000 };
  }
}

/** Static, illustrative preview of the executive view. Not client data. */
function ExecutivePreview() {
  const rows = [
    { title: "Payer underpayments vs. contract", area: "Revenue", value: "$210,000", owner: "Revenue cycle lead", next: "Appeal batch approved" },
    { title: "Duplicate entry across ERP and CRM", area: "Operations", value: "$120,000 / yr", owner: "Operations manager", next: "Automation in progress" },
    { title: "Change orders delivered, not billed", area: "Revenue", value: "$95,500", owner: "Delivery finance", next: "Awaiting approval" },
  ];
  return (
    <div className="public-card relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
      <div className="relative flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">What the executive sees</p>
        <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-600">Illustrative</span>
      </div>
      <div className="relative mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06]">
        <div className="bg-neutral-950 p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Estimated revenue opportunity</p>
          <p className="mt-1.5 text-lg font-semibold text-white sm:text-xl">$305.5k</p>
        </div>
        <div className="bg-neutral-950 p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">Verified recovery</p>
          <p className="mt-1.5 text-lg font-semibold text-emerald-400 sm:text-xl">$45k</p>
        </div>
        <div className="bg-neutral-950 p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">Realized savings</p>
          <p className="mt-1.5 text-lg font-semibold text-emerald-400 sm:text-xl">$15k</p>
        </div>
      </div>
      <p className="relative mt-5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Highest-value issues</p>
      <ul className="relative mt-2 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-neutral-950/70">
        {rows.map((r) => (
          <li key={r.title} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-3 py-3 sm:px-4">
            <p className="text-sm font-medium text-white sm:truncate">{r.title}</p>
            <p className="text-right text-sm font-semibold text-amber-300">{r.value}</p>
            <p className="truncate text-[11px] text-neutral-500">{r.area} · {r.owner}</p>
            <p className="text-right text-[11px] text-neutral-400">{r.next}</p>
          </li>
        ))}
      </ul>
      <p className="relative mt-3 text-[11px] text-neutral-600">Estimates and verified results are shown side by side — never added together.</p>
    </div>
  );
}

export default async function HomePage() {
  const price = await pricingTeaser();
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <AmbientField intensity="hero" />
        <BreathGrid opacity={0.32} />
        <SpotlightHero className="relative">
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
            <div>
              <Reveal variant="up">
                <p className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-[11px] sm:tracking-[0.22em] text-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.08)]">
                  Executive AI consulting · Proprietary software
                </p>
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
                  Kaivaryn finds the revenue your business is already losing and the operating cost it doesn&apos;t need to carry. We rank every issue by financial impact, put an owner on it, and measure what was actually recovered.
                </p>
              </Reveal>
              <Reveal variant="up" delay={240}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Magnetic strength={0.22}>
                    <Link href="/demo" className="public-button-primary">Book a working session <span aria-hidden>↗</span></Link>
                  </Magnetic>
                  <Link href="/how-it-works" className="public-button-secondary">See how it works</Link>
                </div>
              </Reveal>
              <Reveal variant="fade" delay={320}>
                <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-500">
                  <StatusDot tone="ok" label="Private, isolated workspace" className="text-neutral-400" />
                  <StatusDot tone="ok" label="Approval-gated decisions" className="text-neutral-400" />
                  <StatusDot tone="ok" label="Estimated vs. verified, kept separate" className="text-neutral-400" />
                </div>
              </Reveal>
            </div>
            <Reveal variant="scale" delay={160}>
              <ExecutivePreview />
            </Reveal>
          </div>
        </SpotlightHero>
      </section>

      <section className="relative border-b border-neutral-900 bg-neutral-950/70">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {pillars.map(([t, b], i) => (
            <Reveal key={t} variant="up" delay={i * 80}>
              <div>
                <p className="text-sm font-semibold text-white">{t}.</p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">{b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <div className="max-w-2xl">
            <p className="public-kicker">What Kaivaryn does</p>
            <h2 className="public-heading mt-4">Two disciplines. One measure of success: money you can verify.</h2>
            <p className="mt-4 text-sm leading-6 text-neutral-400">
              We pair experienced operators with proprietary software. The software finds and quantifies the issues; your team decides and acts; the results are recorded and verified.
            </p>
          </div>
        </Reveal>
        <SectionRule className="mt-8 mb-2" />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <Reveal variant="up" delay={40}>
            <Link href="/solutions/revenue-recovery" className="public-card group relative block h-full overflow-hidden p-7 sm:p-8">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl transition group-hover:bg-amber-400/20" />
              <p className="public-kicker text-amber-400">Revenue Recovery</p>
              <h3 className="mt-5 text-2xl font-semibold text-white">Recover money you have already earned.</h3>
              <p className="mt-3 max-w-lg text-sm leading-6 text-neutral-400">
                Revenue that should be yours but never arrives. Kaivaryn finds it, sizes it, and tracks it until the cash is recovered and verified.
              </p>
              <ul className="mt-5 grid gap-2 text-sm text-neutral-300 sm:grid-cols-2">
                {revenueFinds.map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-amber-400">—</span>{f}</li>
                ))}
              </ul>
              <span className="mt-7 inline-block text-sm font-medium text-amber-400">Revenue Recovery <span aria-hidden>→</span></span>
            </Link>
          </Reveal>
          <Reveal variant="up" delay={120}>
            <Link href="/solutions/operations-efficiency" className="public-card group relative block h-full overflow-hidden p-7 sm:p-8">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl transition group-hover:bg-emerald-400/20" />
              <p className="public-kicker text-emerald-400">Operations Efficiency</p>
              <h3 className="mt-5 text-2xl font-semibold text-white">Stop paying for work that shouldn&apos;t exist.</h3>
              <p className="mt-3 max-w-lg text-sm leading-6 text-neutral-400">
                Labor and time lost to friction your team has learned to live with. Kaivaryn puts a cost on it and tracks savings until they are realized.
              </p>
              <ul className="mt-5 grid gap-2 text-sm text-neutral-300 sm:grid-cols-2">
                {operationsFinds.map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-emerald-400">—</span>{f}</li>
                ))}
              </ul>
              <span className="mt-7 inline-block text-sm font-medium text-emerald-400">Operations Efficiency <span aria-hidden>→</span></span>
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-neutral-900 bg-neutral-950/60">
        <AmbientField intensity="subtle" grain={false} className="opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <Reveal>
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="public-kicker text-amber-400">How findings become action</p>
                <h2 className="public-heading mt-4 max-w-2xl">From evidence to an owned decision.</h2>
              </div>
              <Link href="/how-it-works" className="text-sm text-amber-400 hover:text-amber-300">How an engagement runs <span aria-hidden>→</span></Link>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-800 sm:grid-cols-2 lg:grid-cols-4">
            {actionSteps.map(([n, title, body], i) => (
              <Reveal key={n} variant="fade" delay={i * 70}>
                <div className="h-full bg-neutral-950 p-6 transition hover:bg-neutral-900/80 sm:p-7">
                  <p className="font-mono text-xs text-amber-500">{n}</p>
                  <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <Reveal>
            <div>
              <p className="public-kicker">How results are measured</p>
              <h2 className="public-heading mt-4">An estimate is not a result.</h2>
              <p className="mt-4 text-sm leading-6 text-neutral-400">
                Kaivaryn keeps two ledgers. One holds what we estimate is recoverable or savable. The other holds only what your team has recorded as recovered or realized — and what has been verified.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                <li className="flex items-start gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" /><span className="text-neutral-300"><span className="font-semibold text-white">Estimated opportunity</span> and <span className="font-semibold text-white">projected savings</span> — what the evidence suggests.</span></li>
                <li className="flex items-start gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" /><span className="text-neutral-300"><span className="font-semibold text-white">Verified recovery</span> and <span className="font-semibold text-white">realized savings</span> — what actually landed.</span></li>
              </ul>
              <p className="mt-5 text-xs text-neutral-500">The two are never added together.</p>
            </div>
          </Reveal>
          <Reveal variant="scale" delay={80}>
            <ExampleFrameworkChart />
          </Reveal>
        </div>
      </section>

      <section className="border-y border-neutral-900 bg-neutral-950/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1fr_1fr] lg:items-center">
          <Reveal>
            <p className="public-kicker">Pricing</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">One engagement. Both disciplines. Full software access.</h2>
            <Link href="/pricing" className="mt-5 inline-block text-sm text-amber-400 hover:text-amber-300">Pricing details <span aria-hidden>→</span></Link>
          </Reveal>
          <Reveal variant="up" delay={80}>
            <div className="public-card border-amber-500/30 p-6">
              <p className="public-kicker text-amber-400">First {price.seats} clients</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-white"><CountUpCurrency value={price.intro} /><span className="text-sm font-normal text-neutral-500"> / month</span></p>
            </div>
          </Reveal>
          <Reveal variant="up" delay={140}>
            <div className="public-card p-6">
              <p className="public-kicker">Standard</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-white"><CountUpCurrency value={price.standard} /><span className="text-sm font-normal text-neutral-500"> / month</span></p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-20" aria-labelledby="talk-to-viki">
        <Reveal>
          <div className="relative grid gap-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] via-transparent to-amber-500/[0.05] p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <div className="relative h-16 w-16 shrink-0 rounded-full shadow-[0_0_0_1px_rgba(161,161,170,0.35),0_0_36px_rgba(245,158,11,0.18)]" style={{ background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.85), rgba(212,212,216,0.5) 22%, rgba(82,82,91,0.75) 55%, rgba(10,10,10,0.95) 78%)" }} aria-hidden />
            <div>
              <p className="public-kicker">Prefer to talk it through?</p>
              <h2 id="talk-to-viki" className="mt-3 text-xl font-semibold text-white sm:text-2xl">Talk to Viki, Kaivaryn&apos;s AI voice assistant.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
                Describe what&apos;s happening in your business. Viki asks a few questions, tells you whether Revenue Recovery or Operations Efficiency is the better fit, answers common questions, and points you to an executive demo when it makes sense. She&apos;s an AI — and she won&apos;t quote results she can&apos;t stand behind.
              </p>
            </div>
            <TalkToVikiButton />
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-20">
        <Reveal>
          <div className="grid gap-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="public-kicker">Built to be trusted</p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">
                Each client works in a private, isolated workspace. Access is role-based, every material decision is approved and logged, and when the data isn&apos;t sufficient, Kaivaryn says so instead of guessing.
              </p>
            </div>
            <Link href="/platform" className="text-sm text-amber-400 hover:text-amber-300">Platform and governance <span aria-hidden>→</span></Link>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <div className="public-card relative flex flex-col items-start justify-between gap-8 overflow-hidden bg-amber-500/[0.06] p-7 sm:flex-row sm:items-center sm:p-10">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" />
            <div>
              <p className="public-kicker text-amber-400">Start with one question</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">Where is your business losing money — and who owns the fix?</h2>
              <p className="mt-3 text-sm text-neutral-400">A live executive session on Zoom. Bring one hard question; leave with a clear next step.</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:items-end">
              <Magnetic>
                <Link href="/demo" className="public-button-primary relative">Book a working session <span aria-hidden>↗</span></Link>
              </Magnetic>
              <a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-400 hover:text-white">Or pick a time on Zoom ↗</a>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
