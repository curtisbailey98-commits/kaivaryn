import type { Metadata } from "next";

export const metadata: Metadata = { title: "Intelligence" };

export default function IntelligencePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold text-white">Executive intelligence</h1>
      <p className="mt-4 leading-relaxed text-neutral-400">
        Kaivaryn intelligence is positioned as disciplined analysis over your organization&apos;s
        recorded signals — opportunities, inefficiencies, integration health — not as an autonomous
        agent that invents outcomes.
      </p>
      <div className="mt-8 space-y-4 rounded-lg border border-neutral-800 bg-neutral-950 p-6 text-sm text-neutral-300">
        <p>
          <span className="font-mono text-amber-400">FINDING</span> — returned when enough structured
          evidence exists; includes summary, confidence, evidence list, and recommendations.
        </p>
        <p>
          <span className="font-mono text-amber-400">INSUFFICIENT_DATA</span> — returned when signals
          are missing. Lists required inputs. Never fabricates evidence or metrics.
        </p>
      </div>
      <p className="mt-6 text-sm text-neutral-500">
        No fake capability claims. Demo environments are labeled DEMO.
      </p>
    </div>
  );
}
