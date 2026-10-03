"use client";

import { cn } from "@/lib/utils";

/** Silver/amber voice orb. Pulses with the assistant's volume while live; still when idle. */
export function VoiceOrb({ state, level, speaking, size = "lg" }: { state: string; level: number; speaking: boolean; size?: "sm" | "lg" }) {
  const live = state === "live";
  const scale = live ? 1 + Math.min(0.18, level * 0.35) : 1;
  const dim = size === "lg" ? "h-20 w-20 sm:h-24 sm:w-24" : "h-12 w-12";
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center", dim)} aria-hidden>
      <span className={cn("absolute inset-0 rounded-full bg-amber-500/10 blur-xl transition-opacity", live ? "opacity-100" : "opacity-40")} />
      <span className={cn("absolute inset-0 rounded-full border border-amber-500/30", state === "connecting" && "animate-ping")} />
      <span
        className="relative h-[78%] w-[78%] rounded-full transition-transform duration-100 ease-out"
        style={{
          transform: `scale(${scale})`,
          background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.85), rgba(212,212,216,0.55) 22%, rgba(82,82,91,0.75) 55%, rgba(10,10,10,0.95) 78%)",
          boxShadow: live && speaking ? "0 0 0 1px rgba(245,158,11,0.55), 0 0 42px rgba(245,158,11,0.35)" : "0 0 0 1px rgba(161,161,170,0.35), 0 0 26px rgba(245,158,11,0.12)",
        }}
      />
    </div>
  );
}
