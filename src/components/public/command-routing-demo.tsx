"use client";

import { useEffect, useState } from "react";
import { routeCommand, type CommandRoute } from "@/lib/operate/router";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";

const ASKS = [
  "Brief me on what changed this week",
  "Analyze revenue leakage in billing and renewals",
  "How much revenue have we recovered?",
  "Plan a fix for unbilled change orders",
  "Every Monday run playbook executive-weekly-review",
  "Diagnose manual handoffs and approval bottlenecks",
  "status",
];

const ROUTES: Array<{ route: CommandRoute; label: string; dest: string }> = [
  { route: "ANALYZE", label: "Analyze", dest: "Nine-return cycle R1–R9" },
  { route: "ANSWER", label: "Answer", dest: "Deterministic query on your data" },
  { route: "BUILD", label: "Plan", dest: "Owned task + approval gate" },
  { route: "DIGEST", label: "Brief", dest: "Digest saved to Inbox" },
  { route: "STANDING", label: "Schedule", dest: "Standing order" },
  { route: "STATUS", label: "Status", dest: "Operate health check" },
];

/** Uses the product's real routing rules (src/lib/operate/router.ts) — only the typing is animated. */
export function CommandRoutingDemo() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(reduced ? ASKS[0]!.length : 0);
  const ask = ASKS[i % ASKS.length]!;
  const done = typed >= ask.length;
  const routed = routeCommand(ask);

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => {
        setI((v) => v + 1);
      }, 3200);
      return () => clearTimeout(t);
    }
    if (!done) {
      const t = setTimeout(() => setTyped((v) => v + 1), 28);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setI((v) => v + 1);
      setTyped(0);
    }, 2400);
    return () => clearTimeout(t);
  }, [done, reduced, i]);

  const shown = reduced ? ask : ask.slice(0, typed);

  return (
    <div className="public-terminal relative overflow-hidden rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between border-b border-white/10 pb-3 text-[10px] uppercase tracking-[0.2em] text-neutral-500">
        <span>Command</span>
        <span className="text-amber-400/80">Real routing rules · animated input</span>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-black/40 px-3 py-3">
        <span className="font-mono text-amber-400">›</span>
        <span className="min-h-[1.25rem] flex-1 truncate font-mono text-sm text-neutral-100">
          {shown}
          {!done && !reduced ? <span className="ml-0.5 inline-block h-4 w-[7px] translate-y-0.5 animate-pulse bg-amber-400" /> : null}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ROUTES.map((r) => {
          const active = (done || reduced) && routed.route === r.route;
          return (
            <div
              key={r.route}
              className={`rounded-lg border px-3 py-2.5 transition duration-500 ${active ? "border-amber-400/70 bg-amber-500/15 shadow-[0_0_30px_rgba(245,158,11,0.25)]" : "border-white/[0.07] bg-white/[0.02]"}`}
            >
              <p className={`text-xs font-semibold ${active ? "text-amber-300" : "text-neutral-400"}`}>{r.label}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-neutral-500">{r.dest}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 h-4 text-[11px] text-neutral-500">
        {done || reduced ? <>Routed by <span className="font-mono text-neutral-300">{routed.reason}</span>{routed.product !== "BOTH" ? <> · scope <span className="text-neutral-300">{routed.product === "REVENUE_RECOVERY" ? "Revenue Recovery" : "Operations Efficiency"}</span></> : null}</> : "Routing…"}
      </p>
    </div>
  );
}
