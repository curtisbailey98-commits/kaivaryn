"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, type LucideIcon } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export type NavGroup = { label: string; items: Array<{ href: string; label: string; icon: LucideIcon }> };

export function MobileNav({ groups, adminHref }: { groups: NavGroup[]; adminHref?: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-neutral-900 px-4 py-3 md:hidden">
        <Link href="/app" className="text-xs font-semibold uppercase tracking-widest text-amber-400">
          {APP_NAME}
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-800 text-neutral-300"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-neutral-900 bg-neutral-950 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">{APP_NAME}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="mt-5 space-y-5">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">{group.label}</p>
                  <div className="mt-1 space-y-0.5">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-neutral-300 hover:bg-neutral-900 hover:text-white"
                      >
                        <item.icon className="h-4 w-4 text-neutral-500" strokeWidth={2} />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {adminHref ? (
                <Link href={adminHref} onClick={() => setOpen(false)} className="block rounded-md px-2.5 py-2 text-sm font-medium text-amber-400/90 hover:bg-neutral-900">
                  Admin console
                </Link>
              ) : null}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
