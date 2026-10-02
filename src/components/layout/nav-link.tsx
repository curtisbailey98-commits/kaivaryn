"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppNavLink({
  href,
  label,
  icon: Icon,
  onNavigate,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  onNavigate?: () => void;
  badge?: number;
}) {
  const pathname = usePathname();
  const active = href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition duration-200",
        active
          ? "nav-active-pill bg-amber-500/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          : "text-neutral-400 hover:bg-neutral-900/80 hover:text-white"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition duration-200",
          active ? "text-amber-400" : "text-neutral-500 group-hover:text-neutral-300"
        )}
        strokeWidth={2}
      />
      <span className="relative">
        {label}
        {active ? (
          <span className="absolute -bottom-0.5 left-0 h-px w-full bg-gradient-to-r from-amber-400/80 to-transparent" />
        ) : null}
      </span>
      {badge ? (
        <span className="ml-auto rounded-full bg-amber-500/90 px-1.5 py-px text-[10px] font-semibold tabular-nums text-neutral-950">{badge > 99 ? "99+" : badge}</span>
      ) : null}
    </Link>
  );
}
