import { posDataMap, DATA_MAP_LABEL, AVAILABILITY_LABEL, HOW_DATA_ARRIVES } from "@/lib/industry/restaurant";

/** "What Kaivaryn would use" for one POS. Hook-free so it renders on the server, in client components, and in tests. */
export function PosDataMap({ posKey, otherName, compact = false, showHow = true }: { posKey: string; otherName?: string | null; compact?: boolean; showHow?: boolean }) {
  const map = posDataMap(posKey, otherName);
  if (!map) return null;
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4" data-testid="pos-data-map" data-pos={posKey}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400">What Kaivaryn would use</p>
          <p className="mt-1 text-sm font-semibold text-white">{map.name}</p>
        </div>
        <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-0.5 text-[10px] font-semibold text-neutral-300">{DATA_MAP_LABEL}</span>
      </div>
      <ul className={`mt-3 grid gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-2"}`}>
        {map.rows.map((r) => (
          <li key={r.id} className="flex gap-2.5 rounded-lg border border-neutral-900 bg-neutral-900/40 px-3 py-2">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${r.availability === "core" ? "bg-amber-400" : "bg-neutral-500"}`} aria-hidden />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-neutral-100">{r.label}</span>
              {compact ? null : <span className="block text-[11px] leading-4 text-neutral-500">{r.detail}</span>}
              <span className="block text-[10px] leading-4 text-neutral-500">{AVAILABILITY_LABEL[r.availability]}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-5 text-neutral-400">{map.note}</p>
      {showHow ? (
        <ul className="mt-2 space-y-1 text-[11px] leading-5 text-neutral-500">
          {HOW_DATA_ARRIVES.map((h) => <li key={h}>· {h}</li>)}
        </ul>
      ) : null}
      <p className="mt-2 text-[10px] leading-4 text-neutral-600">Not a live connection and not verified API coverage. What your plan and permissions allow is confirmed during setup. Product names belong to their owners; no partnership is implied.</p>
    </div>
  );
}
