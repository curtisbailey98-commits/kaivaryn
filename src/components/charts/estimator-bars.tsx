"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));
}

export function EstimatorResultBars({
  rrBase,
  oeBase,
  totalBase,
}: {
  rrBase: number;
  oeBase: number;
  totalBase: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [key, setKey] = useState(0);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    setKey((k) => k + 1);
  }, [rrBase, oeBase, totalBase]);

  const max = Math.max(rrBase, oeBase, totalBase, 1);
  const rows = [
    { label: "Revenue Recovery (base)", value: rrBase, color: "from-amber-500 to-amber-400" },
    { label: "Operations Efficiency (base)", value: oeBase, color: "from-emerald-500 to-emerald-400" },
    { label: "Combined base case", value: totalBase, color: "from-sky-500 to-sky-400" },
  ];

  return (
    <div key={key} className="mt-6 space-y-3" aria-label="Estimated opportunity bars">
      {rows.map((r, i) => {
        const pct = Math.max(4, Math.round((r.value / max) * 100));
        return (
          <div key={r.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-neutral-400">{r.label}</span>
              <span className="tabular-nums text-neutral-200">{money(r.value)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-neutral-900">
              <div
                className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out", r.color)}
                style={{
                  width: mounted ? `${pct}%` : "0%",
                  transitionDelay: `${i * 80}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-[10px] text-neutral-600">Bars re-animate when inputs change · estimate only, not realized</p>
    </div>
  );
}
