import Link from "next/link";
import type { Metadata } from "next";
import { AmbientField, BreathGrid, Reveal, Magnetic, SectionRule, StatusDot } from "@/components/motion";
import { CommandRoutingDemo } from "@/components/public/command-routing-demo";
import { NineReturnRing } from "@/components/public/nine-return-ring";
import { GOVERNANCE_RAILS, NINE_RETURNS, PLATFORM_LAYERS } from "@/lib/public-story";

export const metadata: Metadata = {
  title: "Platform",
  description:
    "The Kaivaryn platform: evidence-backed detection, a nine-step analysis method, owned and approval-gated work, and estimates kept separate from recorded outcomes.",
};

const BUSINESS_OUTCOMES = [
  ["Find and rank", "Revenue leakage and operating friction, quantified in dollars and ranked by impact."],
  ["Own and approve", "Every finding has an owner, a next step, and an approval path before anything moves."],
  ["Measure and verify", "Recovered revenue and realized savings are recorded and verified — never inferred from estimates."],
] as const;

const PLAIN_ENGLISH = [
  ["What is it?", "Software that reads the records you already have (billing, receivables, CRM, call logs, time data), finds where money or time is being lost, puts a dollar estimate on each issue, and tracks it until it's fixed and the result is recorded."],
  ["What does it never do on its own?", "It never commits you to anything with a customer, moves money, or changes your systems on its own. Those actions wait for a named person on your team to approve them, and every decision is logged."],
  ["Where does my data live?", "In your own private, isolated workspace. Access is role-based, so you decide who sees what, and your records are never visible to another client."],
  ["Is it just a chatbot?", "No. Issues are found by fixed rules applied to your records, so the same records always give the same answer, and it says 'not enough data' instead of guessing. AI language models are used where they help, such as the voice assistant."],
] as const;

const OPERATING_PARTS = [
  ["Command", "One input for every ask. Readable rules route it to analysis, an answer, a governed plan, a briefing, a schedule, or a playbook — and record why."],
  ["Playbooks", "Named, reusable step sequences: detect, analyze, brief, recall, create a task, request approval. Six system playbooks ship with every workspace."],
  ["Standing orders", "Hourly, daily, or weekly instructions that run a playbook or a command. Every execution is recorded, including failures."],
  ["Run history", "Each execution keeps its steps, status, timing, and evidence links — so you can see what ran, what it produced, and what it is waiting on."],
  ["Approval gates", "Plans pause at a gate. A manager approves or rejects in the Inbox or Action Center; the run resumes or cancels. External actions stay with your team."],
  ["Initiatives", "Group opportunities, inefficiencies, playbooks, and runs under one owned objective — with estimated and recorded value reported separately."],
] as const;

const INTEGRATIONS = [
  ["CSV, Excel, and Google Sheets import", "Available", "ok"],
  ["Manual entry", "Available", "ok"],
  ["CRM, billing, ERP, ticketing", "Scoped per engagement · labeled not connected until connected", "warn"],
  ["Outbound actions in your systems", "Not automated · performed by your team after approval", "muted"],
] as const;

export default function PlatformPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <AmbientField intensity="hero" />
        <BreathGrid opacity={0.3} />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <p className="public-kicker text-amber-400">The platform</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl">
              The software behind
              <br />
              <span className="text-neutral-500">the engagement.</span>
            </h1>
            <div className="mt-5 h-px w-20 bg-gradient-to-r from-amber-400 to-transparent" />
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg">
              Kaivaryn&apos;s proprietary platform finds and ranks revenue leakage and operating friction, turns each finding into owned, approved work, and records what was actually recovered or saved. This page covers how it is built and governed.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic><Link href="/demo" className="public-button-primary">Book a demo <span aria-hidden>↗</span></Link></Magnetic>
              <Link href="/how-it-works" className="public-button-secondary">How an engagement runs</Link>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            {BUSINESS_OUTCOMES.map(([t, b], i) => (
              <Reveal key={t} variant="up" delay={i * 70}>
                <div className="public-card h-full p-5">
                  <p className="text-sm font-semibold text-white">{t}</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">{b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-20" aria-labelledby="plain-title">
        <Reveal>
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-6 sm:p-8">
            <p className="public-kicker text-amber-400">In plain English</p>
            <h2 id="plain-title" className="mt-3 text-2xl font-semibold text-white">The short version for owners.</h2>
            <dl className="mt-6 grid gap-5 text-sm leading-6 sm:grid-cols-2">
              {PLAIN_ENGLISH.map(([q, a]) => (
                <div key={q}>
                  <dt className="font-semibold text-white">{q}</dt>
                  <dd className="mt-1 text-neutral-400">{a}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-xs text-neutral-500">The rest of this page is the technical detail, written for your IT or finance team.</p>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <Reveal>
          <p className="public-kicker">For your technical team · Architecture</p>
          <h2 className="public-heading mt-4 max-w-2xl">Five layers, from raw evidence to an executive decision.</h2>
        </Reveal>
        <SectionRule className="mt-8 mb-10" />
        <ol className="relative space-y-4">
          <div aria-hidden className="absolute bottom-6 left-[27px] top-6 hidden w-px bg-gradient-to-b from-amber-400/60 via-amber-500/20 to-transparent sm:block" />
          {PLATFORM_LAYERS.map((layer, i) => (
            <Reveal key={layer.n} variant="up" delay={i * 70}>
              <li className="public-card relative grid gap-5 p-6 sm:grid-cols-[56px_1fr_1.1fr] sm:items-start sm:p-7">
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-xl border border-amber-500/40 bg-neutral-950 font-mono text-sm text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.12)]">{layer.n}</span>
                <div>
                  <h3 className="text-xl font-semibold text-white">{layer.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">{layer.body}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {layer.items.map((it) => (
                    <span key={it} className="rounded-full border border-white/[0.09] bg-white/[0.03] px-3 py-1 text-xs text-neutral-300">{it}</span>
                  ))}
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="relative border-y border-neutral-900 bg-neutral-950/60">
        <AmbientField intensity="subtle" grain={false} className="opacity-70" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal variant="scale"><NineReturnRing /></Reveal>
          <div>
            <Reveal>
              <p className="public-kicker text-amber-400">Nine-step analysis</p>
              <h2 className="public-heading mt-4">Every analysis checks itself nine ways before it reaches you.</h2>
              <p className="mt-4 text-sm leading-6 text-neutral-400">Each analysis runs a fixed sequence per product, then stops — no open-ended loops. The final step records the conclusion that the next analysis starts from, so the system remembers what it concluded and is held to it.</p>
            </Reveal>
            <div className="mt-8 grid gap-2 sm:grid-cols-3">
              {NINE_RETURNS.map((s, i) => (
                <Reveal key={s.code} variant="fade" delay={i * 40}>
                  <div className="h-full rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <p className="font-mono text-[10px] text-amber-500">{s.code} · {s.stage}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{s.name}</p>
                    <p className="mt-1 text-[11px] leading-4 text-neutral-500">{s.line}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <p className="public-kicker">The operating layer</p>
            <h2 className="public-heading mt-4 max-w-2xl">Work that keeps moving between meetings.</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-400">Executives can ask in plain language — “brief me”, “analyze billing leakage”, “plan a fix”. Command uses readable keyword rules, so the same request always lands in the same place, and the reason is recorded. The panel runs those exact rules.</p>
          </Reveal>
          <Reveal variant="scale" delay={100}><CommandRoutingDemo /></Reveal>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-800 md:grid-cols-2 lg:grid-cols-3">
          {OPERATING_PARTS.map(([name, body], i) => (
            <Reveal key={name} variant="up" delay={i * 50}>
              <div className="h-full bg-neutral-950 p-6 transition hover:bg-neutral-900/80 sm:p-7">
                <p className="font-mono text-xs text-amber-500">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-4 text-lg font-semibold text-white">{name}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-500">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative border-y border-neutral-900 bg-neutral-950/60">
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <p className="public-kicker">Governance rails</p>
            <h2 className="public-heading mt-4">Built for the board, not just the demo.</h2>
            <p className="mt-4 text-sm leading-6 text-neutral-400">These are enforced in code and exercised by automated tests on every build — not a policy page.</p>
          </Reveal>
          <div className="grid gap-3 sm:grid-cols-2">
            {GOVERNANCE_RAILS.map(([t, b], i) => (
              <Reveal key={t} delay={i * 50}>
                <div className="h-full rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <p className="text-sm font-semibold text-white"><span className="mr-2 text-emerald-400">✓</span>{t}</p>
                  <p className="mt-1.5 text-xs leading-5 text-neutral-500">{b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <p className="public-kicker">Integrations, honestly</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">What connects today — and what does not.</h2>
        </Reveal>
        <div className="mt-8 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08]">
          {INTEGRATIONS.map(([name, state, tone]) => (
            <div key={name} className="flex flex-col justify-between gap-2 bg-neutral-950/60 px-5 py-4 sm:flex-row sm:items-center">
              <span className="text-sm text-white">{name}</span>
              <StatusDot tone={tone} label={state} className="text-xs text-neutral-400" />
            </div>
          ))}
        </div>
        <Reveal>
          <div className="public-card relative mt-14 flex flex-col items-start justify-between gap-8 overflow-hidden bg-amber-500/[0.06] p-7 sm:flex-row sm:items-center sm:p-10">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" />
            <div>
              <p className="public-kicker text-amber-400">See it run</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">Bring one hard question. Watch it become owned, governed work.</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Magnetic><Link href="/demo" className="public-button-primary relative shrink-0">Book a demo <span aria-hidden>↗</span></Link></Magnetic>
              <Link href="/pricing" className="public-button-secondary shrink-0">Pricing</Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
