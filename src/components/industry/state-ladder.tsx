import { INTEGRATION_STATES, INTEGRATION_STATE_LABEL, INTEGRATION_STATE_HELP, type SystemState } from "@/lib/industry/states";

/** selected → connection planned → configured → connected → verified, with the current state highlighted. */
export function StateLadder({ state }: { state: SystemState }) {
  const at = INTEGRATION_STATES.indexOf(state);
  return (
    <div data-testid="state-ladder" data-state={state}>
      <ol className="flex flex-wrap items-center gap-1 text-[10px]">
        {INTEGRATION_STATES.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <span className={`rounded-full border px-2 py-0.5 font-semibold ${i === at ? (s === "connected" || s === "verified" ? "border-emerald-700 bg-emerald-950/60 text-emerald-300" : "border-amber-600/60 bg-amber-500/10 text-amber-300") : i < at ? "border-neutral-700 text-neutral-400" : "border-neutral-900 text-neutral-600"}`}>{INTEGRATION_STATE_LABEL[s]}</span>
            {i < INTEGRATION_STATES.length - 1 ? <span className="text-neutral-700" aria-hidden>→</span> : null}
          </li>
        ))}
      </ol>
      <p className="mt-1.5 text-[11px] text-neutral-500">{INTEGRATION_STATE_HELP[state]}</p>
    </div>
  );
}
