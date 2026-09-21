import type { Metadata } from "next";
import { DemoForm } from "./demo-form";

export const metadata: Metadata = { title: "Book a Demo" };

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold text-white">Book a Demo</h1>
      <p className="mt-3 text-neutral-400">
        Tell us about your organization. A Kaivaryn operator will follow up — no automated spam.
      </p>
      <DemoForm />
    </div>
  );
}
