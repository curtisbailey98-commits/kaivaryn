import type { Metadata } from "next";
import { DemoForm } from "./demo-form";
import { getPricingConfig, resolveZoomSchedulerUrl } from "@/lib/pricing";
import { AmbientField, BreathGrid, Reveal, Magnetic } from "@/components/motion";

export const metadata: Metadata = { title: "Book a Demo" };
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
              Schedule a live executive walkthrough on Zoom, or leave your details for a Kaivaryn
              operator follow-up. We host the meeting — no prospect Zoom link required.
            </p>
            <div className="mt-8 space-y-3 text-sm text-neutral-400">
              <p><span className="mr-2 text-amber-400">01</span>Schedule on Zoom for the fastest path to a live executive session.</p>
              <p><span className="mr-2 text-amber-400">02</span>Or share business context for a grounded operator callback.</p>
              <p><span className="mr-2 text-amber-400">03</span>Walk the operating loop: leakage and friction → ranked queue → governed action → verified results.</p>
            </div>
            <p className="mt-6 max-w-md text-xs leading-5 text-neutral-500">
              Sessions are consulting-led. We do not present fabricated customer logos or invented recovery averages.
              Bring one hard question; leave with a clearer path to test it in the Kaivaryn workspace.
            </p>
            <Magnetic className="mt-8">
              <a
                href={zoomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-md border border-amber-500/50 px-5 text-sm font-semibold text-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.08)] transition hover:bg-amber-500/10 hover:shadow-[0_0_32px_rgba(245,158,11,0.16)]"
              >
                Schedule executive demo on Zoom
              </a>
            </Magnetic>
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
