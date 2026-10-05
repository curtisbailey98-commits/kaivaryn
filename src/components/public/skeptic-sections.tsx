import Link from "next/link";
import { ZOOM_SCHEDULER_URL } from "@/lib/constants";
import { Reveal } from "@/components/motion";

/* Plain-English sections for a skeptical owner: what you get, before/after, 90 days, control, FAQ. */

export const WHAT_YOU_GET = [
  ["A ranked list of where you're losing money", "Unpaid invoices, missed leads, underbilling, lost customers, wasted hours — each with a dollar estimate, the evidence behind it, and how confident we are."],
  ["People and software that work the list", "Kaivaryn operators work alongside your team in a private workspace. Every issue gets an owner and a next step; anything consequential waits for your approval."],
  ["A scorecard you can take to the board", "What was estimated, what your team recorded as recovered or saved, and what was verified — side by side, never blended into one flattering number."],
] as const;

export function WhatYouGet() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-3 sm:px-6">
      {WHAT_YOU_GET.map(([t, b], i) => (
        <Reveal key={t} variant="up" delay={i * 80}>
          <div>
            <p className="font-mono text-xs text-amber-500">0{i + 1}</p>
            <p className="mt-2 text-base font-semibold text-white">{t}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-400">{b}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

const WORKFLOWS = [
  {
    title: "Unpaid invoices",
    before: "Invoices past 60 days sit in an aging report. Follow-up happens when someone has time, and nobody owns the total.",
    after: "Every overdue account is ranked by value, given an owner and a dated next step, and the follow-up is prepared for your team. It's tracked until the cash lands.",
    approve: "Anything that goes to a customer — reminders, payment plans, credits, write-offs.",
    measure: "Cash collected against each invoice, recorded when it arrives.",
  },
  {
    title: "Missed calls and leads",
    before: "After-hours and overflow calls go to voicemail. Some get returned the next day. Some never do.",
    after: "A voice assistant answers inbound calls, handles common questions from information you approved, and takes the message or callback request straight to an owner's inbox. Leads nobody has worked get flagged before they go cold.",
    approve: "Prices, discounts, and commitments always go to a person. The assistant answers calls; it doesn't make sales calls.",
    measure: "Calls answered, callbacks completed, and revenue your team records from those leads.",
  },
  {
    title: "Slow quotes",
    before: "Quotes wait in someone's inbox for days, and the prospect signs with whoever answered first.",
    after: "Quotes that stall past the turnaround you set are flagged with their dollar value and sent to an owner, on a schedule you choose.",
    approve: "Pricing, discounts, and terms stay with your people.",
    measure: "Time to quote, and won revenue on flagged quotes as your team records it.",
  },
  {
    title: "Manual reporting",
    before: "Someone spends Monday morning copying numbers from three systems into a spreadsheet.",
    after: "Kaivaryn imports the CSV, Excel, or Google Sheets exports you already have, then builds the weekly briefing and highlights what changed. Repeated manual steps get a cost and are proposed for automation.",
    approve: "No automation runs until someone approves it.",
    measure: "Hours per week saved, as recorded by the process owner.",
  },
  {
    title: "Customers who quietly leave",
    before: "You find out a customer left when the renewal doesn't come in.",
    after: "Customers who have gone quiet or have failed payments are flagged early, and each at-risk account goes to an owner with a suggested next step.",
    approve: "Retention offers, credits, and price changes need a person's approval.",
    measure: "Revenue kept on flagged accounts, recorded by your team.",
  },
] as const;

export function BeforeAfterWorkflows() {
  return (
    <div>
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {WORKFLOWS.map((w, i) => (
          <Reveal key={w.title} variant="up" delay={(i % 3) * 70}>
            <article className="public-card flex h-full flex-col p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-white">{w.title}</h3>
                <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-600">Illustrative</span>
              </div>
              <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Today</p>
                <p className="mt-1 text-sm leading-6 text-neutral-400">{w.before}</p>
              </div>
              <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">With Kaivaryn</p>
                <p className="mt-1 text-sm leading-6 text-neutral-200">{w.after}</p>
              </div>
              <dl className="mt-4 space-y-2 text-xs leading-5">
                <div className="flex gap-2"><dt className="w-24 shrink-0 text-neutral-500">You approve</dt><dd className="text-neutral-300">{w.approve}</dd></div>
                <div className="flex gap-2"><dt className="w-24 shrink-0 text-neutral-500">We measure</dt><dd className="text-neutral-300">{w.measure}</dd></div>
              </dl>
            </article>
          </Reveal>
        ))}
        <Reveal variant="up" delay={140}>
          <div className="flex h-full flex-col justify-between rounded-2xl border border-dashed border-neutral-800 p-5 sm:p-6">
            <div>
              <p className="text-base font-semibold text-white">Something else is leaking?</p>
              <p className="mt-2 text-sm leading-6 text-neutral-400">Underbilling, contract rate drift, duplicate data entry, approval delays. Bring the one that bothers you most to a demo.</p>
            </div>
            <a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="mt-5 text-sm font-medium text-amber-400 hover:text-amber-300">Book a demo <span aria-hidden>↗</span></a>
          </div>
        </Reveal>
      </div>
      <p className="mt-4 text-xs text-neutral-600">Illustrative workflows showing how the work runs. They are not results from a client.</p>
    </div>
  );
}

const PLAN = [
  {
    days: "Days 1–30",
    title: "Find",
    items: [
      "Kickoff on the one or two problems that cost you the most.",
      "Your team sends exports you already have: billing, receivables aging, CRM, call logs.",
      "You get a ranked list of where money and time are leaking, each with a dollar estimate, the evidence, and a confidence level. The first findings are targeted for weeks 1–2 once the records are in.",
    ],
    checkpoint: "You decide which issues are worth acting on.",
  },
  {
    days: "Days 31–60",
    title: "Act",
    items: [
      "Each chosen issue gets an owner and a next step.",
      "Your team works the list with our operators. Anything consequential waits for your approval.",
      "Recovered cash and saved hours are recorded as they happen, against the issue that produced them.",
    ],
    checkpoint: "You see estimated and recorded value side by side.",
  },
  {
    days: "Days 61–90",
    title: "Prove",
    items: [
      "A 90-day scorecard: estimated, recorded, and verified.",
      "Work that keeps repeating becomes an approved automation.",
      "Weekly briefings keep leadership current without another meeting.",
    ],
    checkpoint: "You decide what comes next with real numbers in front of you.",
  },
] as const;

export function NinetyDayPlan() {
  return (
    <div>
      <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-800 lg:grid-cols-3">
        {PLAN.map((p, i) => (
          <li key={p.days} className="bg-neutral-950">
            <Reveal variant="fade" delay={i * 80} className="h-full">
              <div className="flex h-full flex-col p-6 sm:p-7">
                <p className="font-mono text-xs text-amber-500">{p.days}</p>
                <h3 className="mt-3 text-xl font-semibold text-white">{p.title}</h3>
                <ul className="mt-4 space-y-2.5 text-sm leading-6 text-neutral-400">
                  {p.items.map((it) => (
                    <li key={it} className="flex gap-2"><span className="text-amber-400" aria-hidden>—</span><span>{it}</span></li>
                  ))}
                </ul>
                <p className="mt-auto pt-5 text-sm font-medium text-emerald-300/90">✓ {p.checkpoint}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm leading-6 text-neutral-400 sm:p-5">
        <span className="font-semibold text-white">What you need to do: </span>
        give us a kickoff session, access to the exports, one named owner per issue, and a short weekly review. Your team keeps its existing tools, and nothing changes in your systems without approval.
      </div>
    </div>
  );
}

const CONTROLS = [
  ["You approve every consequential step", "Anything that commits you to a customer, moves money, or changes a system waits for a named person to approve it. Every decision is logged: who, what, and when."],
  ["It never acts in your systems on its own", "Approving records the decision. Your team, or an integration you've approved, carries out the work. Outbound sales calling is off."],
  ["Your data stays in your own workspace", "Each client gets a private, isolated workspace with role-based access. Your records are never visible to another client."],
  ["Estimates are never passed off as results", "Estimated value and recorded results sit in separate columns and are never added together. If the data is too thin, it says so instead of guessing."],
] as const;

export function StayInControl() {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2">
      {CONTROLS.map(([t, b], i) => (
        <Reveal key={t} variant="up" delay={i * 60}>
          <div className="public-card h-full p-5 sm:p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/40 text-[10px] text-emerald-400" aria-hidden>✓</span>{t}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-400">{b}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

export function buildFaq(price: { seats: number; intro: number; standard: number }) {
  const m = (n: number) => `$${n.toLocaleString("en-US")}`;
  return [
    {
      q: "What exactly do I get?",
      a: "A private Kaivaryn workspace, Kaivaryn operators working with your team, and both disciplines: Revenue Recovery (money you've earned but aren't collecting) and Operations Efficiency (work that costs more than it should). In practice that means a ranked list of issues with dollar estimates and evidence, an owner and approval path on each one, weekly executive briefings, and a scorecard of what was actually recovered. Data import and setup are done with you.",
    },
    {
      q: "How fast will I see results?",
      a: "The first ranked findings are targeted for weeks 1–2 once your records are in. Recovered cash depends on your team acting on them, so it's recorded as it lands rather than promised up front. By day 90 you have a scorecard showing estimated, recorded, and verified value.",
    },
    {
      q: "What does it cost, and what does it return?",
      a: `${m(price.intro)} a month for the first ${price.seats} clients, then ${m(price.standard)} a month, for the same scope. The return depends on your business, which is why the calculator on this page uses your numbers, not ours. Inside the workspace, nothing counts as returned until your team records it.`,
    },
    {
      q: "Is my data safe? Who controls it?",
      a: "You do. Each client has a private, isolated workspace with role-based access, so you decide who on your team sees what. Your records are never visible to another client. Kaivaryn doesn't act in your systems on its own: integrations are labeled as not connected until they are, and consequential actions wait for approval.",
    },
    {
      q: "Will this disrupt my team?",
      a: "It's designed not to. We start from the exports your systems already produce (CSV, Excel, Google Sheets), your team keeps the tools it uses, and the work arrives as a short, ranked list with an owner on each item instead of another dashboard to watch.",
    },
    {
      q: "What if it doesn't work?",
      a: "You'll know early. The first findings come with dollar estimates and the evidence behind them, so if they don't justify the fee you'll see it in weeks, not after a year. Every result is recorded in your own workspace, so the scorecard belongs to you, not to our marketing. Commitment length and terms are agreed in writing before any payment. Ask us about them on the demo.",
    },
    {
      q: "Is this just ChatGPT with a logo?",
      a: "No. The analysis that finds and values issues follows fixed rules applied to your own records, so the same records always give the same answer, and it reports 'not enough data' instead of making something up. AI language models are used where they genuinely help, such as the voice assistant that answers calls. And it isn't only software: Kaivaryn operators work the list with your team.",
    },
    {
      q: "What do I need to do?",
      a: "Join a kickoff session, give us access to the relevant exports, name one owner per issue, and keep a short weekly review for approvals and the briefing. That's it.",
    },
    {
      q: "Where are your case studies and client logos?",
      a: "You won't find logos, testimonials, or client results here. Kaivaryn is in its founding-client phase, and we don't publish results we can't back up with evidence and permission. In the demo we show the software on example data, which is clearly labeled, and run the estimate on your numbers.",
    },
    {
      q: "What happens on the demo?",
      a: "A live Zoom call. We talk through the problem that costs you the most, show the workspace on example data, and look at your numbers together. There's no pressure. A payment link is only shared after the demo, and only if you decide it's a fit.",
    },
  ];
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="mt-10 divide-y divide-neutral-800 rounded-2xl border border-neutral-800 bg-neutral-950/60">
      {items.map((f) => (
        <details key={f.q} className="group px-5 py-4 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-white sm:text-base [&::-webkit-details-marker]:hidden">
            {f.q}
            <span className="shrink-0 text-amber-400 transition group-open:rotate-45" aria-hidden>+</span>
          </summary>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function LowPressureCta({ heading = "See it on your numbers.", sub }: { heading?: string; sub?: string }) {
  return (
    <div className="public-card relative flex flex-col items-start justify-between gap-8 overflow-hidden bg-amber-500/[0.06] p-7 sm:flex-row sm:items-center sm:p-10">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" />
      <div>
        <p className="public-kicker text-amber-400">Next step</p>
        <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">{heading}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">{sub ?? "A live Zoom demo. Bring the problem that costs you the most and the numbers from the calculator. No preparation needed, and no payment link unless you decide it fits."}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-3 sm:items-end">
        <a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="public-button-primary relative">Book a demo <span aria-hidden>↗</span></a>
        <Link href="/demo" className="text-xs text-neutral-400 hover:text-white">Prefer a callback? Leave your details →</Link>
      </div>
    </div>
  );
}
