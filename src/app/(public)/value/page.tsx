import Link from "next/link";
import type { Metadata } from "next";
import { ZOOM_SCHEDULER_URL } from "@/lib/constants";
import { ValueEstimator } from "@/components/public/value-estimator";

export const metadata: Metadata = {
  title: "Value Estimator",
  description:
    "Estimate a Kaivaryn opportunity range from your inputs. Labeled as an estimate — not realized recovery or savings.",
};

export default function ValuePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <div className="public-grid pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="public-kicker text-amber-400">Honest value framing</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-6xl">
            Estimate the opportunity. Do not confuse it with cash.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">
            Enter rough inputs for revenue leakage and operational friction. Kaivaryn returns a labeled
            estimate range — not a customer case study, not a guaranteed recovery, and not realized savings.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className="public-button-primary">
              Book a working session <span aria-hidden>↗</span>
            </Link>
            <a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="public-button-secondary">
              Schedule on Zoom
            </a>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <ValueEstimator />
        <div className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-sm leading-6 text-neutral-400">
          <p className="font-medium text-neutral-200">How to read this</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Outputs are <strong className="text-neutral-300">estimates</strong> derived only from the numbers you type.</li>
            <li>Conservative / base / upside ranges reflect assumption bands — not peer benchmarks we invent.</li>
            <li>Verified recovery and realized savings only appear inside a tenant workspace after recorded outcomes.</li>
            <li>We do not display fabricated “average customer ROI” or competitor logos.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
