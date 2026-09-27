"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Factory,
  Shield,
  ClipboardList,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { switchExecutiveDashboard } from "@/app/executive/actions";
import type { ExecutiveDashboard } from "@/lib/enums";

type NavItem = { href: string; label: string; icon: LucideIcon; match?: "exact" | "prefix" };

const SIDEBAR_LINKS: NavItem[] = [
  { href: "/executive/ceo", label: "CEO Command", icon: LayoutDashboard, match: "prefix" },
  { href: "/executive/chief", label: "CHIEF Agent Foundry", icon: Factory, match: "exact" },
  { href: "/executive/chief/intake", label: "Security Intake", icon: ClipboardList, match: "prefix" },
  { href: "/executive/cseo", label: "CSEO Security", icon: Shield, match: "prefix" },
];


export function ExecActiveBadge({ fallback }: { fallback: ExecutiveDashboard }) {
  const pathname = usePathname();
  const current: ExecutiveDashboard =
    pathname.startsWith("/executive/chief")
      ? "CHIEF"
      : pathname.startsWith("/executive/cseo")
        ? "CSEO"
        : pathname.startsWith("/executive/ceo")
          ? "CEO"
          : fallback;
  const tone =
    current === "CEO" ? "bg-amber-950 text-amber-300 border-amber-800" :
    current === "CHIEF" ? "bg-emerald-950 text-emerald-300 border-emerald-800" :
    "bg-sky-950 text-sky-300 border-sky-800";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
      {current} Command
    </span>
  );
}

const SWITCHER: { id: ExecutiveDashboard; label: string; href: string }[] = [
  { id: "CEO", label: "CEO", href: "/executive/ceo" },
  { id: "CHIEF", label: "CHIEF", href: "/executive/chief" },
  { id: "CSEO", label: "CSEO", href: "/executive/cseo" },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/executive/chief") {
    return pathname === "/executive/chief" || pathname.startsWith("/executive/chief?");
  }
  if (item.href === "/executive/chief/intake") {
    return pathname.startsWith("/executive/chief/intake");
  }
  if (item.href === "/executive/cseo") {
    return pathname === "/executive/cseo" || pathname.startsWith("/executive/cseo/");
  }
  if (item.href === "/executive/ceo") {
    return pathname === "/executive/ceo" || pathname.startsWith("/executive/ceo/");
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLinks({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn("space-y-0.5", className)}>
      {SIDEBAR_LINKS.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm font-medium transition",
              active
                ? "bg-amber-500/15 text-amber-200 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.35)]"
                : "text-neutral-400 hover:bg-neutral-900 hover:text-white",
              item.href === "/executive/chief" && !active
                ? "border border-amber-500/25 bg-amber-500/[0.06] text-amber-300/90"
                : null,
            )}
          >
            <item.icon
              className={cn(
                "h-4 w-4 shrink-0",
                active || item.href === "/executive/chief" ? "text-amber-400" : "text-neutral-500",
              )}
              strokeWidth={2}
            />
            <span className="leading-tight">{item.label}</span>
            {item.href === "/executive/chief" ? (
              <span className="ml-auto rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                Foundry
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function ExecDashboardSwitcher({
  activeDashboard,
  canSwitch,
}: {
  activeDashboard: ExecutiveDashboard;
  canSwitch: boolean;
}) {
  const pathname = usePathname();
  const current: ExecutiveDashboard =
    pathname.startsWith("/executive/chief")
      ? "CHIEF"
      : pathname.startsWith("/executive/cseo")
        ? "CSEO"
        : pathname.startsWith("/executive/ceo")
          ? "CEO"
          : activeDashboard;

  if (!canSwitch) {
    return (
      <span className="rounded-md border border-neutral-800 px-2 py-1 text-[11px] text-neutral-400">
        {current}
      </span>
    );
  }

  return (
    <div className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-900/80 p-0.5">
      {SWITCHER.map((opt) => {
        const selected = current === opt.id;
        return (
          <form key={opt.id} action={switchExecutiveDashboard}>
            <input type="hidden" name="dashboard" value={opt.id} />
            <button
              type="submit"
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition",
                selected
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-neutral-400 hover:text-amber-200",
              )}
              aria-current={selected ? "page" : undefined}
            >
              {opt.label}
            </button>
          </form>
        );
      })}
    </div>
  );
}

export function ExecSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-neutral-900/90 bg-neutral-950/90 md:flex md:flex-col">
      <div className="border-b border-neutral-900/90 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Command surfaces</p>
        <p className="mt-1 text-xs text-neutral-400">CEO · CHIEF · CSEO</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavLinks />
      </div>
    </aside>
  );
}

export function ExecMobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-neutral-900 px-4 py-3 md:hidden">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">Executive</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open executive navigation"
          className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-800 text-neutral-300"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-neutral-900 bg-neutral-950 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">Navigate</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ExecTopLinks() {
  const pathname = usePathname();
  return (
    <nav className="hidden gap-1 overflow-x-auto md:flex">
      {SIDEBAR_LINKS.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
              active
                ? "bg-amber-500/15 text-amber-200"
                : item.href === "/executive/chief"
                  ? "border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-amber-300",
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
