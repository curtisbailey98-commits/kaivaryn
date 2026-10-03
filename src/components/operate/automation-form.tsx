"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { saveAutomationAction } from "@/app/app/operate-actions";

export type AutomationFormDefaults = {
  prompt?: string;
  title?: string;
  cadence?: "HOURLY" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "MONTHLY";
  everyHours?: number;
  time?: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  timezone?: string;
  actions?: string[];
  metric?: string;
  op?: "gt" | "lt";
  amount?: string;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const field = "mt-1 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 focus:border-amber-500/60 focus:outline-none";
const label = "block text-xs text-neutral-400";

function Submit({ text }: { text: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex h-11 w-full items-center justify-center rounded-md bg-amber-500 px-4 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400 disabled:opacity-60">
      {pending ? "Saving…" : text}
    </button>
  );
}

/** Editable automation spec. Prefilled from a parsed prompt; also the by-hand fallback. */
export function AutomationForm({
  defaults,
  playbooks,
  timezones,
  metrics,
  submitText = "Confirm & schedule",
}: {
  defaults: AutomationFormDefaults;
  playbooks: Array<{ slug: string; name: string }>;
  timezones: Array<{ id: string; label: string }>;
  metrics: Array<{ key: string; label: string; money: boolean }>;
  submitText?: string;
}) {
  const [cadence, setCadence] = useState(defaults.cadence ?? "DAILY");
  const acts = new Set(defaults.actions ?? []);
  const tzList = timezones.some((t) => t.id === defaults.timezone) || !defaults.timezone ? timezones : [{ id: defaults.timezone, label: defaults.timezone }, ...timezones];
  return (
    <form action={saveAutomationAction} className="space-y-4">
      <input type="hidden" name="prompt" value={defaults.prompt ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          How often
          <select name="cadence" value={cadence} onChange={(e) => setCadence(e.target.value as typeof cadence)} className={field}>
            <option value="HOURLY">Hourly</option>
            <option value="DAILY">Every day</option>
            <option value="WEEKDAYS">Every weekday (Mon–Fri)</option>
            <option value="WEEKLY">Weekly on chosen days</option>
            <option value="MONTHLY">Monthly on a day</option>
          </select>
        </label>
        {cadence === "HOURLY" ? (
          <label className={label}>
            Every
            <select name="everyHours" defaultValue={String(defaults.everyHours ?? 1)} className={field}>
              {[1, 2, 3, 4, 6, 8, 12].map((n) => <option key={n} value={n}>{n === 1 ? "1 hour" : `${n} hours`}</option>)}
            </select>
          </label>
        ) : (
          <label className={label}>
            At
            <input type="time" name="time" defaultValue={defaults.time ?? "08:00"} step={300} required className={field} />
          </label>
        )}
      </div>
      {cadence === "HOURLY" ? <input type="hidden" name="time" value={`00:${(defaults.time ?? "00:00").split(":")[1] ?? "00"}`} /> : null}

      {cadence === "WEEKLY" ? (
        <fieldset>
          <legend className="text-xs text-neutral-400">On</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => (
              <label key={d} className="cursor-pointer">
                <input type="checkbox" name="dow" value={i} defaultChecked={(defaults.daysOfWeek ?? [1]).includes(i)} className="peer sr-only" />
                <span className="inline-flex h-9 min-w-[44px] items-center justify-center rounded-md border border-neutral-700 px-2 text-xs text-neutral-400 transition peer-checked:border-amber-500/70 peer-checked:bg-amber-500/10 peer-checked:text-amber-300 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500/60">{d}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {cadence === "MONTHLY" ? (
        <label className={label}>
          Day of the month
          <select name="dayOfMonth" defaultValue={defaults.dayOfMonth === -1 ? "last" : String(defaults.dayOfMonth ?? 1)} className={field}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            <option value="last">Last day of the month</option>
          </select>
        </label>
      ) : null}

      <label className={label}>
        Time zone
        <select name="timezone" defaultValue={defaults.timezone ?? "America/New_York"} className={field}>
          {tzList.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>

      <fieldset>
        <legend className="text-xs text-neutral-400">Do this (pick one or more)</legend>
        <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
          {[
            ["DIGEST", "Executive briefing to my Inbox"],
            ["ANALYZE:REVENUE_RECOVERY", "Analysis · Revenue Recovery"],
            ["ANALYZE:OPERATIONS_EFFICIENCY", "Analysis · Operations Efficiency"],
            ["ANALYZE:BOTH", "Analysis · both"],
            ["DETECT", "Detection sweep"],
            ["STATUS", "Health check"],
            ...playbooks.map((p) => [`PLAYBOOK:${p.slug}`, `Playbook · ${p.name}`]),
          ].map(([v, l]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-800 px-3 py-2 text-xs text-neutral-300 transition hover:border-neutral-600 has-[:checked]:border-amber-500/60 has-[:checked]:bg-amber-500/[0.06]">
              <input type="checkbox" name="act" value={v} defaultChecked={acts.has(v!)} className="accent-amber-500" />
              <span className="min-w-0 truncate">{l}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-neutral-800 p-3">
        <legend className="px-1 text-xs text-neutral-400">Alert threshold (optional)</legend>
        <div className="grid gap-2 sm:grid-cols-[1.6fr_0.8fr_1fr]">
          <select name="metric" defaultValue={defaults.metric ?? ""} className={field} aria-label="Measure">
            <option value="">No threshold</option>
            {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <select name="op" defaultValue={defaults.op ?? "gt"} className={field} aria-label="Comparison">
            <option value="gt">over</option>
            <option value="lt">under</option>
          </select>
          <input name="amount" defaultValue={defaults.amount ?? ""} placeholder="e.g. 50k" className={field} aria-label="Amount" inputMode="decimal" />
        </div>
        <p className="mt-2 text-[11px] leading-5 text-neutral-500">Checked after each run against live workspace data. Money thresholds compare estimates (not recovered or realized amounts). Alerts go to your Inbox.</p>
      </fieldset>

      <label className={label}>
        Name (optional)
        <input name="title" defaultValue={defaults.title ?? ""} maxLength={160} placeholder="Generated from the schedule and action if left blank" className={field} />
      </label>

      <div className="rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-[11px] leading-5 text-neutral-500">
        Delivery: <span className="text-neutral-300">Kaivaryn Inbox</span>. Email delivery isn&apos;t set up on this workspace, so nothing is emailed.
      </div>
      <Submit text={submitText} />
    </form>
  );
}
