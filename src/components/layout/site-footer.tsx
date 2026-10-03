import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-neutral-950">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div><Link href="/" className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">{APP_NAME}</Link><p className="mt-4 max-w-xs text-sm leading-6 text-neutral-500">Executive AI consulting with proprietary software. We find the money, remove the friction, and measure the result.</p></div>
          <div className="text-sm text-neutral-400"><p className="public-kicker mb-4">Explore</p><ul className="space-y-3"><li><Link href="/solutions/revenue-recovery" className="transition hover:text-white">Revenue Recovery</Link></li><li><Link href="/solutions/operations-efficiency" className="transition hover:text-white">Operations Efficiency</Link></li><li><Link href="/platform" className="transition hover:text-white">Platform</Link></li><li><Link href="/how-it-works" className="transition hover:text-white">How it works</Link></li><li><Link href="/intelligence" className="transition hover:text-white">Intelligence</Link></li><li><Link href="/value" className="transition hover:text-white">Value estimator</Link></li></ul></div>
          <div className="text-sm text-neutral-400"><p className="public-kicker mb-4">Company</p><ul className="space-y-3"><li><Link href="/pricing" className="transition hover:text-white">Pricing</Link></li><li><Link href="/company" className="transition hover:text-white">About Kaivaryn</Link></li><li><Link href="/contact" className="transition hover:text-white">Contact</Link></li><li><Link href="/login" className="transition hover:text-white">Client login</Link></li></ul></div>
        </div>
      </div>
      <div className="border-t border-white/[0.06] py-4 text-center text-[11px] text-neutral-600">© {new Date().getFullYear()} Kaivaryn LLC. All rights reserved.</div>
    </footer>
  );
}
