import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold text-white">Contact</h1>
      <p className="mt-4 text-neutral-400">
        For engagements and demos, use the demo request form. For existing clients, sign in to the platform.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/demo" className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950">
          Book a Demo
        </Link>
        <Link href="/login" className="rounded-md border border-neutral-700 px-4 py-2 text-sm">
          Client login
        </Link>
      </div>
      <p className="mt-8 text-sm text-neutral-500">Email: contact@kaivaryn.com</p>
    </div>
  );
}
