"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface in the browser console for support; no details are shown on screen.
    console.warn("Kaivaryn page error", error.digest ?? "");
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center bg-neutral-950 px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">Something went wrong</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">We couldn&apos;t load this view.</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-neutral-400">
        Nothing was changed. Try again — if it keeps happening, let us know and include the reference below.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-[11px] text-neutral-600">Ref {error.digest}</p> : null}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button onClick={reset} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400">Try again</button>
        <Link href="/" className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 transition hover:border-amber-500/50">Home</Link>
      </div>
    </main>
  );
}
