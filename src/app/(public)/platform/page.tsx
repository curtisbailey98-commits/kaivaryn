import Link from "next/link";
import type { Metadata } from "next";
import { ZOOM_SCHEDULER_URL } from "@/lib/constants";
import { AmbientField, BreathGrid, Reveal, Magnetic, SectionRule, StatusDot } from "@/components/motion";
import { CommandRoutingDemo } from "@/components/public/command-routing-demo";
import { NineReturnRing } from "@/components/public/nine-return-ring";
import { GOVERNANCE_RAILS, NINE_RETURNS, PLATFORM_LAYERS } from "@/lib/public-story";

export const metadata: Metadata = {
  title: "Platform",
  description:
    "The Kaivaryn operating intelligence platform: evidence, detection engines, a nine-return intelligence cycle, an operating layer of commands, playbooks, standing orders and approval-gated runs, and executive surfaces.",
};

const OPERATING_PARTS = [
  ["Command", "One input for every ask. Deterministic rules route it to analysis, an answer, a governed plan, a briefing, a schedule, or a playbook — and record why."],
  ["Playbooks", "Named, reusable step sequences: detect, analyze, brief, recall, create a task, request approval. Six system playbooks ship with every workspace."],
  ["Standing orders", "Hourly, daily, or weekly instructions that run a playbook or a command. Every execution is recorded, including failures."],
  ["Run history", "Each execution keeps its steps, status, timing, and evidence links — so you can see what ran, what it produced, and what it is waiting on."],
  ["Approval gates", "Plans pause at a gate. A manager approves or rejects in the Inbox or Action Center; the run resumes or cancels. External actions stay with your team."],
  ["Initiatives", "Group opportunities, inefficiencies, playbooks, and runs under one owned objective — with estimated and recorded value reported separately."],
] as const;

const INTEGRATIONS = [
  ["CSV import", "Available", "ok"],
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
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <Reveal>
            <p className="public-kicker text-amber-400">The platform</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl">
              An operating intelligence,
              <br />
              <span className="text-neutral-500">not another dashboard.</span>
            </h1>
            <div className="mt-5 h-px w-20 bg-gradient-to-r from-amber-400 to-transparent" />
            <p className="mt-6 max-w-xl text-base leading-7 text-neutral-400 sm:text-lg">
              Kaivaryn reads your revenue and operations evidence, runs a bounded nine-return analysis, and turns the result into owned, approval-gated work — then briefs you on what changed. Every layer is deterministic, tenant-isolated, and auditable.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic><Link href="/demo" className="public-button-primary">See it on your data <span aria-hidden>↗</span></Link></Magnetic>
              <a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="public-button-secondary">Schedule on Zoom</a>
            </div>
          </Reveal>
          <Reveal variant="scale" delay={120}>
            <CommandRoutingDemo />
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <Reveal>
          <p className="public-kicker">Architecture</p>
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
              <p className="public-kicker text-amber-400">Nine-return intelligence</p>
              <h2 className="public-heading mt-4">Every analysis checks itself nine ways before it reaches you.</h2>
              <p className="mt-4 text-sm leading-6 text-neutral-400">Each cycle runs per product and stops at ZERO_RETURN. Only the Witness stage may sign the continuity state the next cycle starts from — so the system remembers what it concluded, and is held to it.</p>
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
        <Reveal>
          <p className="public-kicker">The operating layer</p>
          <h2 className="public-heading mt-4 max-w-2xl">Intelligence that keeps working between meetings.</h2>
        </Reveal>
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
              <Magnetic><Link href="/demo" className="public-button-primary relative shrink-0">Book a working session <span aria-hidden>↗</span></Link></Magnetic>
              <Link href="/pricing" className="public-button-secondary shrink-0">Pricing</Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
