"use client";

import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

/** Accent line that draws in on view. */
export function SectionRule({ className, tone = "amber" }: { className?: string; tone?: "amber" | "emerald" | "neutral" }) {
  const tones = {
    amber: "from-amber-500/0 via-amber-400 to-amber-500/0",
    emerald: "from-emerald-500/0 via-emerald-400 to-emerald-500/0",
    neutral: "from-transparent via-neutral-600 to-transparent",
  };
  return (
    <Reveal variant="fade" className={cn("overflow-hidden", className)}>
      <div className={cn("section-rule-draw h-px w-full bg-gradient-to-r", tones[tone])} />
    </Reveal>
  );
}
