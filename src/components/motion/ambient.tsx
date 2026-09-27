"use client";

import { cn } from "@/lib/utils";

/**
 * Soft gradient mesh + drifting orbs + optional film grain.
 * Pure CSS motion; disabled via prefers-reduced-motion in CSS.
 */
export function AmbientField({
  className,
  intensity = "default",
  grain = true,
}: {
  className?: string;
  intensity?: "subtle" | "default" | "hero";
  grain?: boolean;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      <div
        className={cn(
          "ambient-mesh absolute inset-0",
          intensity === "hero" && "ambient-mesh-hero",
          intensity === "subtle" && "ambient-mesh-subtle"
        )}
      />
      <div className="ambient-orb ambient-orb-a" />
      <div className="ambient-orb ambient-orb-b" />
      <div className="ambient-orb ambient-orb-c" />
      {grain ? <div className="ambient-grain" /> : null}
    </div>
  );
}

/** Breathing grid overlay for heroes / command center. */
export function BreathGrid({ className, opacity = 0.35 }: { className?: string; opacity?: number }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 public-grid-breathe", className)}
      style={{ opacity }}
      aria-hidden
    />
  );
}
