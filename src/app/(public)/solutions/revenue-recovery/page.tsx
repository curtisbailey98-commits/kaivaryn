import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Revenue Recovery" };

export default function RevenueRecoveryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-500">Solution</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">Revenue Recovery</h1>
      <p className="mt-4 text-neutral-400 leading-relaxed">
        Kaivaryn Revenue Recovery helps finance and revenue-cycle teams find leakage — underbilling,
        underpayment, missed change orders, fee policy gaps — then track work to recovery.
        Estimated pipeline and recovered amounts are always reported separately.
      </p>
      <ul className="mt-8 space-y-3 text-sm text-neutral-300">
        <li className="border-l-2 border-amber-500/60 pl-4">Opportunity command center with priority views</li>
        <li className="border-l-2 border-amber-500/60 pl-4">Assignment, notes, and status workflow</li>
        <li className="border-l-2 border-amber-500/60 pl-4">Analytics from your org data — empty states when data is absent</li>
        <li className="border-l-2 border-amber-500/60 pl-4">Tenant-isolated; demo data labeled DEMO</li>
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
