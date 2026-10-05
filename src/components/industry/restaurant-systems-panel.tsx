import Link from "next/link";
import { RESTAURANT_GROUPS, restaurantSystemName, isPos, isRestaurantSystem } from "@/lib/industry/restaurant";
import { resolveSystemStates, type SystemState } from "@/lib/industry/states";
import { PosDataMap } from "./pos-data-map";
import { StateLadder } from "./state-ladder";

const groupOf = (key: string) => RESTAURANT_GROUPS.find((g) => g.options.some((o) => o.key === key))?.title ?? "Restaurant system";

/** Integrations page: the restaurant systems this workspace selected, each with its honest state and (for a POS) the data map. */
export function RestaurantSystemsPanel({ selected, posOther, connections }: { selected: string[]; posOther: string | null; connections: Array<{ provider: string; status: string | null }> }) {
  const restaurant = selected.filter(isRestaurantSystem);
  const states = resolveSystemStates(restaurant, connections.filter((c) => isRestaurantSystem(c.provider)));
  const keys = Array.from(states.keys()).sort((a, b) => Number(isPos(b)) - Number(isPos(a)));
  return (
    <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-500/[0.04] to-neutral-950 p-5" data-testid="restaurant-systems-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="si-label text-amber-500">Restaurant</p>
          <h2 className="mt-1 text-[15px] font-semibold text-white">Your POS and restaurant systems</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-400">Kaivaryn works alongside your POS. Picking a system plans the connection; it is not connected until data has arrived. Until then, a POS back-office export through File import works today.</p>
        </div>
        <Link href="/app/imports" className="inline-flex h-9 items-center rounded-md bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition hover:bg-amber-400">Import a POS export</Link>
      </div>
      {keys.length ? (
        <ul className="mt-4 space-y-4">
          {keys.map((k) => {
            const state = states.get(k) as SystemState;
            const name = k === "pos_other" && posOther ? posOther : restaurantSystemName(k) ?? k;
            return (
              <li key={k} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4" data-system={k}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-sm font-medium text-neutral-100">{name}</p><p className="text-[11px] text-neutral-500">{groupOf(k)}</p></div>
                </div>
                <div className="mt-3"><StateLadder state={state} /></div>
                {isPos(k) ? <div className="mt-4"><PosDataMap posKey={k} otherName={posOther} /></div> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-neutral-800 p-4 text-xs text-neutral-500">No restaurant systems picked yet. <Link href="/app/onboarding" className="text-amber-400">Choose your POS in setup</Link> to see what Kaivaryn would use from it.</p>
      )}
    </section>
  );
}
