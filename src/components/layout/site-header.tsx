import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

const links = [
  { href: "/solutions/revenue-recovery", label: "Revenue Recovery" },
  { href: "/solutions/operations-efficiency", label: "Operations Efficiency" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-neutral-950/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-3" aria-label="Kaivaryn home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 font-mono text-xs font-bold text-amber-400 transition group-hover:bg-amber-500/20">K</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white">{APP_NAME}</span>
        </Link>
        <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary navigation">
          {links.map((l) => <Link key={l.href} href={l.href} className="text-[11px] font-medium text-neutral-400 transition hover:text-white">{l.label}</Link>)}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-xs text-neutral-400 transition hover:text-white sm:inline">Client login</Link>
          <Link href="/demo" className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-amber-400 active:scale-[.98]">Book a Demo <span aria-hidden>↗</span></Link>
        </div>
      </div>
      <nav className="border-t border-white/[0.05] lg:hidden" aria-label="Mobile navigation">
        <div className="mx-auto flex max-w-6xl gap-5 overflow-x-auto px-4 py-2.5 text-[11px] whitespace-nowrap sm:px-6">
          {links.map((l) => <Link key={l.href} href={l.href} className="text-neutral-500 transition hover:text-white">{l.label}</Link>)}
        </div>
      </nav>
    </header>
  );
}
