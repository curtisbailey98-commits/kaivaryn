import type { Metadata } from "next";

export const metadata: Metadata = { title: "How it works" };

const steps = [
  { name: "Connect", detail: "Link available data sources or begin with manual / CSV entry. Integrations show honest statuses." },
  { name: "Analyze", detail: "Run structured analysis. If signals are missing, the intelligence service returns INSUFFICIENT_DATA." },
  { name: "Identify", detail: "Surface opportunities and inefficiencies with source, department, and type metadata." },
  { name: "Prioritize", detail: "Critical / High Value views and filters — work the queue that matters." },
  { name: "Execute", detail: "Assign owners, capture notes, advance status. Automation stays approval-gated." },
  { name: "Measure", detail: "Separate estimated vs recovered. Audit trail on sensitive actions." },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold text-white">How it works</h1>
      <p className="mt-3 text-neutral-400">A six-stage operating loop — not a black box.</p>
      <ol className="mt-10 space-y-6">
        {steps.map((s, i) => (
          <li key={s.name} className="flex gap-4">
            <span className="font-mono text-sm text-amber-500">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h2 className="text-lg font-semibold text-white">{s.name}</h2>
              <p className="mt-1 text-sm text-neutral-400">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
