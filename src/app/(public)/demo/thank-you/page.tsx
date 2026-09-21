import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Thank you" };

export default function ThankYouPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-2xl font-semibold text-white">Request received</h1>
      <p className="mt-3 text-neutral-400">
        Thank you. Your demo request has been saved. We will contact you at the email you provided.
      </p>
      <Link href="/" className="mt-8 inline-block text-sm text-amber-400 hover:text-amber-300">
        ← Back to home
      </Link>
    </div>
  );
}
