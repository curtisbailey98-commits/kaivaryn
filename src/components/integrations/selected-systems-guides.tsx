import Link from "next/link";
import { isRestaurantSystem } from "@/lib/industry/restaurant";
import { resolveSystemStates, type SystemState } from "@/lib/industry/states";
import { getGuide } from "@/lib/integrations/guides";
import { systemName } from "@/lib/integrations/catalog";
import type { SystemSetupMap } from "@/lib/integrations/setup-store";
import { SystemGuideCard } from "./system-guide-card";

/** Guides + intake for every selected non-restaurant system (restaurant systems have their own panel). */
export function SelectedSystemsGuides({
  selected, connections, setup, readOnly = false, includeRestaurant = false,
}: {
  selected: string[];
  connections: Array<{ provider: string; status: string | null }>;
  setup: SystemSetupMap;
  readOnly?: boolean;
  includeRestaurant?: boolean;
}) {
  const keys = selected.filter((k) => includeRestaurant || !isRestaurantSystem(k));
  const states = resolveSystemStates(keys, connections.filter((c) => keys.includes(c.provider)));
  const ordered = Array.from(states.keys());
  if (!ordered.length) {
    return (
      <section className="rounded-2xl border border-dashed border-neutral-800 p-5" data-testid="selected-systems-guides">
        <p className="si-label text-neutral-500">Your systems</p>
        <p className="mt-2 text-xs text-neutral-500">No systems picked yet. <Link href="/app/onboarding" className="text-amber-400">Choose them in setup</Link> to see a guide and business-details form for each one.</p>
      </section>
    );
  }
  return (
    <section className="space-y-3" data-testid="selected-systems-guides">
      <div>
        <p className="si-label text-amber-500">Your systems</p>
        <h2 className="mt-1 text-[15px] font-semibold text-white">Setup guides for what you selected</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-400">Each system has its own steps and the business details Kaivaryn needs. Ticking the checklist never marks a system connected.</p>
      </div>
      <ul className="space-y-3">
        {ordered.map((k) => {
          const guide = getGuide(k);
          if (!guide) return null;
          const state = states.get(k) as SystemState;
          return (
            <li key={k}>
              <SystemGuideCard guide={{ ...guide, name: k === "pos_other" ? systemName(k) : guide.name }} setup={setup[k] ?? null} state={state} readOnly={readOnly} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
