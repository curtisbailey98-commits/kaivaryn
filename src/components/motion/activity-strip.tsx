"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { StatusDot } from "./status-dot";
import { useReducedMotion } from "./use-reduced-motion";

type Item = { id: string; label: string; tone?: "ok" | "warn" | "accent" };

const DEFAULT_ITEMS: Item[] = [
  { id: "1", label: "Detection cycle idle · waiting on next import", tone: "ok" },
  { id: "2", label: "Approval gate armed · high-value actions blocked until review", tone: "accent" },
  { id: "3", label: "Evidence store healthy · tenant isolation verified", tone: "ok" },
  { id: "4", label: "Learning loop quiet · outcomes update confidence", tone: "warn" },
];

/**
 * Live-feeling activity strip for Command Center.
 * Cycles honest system-status copy — no fake customer metrics.
 */
export function ActivityStrip({
  items = DEFAULT_ITEMS,
  className,
}: {
  items?: Item[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || items.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, [items.length, reduced]);

  const current = items[index] ?? items[0];
  if (!current) return null;

  return (
    <div
      className={cn(
        "si-glass flex items-center gap-3 overflow-hidden px-3.5 py-2.5 text-xs text-neutral-400",
        className
      )}
      aria-live="polite"
    >
      <StatusDot tone={current.tone ?? "ok"} />
      <span className="activity-strip-label min-w-0 flex-1 truncate text-neutral-300" key={current.id + index}>
        {current.label}
      </span>
      <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-600 sm:inline">
        mission control
      </span>
    </div>
  );
}
