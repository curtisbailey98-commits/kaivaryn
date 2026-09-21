import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

const links = [
  { href: "/solutions/revenue-recovery", label: "Revenue Recovery" },
  { href: "/solutions/operations-efficiency", label: "Operations" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-semibold tracking-[0.18em] text-amber-400 uppercase text-xs">
          {APP_NAME}
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-xs text-neutral-400 hover:text-neutral-100">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden text-xs text-neutral-400 hover:text-white sm:inline">
            Sign in
          </Link>
          <Link
            href="/demo"
            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-amber-400"
          >
            Book a Demo
          </Link>
        </div>
      </div>
    </header>
  );
}
