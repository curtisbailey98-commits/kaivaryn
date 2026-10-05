"use client";

import { useMemo, useState } from "react";
import { ZOOM_SCHEDULER_URL } from "@/lib/constants";

/**
 * "What's leaking in your business?" — an owner-input estimate.
 * Every formula is shown, every input is the owner's, nothing comes from client data or invented benchmarks.
 * Annual run-rate leaks and one-time cash (overdue invoices) are kept separate and never added together.
 */

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.max(0, Math.round(n)));
const num = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);

const WORK_WEEKS = 48;

type FieldDef = { key: string; label: string; prefix?: string; suffix?: string; step?: number; max?: number; def: number };
type LeakDef = {
  id: string;
  title: string;
  question: string;
  kind: "annual" | "one-time";
  fields: FieldDef[];
  calc: (v: Record<string, number>) => number;
  formula: (v: Record<string, number>, result: number) => string;
};

const LEAKS: LeakDef[] = [
  {
    id: "invoices",
    title: "Overdue invoices",
    question: "Cash you've earned but haven't collected.",
    kind: "one-time",
    fields: [
      { key: "overdue", label: "Invoices more than 60 days overdue", prefix: "$", step: 5000, def: 250_000 },
      { key: "collect", label: "Share you'd expect to collect with owned, consistent follow-up", suffix: "%", max: 100, def: 30 },
    ],
    calc: (v) => v.overdue * (v.collect / 100),
    formula: (v, r) => `${usd(v.overdue)} overdue × ${num(v.collect)}% collected = ${usd(r)} one-time cash`,
  },
  {
    id: "calls",
    title: "Missed calls & leads",
    question: "Inquiries that go to voicemail or never get a reply.",
    kind: "annual",
    fields: [
      { key: "missed", label: "Calls or inquiries not answered or returned, per month", def: 40 },
      { key: "convert", label: "Share that would have become customers", suffix: "%", max: 100, def: 10 },
      { key: "value", label: "Average first-year value of a new customer", prefix: "$", step: 500, def: 5_000 },
    ],
    calc: (v) => v.missed * 12 * (v.convert / 100) * v.value,
    formula: (v, r) => `${num(v.missed)}/mo × 12 × ${num(v.convert)}% × ${usd(v.value)} = ${usd(r)} / yr`,
  },
  {
    id: "quotes",
    title: "Slow quotes",
    question: "Deals lost because the quote went out too late.",
    kind: "annual",
    fields: [
      { key: "quotes", label: "Quotes sent per month", def: 25 },
      { key: "avg", label: "Average quote value", prefix: "$", step: 500, def: 12_000 },
      { key: "lost", label: "Share of quotes lost because of slow turnaround", suffix: "%", max: 100, step: 0.5, def: 3 },
    ],
    calc: (v) => v.quotes * 12 * v.avg * (v.lost / 100),
    formula: (v, r) => `${num(v.quotes)}/mo × 12 × ${usd(v.avg)} × ${num(v.lost)}% = ${usd(r)} / yr`,
  },
  {
    id: "reporting",
    title: "Manual reporting & re-keying",
    question: "Staff time spent copying numbers between systems and spreadsheets.",
    kind: "annual",
    fields: [
      { key: "hours", label: "Staff hours per week on manual reports and re-entry", def: 40 },
      { key: "rate", label: "Loaded cost per staff hour", prefix: "$", def: 45 },
    ],
    calc: (v) => v.hours * WORK_WEEKS * v.rate,
    formula: (v, r) => `${num(v.hours)} h/wk × ${WORK_WEEKS} weeks × ${usd(v.rate)} = ${usd(r)} / yr`,
  },
  {
    id: "churn",
    title: "Customers you lose",
    question: "Accounts that quietly stop buying or don't renew.",
    kind: "annual",
    fields: [
      { key: "lostCustomers", label: "Customers lost per year", def: 15 },
      { key: "arpc", label: "Average annual revenue per customer", prefix: "$", step: 1000, def: 25_000 },
      { key: "preventable", label: "Share that were preventable with an earlier warning", suffix: "%", max: 100, def: 25 },
    ],
    calc: (v) => v.lostCustomers * v.arpc * (v.preventable / 100),
    formula: (v, r) => `${num(v.lostCustomers)} × ${usd(v.arpc)} × ${num(v.preventable)}% = ${usd(r)} / yr`,
  },
];

function initialValues() {
  const out: Record<string, Record<string, number>> = {};
  for (const l of LEAKS) out[l.id] = Object.fromEntries(l.fields.map((f) => [f.key, f.def]));
  return out;
}

export function LeakCalculator({ introMonthly, standardMonthly, introSeats }: { introMonthly: number; standardMonthly: number; introSeats: number }) {
  const [values, setValues] = useState(initialValues);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(LEAKS.map((l) => [l.id, true])));
  const [recoverPct, setRecoverPct] = useState(25);

  const results = useMemo(() => {
    const rows = LEAKS.map((l) => {
      const v = values[l.id];
      const r = Math.max(0, l.calc(v));
      return { leak: l, value: r, formula: l.formula(v, r), on: enabled[l.id] };
    });
    const annual = rows.filter((r) => r.on && r.leak.kind === "annual").reduce((s, r) => s + r.value, 0);
    const oneTime = rows.filter((r) => r.on && r.leak.kind === "one-time").reduce((s, r) => s + r.value, 0);
    const recovered = annual * (recoverPct / 100);
    const introFee = introMonthly * 12;
    const standardFee = standardMonthly * 12;
    return { rows, annual, oneTime, recovered, introFee, standardFee, introRatio: introFee > 0 ? recovered / introFee : 0, standardRatio: standardFee > 0 ? recovered / standardFee : 0 };
  }, [values, enabled, recoverPct, introMonthly, standardMonthly]);

  const set = (leak: string, key: string, n: number) => setValues((prev) => ({ ...prev, [leak]: { ...prev[leak], [key]: Number.isFinite(n) ? Math.max(0, n) : 0 } }));
  const reset = () => { setValues(initialValues()); setEnabled(Object.fromEntries(LEAKS.map((l) => [l.id, true]))); setRecoverPct(25); };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
      <div className="space-y-3">
        <div className="sticky top-[6.75rem] z-10 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-neutral-950/95 px-3.5 py-2.5 text-xs shadow-lg backdrop-blur lg:hidden" aria-hidden>
          <span className="text-neutral-400">Est. leak <span className="font-semibold text-white">{usd(results.annual)}/yr</span></span>
          <span className="text-neutral-400">At {recoverPct}%: <span className="font-semibold text-amber-300">{usd(results.recovered)}</span> · <span className={results.introRatio >= 1 ? "text-emerald-400" : "text-neutral-300"}>{num(results.introRatio)}× fee</span></span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-2.5 text-xs text-amber-200/90">
          <span>The numbers below are placeholders. Replace them with yours — untick anything that doesn&apos;t apply.</span>
          <button type="button" onClick={reset} className="text-amber-400 underline-offset-2 hover:underline">Reset</button>
        </div>
        {results.rows.map(({ leak, value, formula, on }) => (
          <fieldset key={leak.id} className={`public-card p-4 sm:p-5 ${on ? "" : "opacity-50"}`} data-leak={leak.id}>
            <legend className="sr-only">{leak.title}</legend>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => setEnabled((p) => ({ ...p, [leak.id]: e.target.checked }))}
                  className="mt-1 h-4 w-4 accent-amber-500"
                  aria-label={`Include ${leak.title}`}
                />
                <span>
                  <span className="block text-sm font-semibold text-white">{leak.title}</span>
                  <span className="block text-xs text-neutral-500">{leak.question}</span>
                </span>
              </label>
              <span className="text-right">
                <span className="block text-lg font-semibold text-amber-300">{usd(value)}<span className="text-xs font-normal text-neutral-500">{leak.kind === "annual" ? " / yr" : " one-time"}</span></span>
                <span className="block text-[10px] uppercase tracking-wider text-neutral-600">Estimate</span>
              </span>
            </div>
            {on ? (
              <>
                <div className={`mt-4 grid gap-3 ${leak.fields.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                  {leak.fields.map((f) => (
                    <label key={f.key} className="block">
                      <span className="block min-h-[2rem] text-[11px] leading-4 text-neutral-400">{f.label}</span>
                      <span className="mt-1 flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 focus-within:border-amber-500/60">
                        {f.prefix ? <span className="text-sm text-neutral-500">{f.prefix}</span> : null}
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={f.max}
                          step={f.step ?? 1}
                          value={values[leak.id][f.key]}
                          onChange={(e) => set(leak.id, f.key, f.max ? Math.min(f.max, Number(e.target.value)) : Number(e.target.value))}
                          className="h-10 w-full min-w-0 bg-transparent text-sm text-neutral-100 outline-none"
                          aria-label={`${leak.title}: ${f.label}`}
                        />
                        {f.suffix ? <span className="text-sm text-neutral-500">{f.suffix}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 rounded-md bg-white/[0.03] px-3 py-2 font-mono text-[11px] leading-5 text-neutral-400">
                  <span className="text-neutral-600">Formula: </span>{formula}
                </p>
              </>
            ) : null}
          </fieldset>
        ))}
      </div>

      <aside className="lg:sticky lg:top-24" aria-live="polite">
        <div className="public-card relative overflow-hidden border-amber-500/30 p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
          <p className="relative inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400">Estimate from your inputs · not a promise</p>

          <p className="relative mt-5 text-[11px] uppercase tracking-wider text-neutral-500">Estimated annual leak</p>
          <p className="relative mt-1 text-4xl font-semibold tracking-tight text-white" data-testid="leak-annual">{usd(results.annual)}<span className="text-sm font-normal text-neutral-500"> / yr</span></p>
          <p className="relative mt-1 text-xs text-neutral-500">Sum of the yearly items you ticked.</p>

          {results.oneTime > 0 ? (
            <div className="relative mt-4 rounded-lg border border-neutral-800 bg-neutral-950/70 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">Plus one-time cash in overdue invoices</p>
              <p className="mt-0.5 text-lg font-semibold text-white">{usd(results.oneTime)}</p>
              <p className="text-[11px] text-neutral-600">Shown separately — not added to the yearly figure.</p>
            </div>
          ) : null}

          <div className="relative mt-5 border-t border-neutral-800 pt-5">
            <label className="block">
              <span className="flex items-baseline justify-between text-xs text-neutral-300">
                <span>Be conservative: assume you only fix</span>
                <span className="font-semibold text-amber-300">{recoverPct}%</span>
              </span>
              <input type="range" min={5} max={100} step={5} value={recoverPct} onChange={(e) => setRecoverPct(Number(e.target.value))} className="mt-2 w-full accent-amber-500" aria-label="Share of the annual leak you assume is fixed" />
            </label>
            <p className="mt-3 text-[11px] uppercase tracking-wider text-neutral-500">Estimated yearly value at {recoverPct}%</p>
            <p className="mt-0.5 text-2xl font-semibold text-amber-300" data-testid="leak-recovered">{usd(results.recovered)}<span className="text-sm font-normal text-neutral-500"> / yr</span></p>
          </div>

          <div className="relative mt-5 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 text-xs">
            <p className="font-semibold text-neutral-200">Against the cost of Kaivaryn</p>
            <div className="mt-2 flex items-baseline justify-between gap-2 text-neutral-400">
              <span>Founding-client fee (first {introSeats}) · {usd(introMonthly)}/mo</span>
              <span className="text-neutral-200">{usd(results.introFee)}/yr</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2 text-neutral-400">
              <span>Your estimate ÷ fee</span>
              <span className={`font-semibold ${results.introRatio >= 1 ? "text-emerald-400" : "text-neutral-300"}`} data-testid="leak-ratio">{num(results.introRatio)}×</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2 text-neutral-500">
              <span>At standard pricing ({usd(standardMonthly)}/mo)</span>
              <span>{num(results.standardRatio)}×</span>
            </div>
            <p className="mt-2 leading-5 text-neutral-500">
              {results.introRatio >= 1
                ? "On your numbers, the estimated value covers the fee. A demo is how you check whether those numbers hold up in your records."
                : "On these numbers, the estimate doesn't cover the fee. That's useful to know — bring them to a demo to see whether there's more to look at, or whether this isn't a fit yet."}
            </p>
          </div>

          <a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="public-button-primary relative mt-5 block text-center">
            Check these numbers on a demo <span aria-hidden>↗</span>
          </a>
          <p className="relative mt-2 text-center text-[11px] text-neutral-500">Live on Zoom. No payment link unless you decide it fits.</p>
        </div>

        <details className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-xs leading-5 text-neutral-400" open>
          <summary className="cursor-pointer font-semibold text-neutral-200">Assumptions behind this estimate</summary>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            <li>Every number comes from you. No industry benchmarks, no client data, no averages we made up.</li>
            <li>Yearly items are run-rates. Overdue invoices are one-time cash and are never added to the yearly total.</li>
            <li>Staff time uses {WORK_WEEKS} working weeks per year.</li>
            <li>The &ldquo;assume you only fix&rdquo; slider is your assumption, not a Kaivaryn target or guarantee.</li>
            <li>Nothing here is counted as a result. In a Kaivaryn workspace, money only counts as recovered once your team records it.</li>
          </ul>
        </details>
      </aside>
    </div>
  );
}
