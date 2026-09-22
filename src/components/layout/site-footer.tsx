import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-neutral-950">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="flex flex-col justify-between gap-8 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-6 sm:flex-row sm:items-center sm:p-8">
          <div><p className="public-kicker text-amber-400">Make the next decision visible</p><p className="mt-2 max-w-xl text-xl font-semibold tracking-tight text-white">Bring one hard business question. Leave with a clearer operating path.</p></div>
          <Link href="/demo" className="public-button-primary shrink-0">Book a working session <span aria-hidden>↗</span></Link>
        </div>
        <div className="mt-14 grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div><Link href="/" className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">{APP_NAME}</Link><p className="mt-4 max-w-xs text-sm leading-6 text-neutral-500">Executive intelligence for revenue recovery, operations efficiency, and the decisions between them.</p></div>
          <div className="text-sm text-neutral-400"><p className="public-kicker mb-4">Explore</p><ul className="space-y-3"><li><Link href="/solutions/revenue-recovery" className="transition hover:text-white">Revenue Recovery</Link></li><li><Link href="/solutions/operations-efficiency" className="transition hover:text-white">Operations Efficiency</Link></li><li><Link href="/how-it-works" className="transition hover:text-white">How it works</Link></li><li><Link href="/intelligence" className="transition hover:text-white">Intelligence</Link></li></ul></div>
          <div className="text-sm text-neutral-400"><p className="public-kicker mb-4">Company</p><ul className="space-y-3"><li><Link href="/pricing" className="transition hover:text-white">Pricing</Link></li><li><Link href="/company" className="transition hover:text-white">About Kaivaryn</Link></li><li><Link href="/contact" className="transition hover:text-white">Contact</Link></li><li><Link href="/login" className="transition hover:text-white">Client login</Link></li></ul></div>
        </div>
      </div>
      <div className="border-t border-white/[0.06] py-4 text-center text-[11px] text-neutral-600">© {new Date().getFullYear()} Kaivaryn LLC. Built for accountable progress.</div>
    </footer>
  );
}
