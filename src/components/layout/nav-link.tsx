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
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition",
        active
          ? "bg-amber-500/10 text-white"
          : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-amber-400" : "text-neutral-500")} strokeWidth={2} />
      {label}
    </Link>
  );
}
