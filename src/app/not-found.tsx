import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-6 text-center">
      <Link href="/" className="flex items-center gap-3" aria-label="Kaivaryn home">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 font-mono text-xs font-bold text-amber-400">K</span>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white">Kaivaryn</span>
      </Link>
      <p className="mt-12 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">This page isn&apos;t here.</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-neutral-400">
        The link may be out of date or mistyped. Everything else is where you left it.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400">Back to home</Link>
        <Link href="/demo" className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 transition hover:border-amber-500/50">Book a demo</Link>
        <Link href="/login" className="px-2 py-2 text-sm text-neutral-400 transition hover:text-white">Client login</Link>
      </div>
    </main>
  );
}
