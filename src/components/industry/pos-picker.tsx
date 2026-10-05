"use client";

import { useState } from "react";
import { POS_SYSTEMS } from "@/lib/industry/restaurant";
import { PosDataMap } from "./pos-data-map";

const optionClass = "flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm transition has-[:checked]:border-amber-500/50 has-[:checked]:bg-amber-500/[0.06]";

/** POS choices inside the onboarding form (field name integrations[]) with a live "What Kaivaryn would use" map. */
export function PosPicker({ initial, initialOther }: { initial: string[]; initialOther?: string }) {
  const [checked, setChecked] = useState<string[]>(() => POS_SYSTEMS.map((p) => p.key).filter((k) => initial.includes(k)));
  const [other, setOther] = useState(initialOther || "");
  const [active, setActive] = useState<string | null>(null);
  const shown = active && checked.includes(active) ? active : checked[0] ?? null;
  const toggle = (k: string, on: boolean) => setChecked((prev) => (on ? Array.from(new Set([...prev, k])) : prev.filter((x) => x !== k)));

  return (
    <div data-testid="pos-picker">
      <div className="grid gap-3 sm:grid-cols-2">
        {POS_SYSTEMS.map((p) => (
          <label key={p.key} className={optionClass}>
            <input type="checkbox" name="integrations[]" value={p.key} checked={checked.includes(p.key)} onChange={(e) => { toggle(p.key, e.target.checked); if (e.target.checked) setActive(p.key); }} className="mt-1 accent-amber-500" />
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 font-mono text-[10px] font-semibold text-neutral-300" aria-hidden>{p.initials}</span>
            <span className="min-w-0"><span className="block font-medium text-white">{p.name}</span><span className="mt-1 block text-xs leading-5 text-neutral-500">{p.description}</span></span>
          </label>
        ))}
      </div>
      {checked.includes("pos_other") ? (
        <label className="mt-3 block text-xs font-medium text-neutral-300">Which POS do you use?
          <input name="posOther" value={other} onChange={(e) => setOther(e.target.value)} maxLength={60} placeholder="e.g. Aloha Cloud, Upserve, Focus POS" className="mt-2 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 placeholder:text-neutral-600" />
        </label>
      ) : <input type="hidden" name="posOther" value="" />}
      <div className="mt-4" aria-live="polite">
        {shown ? (
          <>
            {checked.length > 1 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {checked.map((k) => (
                  <button key={k} type="button" onClick={() => setActive(k)} className={`rounded-md border px-2 py-1 text-[11px] ${k === shown ? "border-amber-500/50 bg-amber-500/10 text-amber-300" : "border-neutral-800 text-neutral-400"}`}>
                    {k === "pos_other" && other.trim() ? other.trim() : POS_SYSTEMS.find((p) => p.key === k)?.name}
                  </button>
                ))}
              </div>
            ) : null}
            <PosDataMap posKey={shown} otherName={other} compact />
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-neutral-800 p-4 text-xs text-neutral-500">Pick your POS to see what Kaivaryn would use from it. Choosing it plans the connection — it doesn&apos;t connect anything yet.</p>
        )}
      </div>
    </div>
  );
}
