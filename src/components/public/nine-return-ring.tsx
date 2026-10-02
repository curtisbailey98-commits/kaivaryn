"use client";

import { useEffect, useState } from "react";
import { NINE_RETURNS } from "@/lib/public-story";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";

/** Animated diagram of the nine-return cycle (diagram only — no data). */
export function NineReturnRing() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setActive((v) => (v + 1) % (NINE_RETURNS.length + 1)), 1100);
    return () => clearInterval(t);
  }, [reduced]);
  const size = 320;
  const r = 128;
  const c = size / 2;
  const zero = active === NINE_RETURNS.length;
  const current = NINE_RETURNS[Math.min(active, NINE_RETURNS.length - 1)]!;
  return (
    <div className="mx-auto w-full max-w-[360px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full" role="img" aria-label="Nine-return cycle diagram: Reality, Memory, Prediction, Counterfactual, Critic, Self, Calibration, Meta, Witness, then ZERO_RETURN">
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={2} />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={2.5}
          strokeDasharray={2 * Math.PI * r}
          strokeDashoffset={2 * Math.PI * r * (1 - Math.min(active + 1, 9) / 9)}
          transform={`rotate(-90 ${c} ${c})`}
          style={{ transition: "stroke-dashoffset 900ms ease" }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>
        </defs>
        {NINE_RETURNS.map((s, i) => {
          const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
          const x = c + r * Math.cos(a);
          const y = c + r * Math.sin(a);
          const on = reduced || i <= active;
          return (
            <g key={s.code}>
              <circle cx={x} cy={y} r={i === active && !zero ? 17 : 14} fill={on ? "rgba(245,158,11,0.18)" : "rgba(23,23,23,1)"} stroke={on ? "#f59e0b" : "rgba(255,255,255,0.15)"} strokeWidth={1.5} style={{ transition: "all 400ms ease" }} />
              <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontFamily="ui-monospace, monospace" fill={on ? "#fde68a" : "#737373"}>{s.code}</text>
            </g>
          );
        })}
        <text x={c} y={c - 8} textAnchor="middle" fontSize="11" letterSpacing="2" fill="#a3a3a3">{zero ? "CYCLE CLOSED" : current.stage}</text>
        <text x={c} y={c + 16} textAnchor="middle" fontSize="18" fontWeight="600" fill={zero ? "#34d399" : "#ffffff"}>{zero ? "ZERO_RETURN" : current.name}</text>
      </svg>
      <p className="mt-2 text-center text-[10px] uppercase tracking-[0.18em] text-neutral-600">Diagram · stage order as implemented</p>
    </div>
  );
}
