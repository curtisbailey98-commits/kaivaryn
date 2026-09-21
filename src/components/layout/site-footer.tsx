import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-900 bg-neutral-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">{APP_NAME}</p>
          <p className="mt-3 text-sm text-neutral-500">
            Enterprise AI consulting. Recover revenue. Eliminate operational waste.
          </p>
        </div>
        <div className="text-sm text-neutral-400">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Platform</p>
          <ul className="space-y-1.5">
            <li><Link href="/solutions/revenue-recovery" className="hover:text-white">Revenue Recovery</Link></li>
            <li><Link href="/solutions/operations-efficiency" className="hover:text-white">Operations Efficiency</Link></li>
            <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
            <li><Link href="/demo" className="hover:text-white">Book a Demo</Link></li>
          </ul>
        </div>
        <div className="text-sm text-neutral-400">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Company</p>
          <ul className="space-y-1.5">
            <li><Link href="/company" className="hover:text-white">About</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            <li><Link href="/login" className="hover:text-white">Client login</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-neutral-900 py-4 text-center text-xs text-neutral-600">
        © {new Date().getFullYear()} Kaivaryn LLC. All rights reserved.
      </div>
    </footer>
  );
}
