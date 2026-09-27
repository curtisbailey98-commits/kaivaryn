import Link from "next/link";
import { ReactNode } from "react";
import {
  LayoutDashboard,
  Factory,
  Shield,
  ArrowLeftRight,
  Bot,
  ClipboardList,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { PageEnter } from "@/components/motion";
import { switchExecutiveDashboard } from "@/app/executive/actions";
import type { ExecutiveContext } from "@/lib/executive/access";

export function ExecShell({
  children,
  exec,
}: {
  children: ReactNode;
  exec: ExecutiveContext;
}) {
  const dash = exec.activeDashboard;
  const links =
    dash === "CSEO"
      ? [
          { href: "/executive/cseo", label: "Security Command", icon: Shield },
          { href: "/executive/chief", label: "CHIEF Foundry", icon: Factory },
          { href: "/executive/chief/intake", label: "Security Intake", icon: ClipboardList },
          { href: "/executive/ceo", label: "CEO overview", icon: LayoutDashboard },
        ]
      : [
          { href: "/executive/ceo", label: "CEO Command", icon: LayoutDashboard },
          { href: "/executive/chief", label: "CHIEF Foundry", icon: Factory },
          { href: "/executive/chief/intake", label: "CSEO Intake", icon: ClipboardList },
          { href: "/executive/cseo", label: "CSEO Security", icon: Shield },
        ];

  return (
    <div className="app-surface min-h-screen text-neutral-100">
      <header className="sticky top-0 z-40 border-b border-neutral-900/90 bg-neutral-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/executive" className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/10 font-mono text-[10px] font-bold">K</span>
              {APP_NAME} Executive
            </Link>
            <Badge tone={dash === "CEO" ? "warning" : "info"}>{dash} Command</Badge>
            <Badge tone="default">{exec.platformRole}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {exec.canSwitch ? (
              <form action={switchExecutiveDashboard} className="flex items-center gap-1">
                <input type="hidden" name="dashboard" value={dash === "CEO" ? "CSEO" : "CEO"} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900/80 px-2.5 py-1.5 text-[11px] font-medium text-neutral-200 transition hover:border-amber-500/40 hover:text-amber-300"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  Switch to {dash === "CEO" ? "CSEO" : "CEO"}
                </button>
              </form>
            ) : null}
            <Link href="/admin" className="text-neutral-500 hover:text-amber-400">Admin</Link>
            <Link href="/app" className="text-neutral-500 hover:text-amber-400">Tenant app</Link>
            <span className="hidden text-neutral-600 sm:inline">{exec.user.email}</span>
            <SignOutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-neutral-400 transition hover:bg-neutral-900 hover:text-amber-300"
            >
              <l.icon className="h-3.5 w-3.5" />
              {l.label}
            </Link>
          ))}
          <span className="ml-auto inline-flex items-center gap-1 px-2 text-[10px] uppercase tracking-wider text-neutral-600">
            <Bot className="h-3 w-3" /> Internal only
          </span>
        </nav>
      </header>
      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <PageEnter>{children}</PageEnter>
      </main>
    </div>
  );
}
