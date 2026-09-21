import Link from "next/link";
import type { Metadata } from "next";
import { getPricingConfig } from "@/lib/pricing";

export const metadata: Metadata = { title: "Thank you" };
export const dynamic = "force-dynamic";

export default async function ThankYouPage() {
  const config = await getPricingConfig();
  const zoomUrl = config.zoomMeetingUrl?.trim() || null;

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-2xl font-semibold text-white">Request received</h1>
      <p className="mt-3 text-neutral-400">
        Thank you. Your demo request has been saved. We will contact you at the email you provided.
      </p>
      {zoomUrl ? (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-neutral-500">
            Ready for the meeting path? Join or schedule on Zoom:
          </p>
          <a
            href={zoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 px-4 text-sm font-medium text-neutral-100 hover:bg-neutral-800"
          >
            Join / schedule on Zoom
          </a>
        </div>
      ) : null}
      <Link href="/" className="mt-8 inline-block text-sm text-amber-400 hover:text-amber-300">
        ← Back to home
      </Link>
    </div>
  );
}
