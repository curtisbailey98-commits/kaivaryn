import { RESTAURANT_PLAYBOOKS } from "@/lib/industry/restaurant-playbooks";
import { Button } from "@/components/ui/button";
import { addRestaurantPlaybookAction } from "@/app/app/operate-actions";

/** Templates for restaurant workspaces — recommendations until added to this tenant's playbooks. */
export function RestaurantPlaybooksPanel({
  selectedSystems, ownedSlugs, canWrite = false,
}: {
  selectedSystems: string[];
  ownedSlugs: Set<string>;
  canWrite?: boolean;
}) {
  const selected = new Set(selectedSystems);
  return (
    <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-500/[0.04] to-neutral-950 p-5" data-testid="restaurant-playbooks-panel">
      <div>
        <p className="si-label text-amber-500">Restaurant templates</p>
        <h2 className="mt-1 text-[15px] font-semibold text-white">Playbooks that fit how restaurants lose money and waste labor</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-400">These are templates, not findings. Adding one copies it into your workspace. A run only analyzes data this workspace has imported — picking a POS does not invent results.</p>
      </div>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {RESTAURANT_PLAYBOOKS.map((t) => {
          const needs = t.needsSystems || [];
          const hasNeed = !needs.length || needs.some((k) => selected.has(k));
          const owned = ownedSlugs.has(t.slug) || ownedSlugs.has(t.name.toLowerCase()) || ownedSlugs.has(t.slug.replace(/^restaurant-/, ""));
          return (
            <li key={t.slug} className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-950/70 p-4" data-playbook={t.slug}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${t.product === "REVENUE_RECOVERY" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-sky-500/30 bg-sky-500/10 text-sky-300"}`}>
                  {t.product === "REVENUE_RECOVERY" ? "Revenue Recovery" : "Operations Efficiency"}
                </span>
                {t.voiceTie ? <span className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400">Pairs with voice</span> : null}
              </div>
              <p className="mt-2 text-sm font-medium text-white">{t.name}</p>
              <p className="mt-1 text-xs leading-5 text-neutral-400">{t.looksFor}</p>
              <p className="mt-2 text-[11px] italic leading-5 text-neutral-500">{t.example}</p>
              {!hasNeed && needs.length ? (
                <p className="mt-2 text-[11px] text-neutral-500">More useful once you select a matching system in setup (e.g. delivery or labor).</p>
              ) : null}
              <div className="mt-auto pt-3">
                {owned ? (
                  <p className="text-[11px] text-emerald-400">Already in your playbooks</p>
                ) : canWrite ? (
                  <form action={addRestaurantPlaybookAction}>
                    <input type="hidden" name="slug" value={t.slug} />
                    <Button type="submit" size="sm" variant="outline">Add to my playbooks</Button>
                  </form>
                ) : (
                  <p className="text-[11px] text-neutral-500">Ask a manager to add this template</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
