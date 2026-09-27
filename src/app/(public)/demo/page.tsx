import type { Metadata } from "next";
import { DemoForm } from "./demo-form";
import { getPricingConfig, resolveZoomSchedulerUrl } from "@/lib/pricing";

export const metadata: Metadata = { title: "Book a Demo" };
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const config = await getPricingConfig();
  const zoomUrl = resolveZoomSchedulerUrl(config.zoomMeetingUrl);

  return (
    <div className="relative overflow-hidden">
      <div className="public-grid pointer-events-none absolute inset-0 opacity-25" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
        <div>
          <p className="public-kicker text-amber-400">Start with the question that matters</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">
            Book a working session.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-neutral-400">
            Schedule a live executive walkthrough on Zoom, or leave your details for a Kaivaryn
            operator follow-up. We host the meeting — no prospect Zoom link required.
          </p>
          <div className="mt-8 space-y-3 text-sm text-neutral-400">
            <p>
              <span className="mr-2 text-amber-400">01</span>
              Schedule on Zoom for the fastest path to a live session.
            </p>
            <p>
              <span className="mr-2 text-amber-400">02</span>
              Or share business context for a grounded operator callback.
            </p>
            <p>
              <span className="mr-2 text-amber-400">03</span>
              Leave with a sharper question and a path to test it.
            </p>
          </div>
          <a
            href={zoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex h-11 items-center justify-center rounded-md border border-amber-500/50 px-5 text-sm font-semibold text-amber-400 hover:bg-amber-500/10"
          >
            Schedule executive demo on Zoom
          </a>
        </div>
        <div className="public-card p-5 sm:p-8">
          <DemoForm zoomUrl={zoomUrl} />
        </div>
      </div>
    </div>
  );
}
