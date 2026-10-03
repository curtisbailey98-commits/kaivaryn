import { USAGE_STATE_LABEL } from "@/lib/voice/usage";

type U = { period: string; calls: number; minutes: number; includedMinutes: number | null; remainingMinutes: number | null; percentUsed: number | null; overageState: string; providerCostUsd?: number | null };

/** "Included Voice Usage" — client-facing; no provider names, no credits, no prices. */
export function IncludedVoiceUsage({ usage, showProviderCost }: { usage: U; showProviderCost?: boolean }) {
  const pct = usage.percentUsed ?? 0;
  const bar = usage.includedMinutes ? Math.min(100, pct) : 0;
  const tone = pct >= 100 ? "bg-red-500" : pct >= 90 ? "bg-amber-500" : pct >= 75 ? "bg-amber-400" : "bg-emerald-500";
  const month = new Date(`${usage.period}-01T12:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="si-panel p-5" data-testid="included-voice-usage">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="si-label">Included Voice Usage</p>
        <p className="text-[11px] text-neutral-500">{month}</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div><p className="text-2xl font-semibold text-white">{usage.calls}</p><p className="text-[11px] text-neutral-500">calls</p></div>
        <div><p className="text-2xl font-semibold text-white">{usage.minutes}</p><p className="text-[11px] text-neutral-500">minutes used</p></div>
        <div><p className="text-2xl font-semibold text-white">{usage.includedMinutes ? usage.remainingMinutes : "—"}</p><p className="text-[11px] text-neutral-500">{usage.includedMinutes ? `of ${usage.includedMinutes} remaining` : "remaining"}</p></div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-neutral-900"><div className={`h-full rounded-full ${tone}`} style={{ width: `${bar}%` }} /></div>
      <p className="mt-2 text-xs text-neutral-400">
        {usage.includedMinutes ? `${pct}% used · ` : ""}
        {USAGE_STATE_LABEL[usage.overageState as keyof typeof USAGE_STATE_LABEL] ?? usage.overageState}
        {!usage.includedMinutes ? " — Kaivaryn confirms your included minutes with you. Nothing is charged automatically." : ""}
      </p>
      <p className="mt-1 text-[11px] text-neutral-600">Alerts go to managers at 75%, 90%, and 100%.</p>
      {showProviderCost ? <p className="mt-3 border-t border-neutral-900 pt-3 text-[11px] text-neutral-500">Internal only · provider cost this month: {usage.providerCostUsd != null ? `$${usage.providerCostUsd.toFixed(2)}` : "not reported yet"}</p> : null}
    </div>
  );
}

export function fmtET(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(date)} ET`;
}

export function fmtDuration(s: number | null | undefined) {
  if (s === null || s === undefined) return "—";
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

export const FIT_LABEL: Record<string, string> = { REVENUE_RECOVERY: "Revenue Recovery", OPERATIONS_EFFICIENCY: "Operations Efficiency", BOTH: "RR + OE", UNCLEAR: "Unclear" };
export const CHANNEL_LABEL: Record<string, string> = { phone_inbound: "Phone · inbound", phone_outbound: "Phone · outbound", web_public: "Website", web_workspace: "In-app" };
