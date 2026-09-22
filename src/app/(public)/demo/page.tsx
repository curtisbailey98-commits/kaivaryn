import type { Metadata } from "next";
import { DemoForm } from "./demo-form";

export const metadata: Metadata = { title: "Book a Demo" };

export default function DemoPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="public-grid pointer-events-none absolute inset-0 opacity-25" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
        <div>
          <p className="public-kicker text-amber-400">Start with the question that matters</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">Book a working session.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-neutral-400">Tell us where value is leaking or friction is compounding. A Kaivaryn operator will follow up with a grounded next step—not an automated sales sequence.</p>
          <div className="mt-8 space-y-3 text-sm text-neutral-400"><p><span className="mr-2 text-amber-400">01</span>Choose Revenue Recovery, Operations Efficiency, or both.</p><p><span className="mr-2 text-amber-400">02</span>Share the business context behind the signal.</p><p><span className="mr-2 text-amber-400">03</span>Leave with a sharper question and a path to test it.</p></div>
        </div>
        <div className="public-card p-5 sm:p-8"><DemoForm /></div>
      </div>
    </div>
  );
}
