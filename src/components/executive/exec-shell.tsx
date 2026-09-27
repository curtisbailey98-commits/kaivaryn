import Link from "next/link";
import { ReactNode } from "react";
import { Bot } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { PageEnter } from "@/components/motion";
import type { ExecutiveContext } from "@/lib/executive/access";
import {
  ExecActiveBadge,
  ExecDashboardSwitcher,
  ExecMobileNav,
  ExecSidebar,
  ExecTopLinks,
} from "@/components/executive/exec-nav";

export function ExecShell({
  children,
  exec,
}: {
  children: ReactNode;
  exec: ExecutiveContext;
}) {
  const dash = exec.activeDashboard;

  return (
    <div className="app-surface min-h-screen text-neutral-100">
      <header className="sticky top-0 z-40 border-b border-neutral-900/90 bg-neutral-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/executive"
              className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/10 font-mono text-[10px] font-bold">
                K
              </span>
              {APP_NAME} Executive
            </Link>
            <ExecActiveBadge fallback={dash} />
            <Badge tone="default">{exec.platformRole}</Badge>
            <ExecDashboardSwitcher activeDashboard={dash} canSwitch={exec.canSwitch} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/executive/chief"
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-500/25"
            >
              <Bot className="h-3.5 w-3.5" />
              CHIEF Agent Foundry
            </Link>
            <Link href="/admin" className="text-neutral-500 hover:text-amber-400">
              Admin
            </Link>
            <Link href="/app" className="text-neutral-500 hover:text-amber-400">
              Tenant app
            </Link>
            <span className="hidden text-neutral-600 sm:inline">{exec.user.email}</span>
            <SignOutButton />
          </div>
        </div>
        <div className="mx-auto hidden max-w-[90rem] px-4 pb-2 sm:px-6 md:block">
          <ExecTopLinks />
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-4rem)]">
        <ExecSidebar />
        <div className="relative min-w-0 flex-1">
          <ExecMobileNav />
          <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">
            <PageEnter>{children}</PageEnter>
          </main>
        </div>
      </div>
    </div>
  );
}
