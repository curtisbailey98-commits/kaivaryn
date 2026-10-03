import type { Metadata } from "next";
import { DemoForm } from "./demo-form";
import { getPricingConfig, resolveZoomSchedulerUrl } from "@/lib/pricing";
import { AmbientField, BreathGrid, Reveal } from "@/components/motion";

export const metadata: Metadata = {
  title: "Book a Demo",
  description:
    "Book an executive working session with Kaivaryn. Bring one hard revenue or operations question and see it worked through on a live platform.",
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
            <p className="public-kicker text-amber-400">Start with the question that matters</p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-5xl">
              Book a working session.
            </h1>
            <div className="mt-5 h-px w-16 bg-gradient-to-r from-amber-400 to-transparent" />
            <p className="mt-5 max-w-md text-base leading-7 text-neutral-400">
              Pick a time for a live executive session on Zoom, or leave your details and a Kaivaryn
              operator will follow up. We host the meeting.
            </p>
            <div className="mt-8 space-y-3 text-sm text-neutral-400">
              <p><span className="mr-2 text-amber-400">01</span>Pick a time on Zoom — the fastest path to a live session.</p>
              <p><span className="mr-2 text-amber-400">02</span>Or share a little context and we will call you back.</p>
              <p><span className="mr-2 text-amber-400">03</span>See where money and time are being lost, what it is worth, who owns the fix, and how the result is verified.</p>
            </div>
            <p className="mt-6 max-w-md text-xs leading-5 text-neutral-500">
              Sessions are led by Kaivaryn operators, not a sales script. Bring one hard question; leave with a
              clear view of how to test it in your own workspace.
            </p>
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
