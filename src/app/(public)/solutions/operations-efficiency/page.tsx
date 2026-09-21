import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Operations Efficiency" };

export default function OperationsEfficiencyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-500">Solution</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">Operations Efficiency</h1>
      <p className="mt-4 text-neutral-400 leading-relaxed">
        Identify process waste, rework, and queue delay. Flag automation candidates for human
        approval — Kaivaryn does not auto-execute external actions against your systems.
      </p>
      <ul className="mt-8 space-y-3 text-sm text-neutral-300">
        <li className="border-l-2 border-amber-500/60 pl-4">Inefficiency command center and analytics</li>
        <li className="border-l-2 border-amber-500/60 pl-4">Annual waste vs recovered efficiency metrics</li>
        <li className="border-l-2 border-amber-500/60 pl-4">Approval-gated automation candidates</li>
      </ul>
      <div className="mt-10 flex gap-3">
        <Link href="/demo" className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950">
          Book a Demo
        </Link>
        <Link href="/pricing" className="rounded-md border border-neutral-700 px-4 py-2 text-sm">
          Pricing
        </Link>
      </div>
    </div>
  );
}
