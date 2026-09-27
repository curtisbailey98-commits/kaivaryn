"use client";

import { useMemo, useState } from "react";

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));
}

export function ValueEstimator() {
  const [annualRevenue, setAnnualRevenue] = useState(50_000_000);
  const [leakagePct, setLeakagePct] = useState(1.5);
  const [recoverablePct, setRecoverablePct] = useState(40);
  const [fteCount, setFteCount] = useState(25);
  const [loadedCost, setLoadedCost] = useState(120_000);
  const [wastePct, setWastePct] = useState(12);
  const [addressablePct, setAddressablePct] = useState(35);

  const result = useMemo(() => {
    const rrGross = annualRevenue * (leakagePct / 100);
    const rrBase = rrGross * (recoverablePct / 100);
    const oeGross = fteCount * loadedCost * (wastePct / 100);
    const oeBase = oeGross * (addressablePct / 100);
    const totalBase = rrBase + oeBase;
    return {
      rr: {
        low: rrBase * 0.6,
        base: rrBase,
        high: rrBase * 1.35,
        gross: rrGross,
      },
      oe: {
        low: oeBase * 0.55,
        base: oeBase,
        high: oeBase * 1.4,
        gross: oeGross,
      },
      total: {
        low: totalBase * 0.6,
        base: totalBase,
        high: totalBase * 1.35,
      },
    };
  }, [annualRevenue, leakagePct, recoverablePct, fteCount, loadedCost, wastePct, addressablePct]);

  const field = (
    label: string,
    value: number,
    onChange: (n: number) => void,
    opts?: { step?: number; min?: number; max?: number; prefix?: string; suffix?: string }
  ) => (
    <label className="block text-sm">
      <span className="text-xs text-neutral-500">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        {opts?.prefix ? <span className="text-neutral-600">{opts.prefix}</span> : null}
        <input
          type="number"
          value={value}
          min={opts?.min ?? 0}
          max={opts?.max}
          step={opts?.step ?? 1}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-neutral-100"
        />
        {opts?.suffix ? <span className="text-neutral-600">{opts.suffix}</span> : null}
      </div>
    </label>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
      <div className="public-card space-y-6 p-6 sm:p-8">
        <div>
          <p className="public-kicker text-amber-400">Revenue Recovery inputs</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {field("Annual revenue in scope", annualRevenue, setAnnualRevenue, { step: 100000, prefix: "$" })}
            {field("Suspected leakage rate", leakagePct, setLeakagePct, { step: 0.1, max: 30, suffix: "%" })}
            {field("Likely recoverable share", recoverablePct, setRecoverablePct, { step: 1, max: 100, suffix: "%" })}
          </div>
        </div>
        <div>
          <p className="public-kicker text-emerald-400">Operations Efficiency inputs</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {field("FTEs in target processes", fteCount, setFteCount, { step: 1 })}
            {field("Loaded cost per FTE / yr", loadedCost, setLoadedCost, { step: 1000, prefix: "$" })}
            {field("Estimated waste / rework", wastePct, setWastePct, { step: 0.5, max: 80, suffix: "%" })}
            {field("Addressable in 12 months", addressablePct, setAddressablePct, { step: 1, max: 100, suffix: "%" })}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-6 sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400">Estimate only · not realized</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Annual opportunity range</h2>
        <p className="mt-4 text-4xl font-semibold tracking-tight text-white">
          {money(result.total.low)} – {money(result.total.high)}
        </p>
        <p className="mt-2 text-sm text-neutral-400">
          Base case {money(result.total.base)} · derived only from your inputs
        </p>

        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-white/[0.08] bg-neutral-950/60 p-4">
            <p className="text-xs uppercase tracking-wider text-neutral-500">Revenue Recovery</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {money(result.rr.low)} – {money(result.rr.high)}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Gross leakage modeled {money(result.rr.gross)} · recoverable share applied
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-neutral-950/60 p-4">
            <p className="text-xs uppercase tracking-wider text-neutral-500">Operations Efficiency</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {money(result.oe.low)} – {money(result.oe.high)}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Gross waste modeled {money(result.oe.gross)} · addressable share applied
            </p>
          </div>
        </div>

        <p className="mt-6 text-xs leading-5 text-neutral-500">
          This calculator does not use Kaivaryn tenant data and does not invent peer averages. A working session
          validates which signals exist before any recovery or savings is treated as verified.
        </p>
      </div>
    </div>
  );
}
