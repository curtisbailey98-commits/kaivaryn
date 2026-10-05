import type { Metadata } from "next";
import { DemoForm } from "./demo-form";
import { getPricingConfig, resolveZoomSchedulerUrl } from "@/lib/pricing";
import { AmbientField, BreathGrid, Reveal } from "@/components/motion";

export const metadata: Metadata = {
  title: "Book a Demo",
  description:
    "Book a live Kaivaryn demo on Zoom. Bring the problem that costs you the most; see the workspace on example data and run the numbers on yours. No payment link unless you decide it fits.",
};
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const config = await getPricingConfig();
  const zoomUrl = resolveZoomSchedulerUrl(config.zoomMeetingUrl);

  return (
    <div className="relative overflow-hidden">
      <AmbientField intensity="hero" />
      <BreathGrid opacity={0.22} />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
        <Reveal>
          <div>
            <p className="public-kicker text-amber-400">Live on Zoom · Low pressure</p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-5xl">
              Book a demo.
            </h1>
            <div className="mt-5 h-px w-16 bg-gradient-to-r from-amber-400 to-transparent" />
            <p className="mt-5 max-w-md text-base leading-7 text-neutral-400">
              Pick a time on Zoom, or leave your details and we&apos;ll call you back. No preparation
              needed. Bring the problem that costs you the most.
            </p>
            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">What happens on the call</p>
            <div className="mt-3 space-y-3 text-sm text-neutral-400">
              <p><span className="mr-2 text-amber-400">01</span>We talk through where you suspect money or time is leaking.</p>
              <p><span className="mr-2 text-amber-400">02</span>You see the Kaivaryn workspace on example data, clearly labeled, so you can judge it for yourself.</p>
              <p><span className="mr-2 text-amber-400">03</span>We run the estimate on your numbers and show the formula behind it.</p>
              <p><span className="mr-2 text-amber-400">04</span>You leave with a clear yes, no, or not yet. If it&apos;s a fit, we outline your first 30 days.</p>
            </div>
            <ul className="mt-6 max-w-md space-y-1.5 text-xs leading-5 text-neutral-500">
              <li>✓ No payment link unless you decide it fits after the demo</li>
              <li>✓ No access to your systems is needed for the demo</li>
              <li>✓ Terms are agreed in writing before any payment</li>
            </ul>
          </div>
        </Reveal>
        <Reveal variant="scale" delay={100}>
          <div className="public-card p-5 sm:p-8">
            <DemoForm zoomUrl={zoomUrl} />
          </div>
        </Reveal>
      </div>
    </div>
  );
}
