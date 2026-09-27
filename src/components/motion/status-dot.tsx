"use client";

import { cn } from "@/lib/utils";

export function StatusDot({
  tone = "ok",
  label,
  className,
}: {
  tone?: "ok" | "warn" | "accent" | "muted";
  label?: string;
  className?: string;
}) {
  const tones = {
    ok: "bg-emerald-400",
    warn: "bg-amber-400",
    accent: "bg-amber-400",
    muted: "bg-neutral-500",
  };
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-life-ping rounded-full opacity-60",
            tones[tone]
          )}
        />
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", tones[tone])} />
      </span>
      {label ? <span>{label}</span> : null}
    </span>
  );
}
