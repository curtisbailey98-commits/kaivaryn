import Link from "next/link";
import type { Metadata } from "next";
import { getPricingConfig, resolveZoomSchedulerUrl } from "@/lib/pricing";
import { ExampleThankYouChart } from "@/components/charts/example-public-charts";

export const metadata: Metadata = { title: "Thank you" };
export const dynamic = "force-dynamic";

export default async function ThankYouPage() {
  const config = await getPricingConfig();
  const zoomUrl = resolveZoomSchedulerUrl(config.zoomMeetingUrl);

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-2xl font-semibold text-white">Request received</h1>
      <p className="mt-3 text-neutral-400">
        Thank you. Your demo request has been saved. We will contact you at the email you provided.
      </p>
      <div className="mt-8 space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-500">
          Next step
        </p>
        <p className="text-sm text-neutral-300">
          Prefer not to wait? Schedule the executive demo on Kaivaryn&apos;s Zoom calendar now.
        </p>
        <a
          href={zoomUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-md bg-amber-500 px-5 text-sm font-semibold text-neutral-950 hover:bg-amber-400"
        >
          Schedule executive demo on Zoom
        </a>
      </div>
      <div className="mx-auto mt-10 max-w-lg text-left">
        <ExampleThankYouChart />
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm">
        <Link href="/pricing" className="text-neutral-400 hover:text-neutral-200">
          View pricing
        </Link>
        <Link href="/" className="text-amber-400 hover:text-amber-300">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
