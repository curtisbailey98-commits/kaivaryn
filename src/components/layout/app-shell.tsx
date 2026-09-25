import Link from "next/link";
import { ReactNode } from "react";
import {
  LayoutDashboard,
  Zap,
  TrendingUp,
  Settings2,
  FileSearch,
  Upload,
  Activity,
  Search,
  Bell,
  Plug,
  ShieldCheck,
  Rocket,
  Brain,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { MobileNav, type NavGroup } from "@/components/layout/mobile-nav";
import { AppNavLink } from "@/components/layout/nav-link";
import { SignOutButton } from "@/components/layout/sign-out-button";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/app", label: "Home", icon: LayoutDashboard },
      { href: "/app/action-center", label: "Action Center", icon: Zap },
    ],
  },
  {
    label: "Products",
    items: [
      { href: "/app/revenue", label: "Revenue Recovery", icon: TrendingUp },
      { href: "/app/operations", label: "Operations Efficiency", icon: Settings2 },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/app/findings", label: "Findings", icon: FileSearch },
      { href: "/app/imports", label: "Imports", icon: Upload },
      { href: "/app/jobs", label: "Jobs", icon: Activity },
      { href: "/app/search", label: "Search", icon: Search },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/app/notifications", label: "Notifications", icon: Bell },
      { href: "/app/approvals", label: "Approvals", icon: ShieldCheck },
      { href: "/app/learning", label: "Learning", icon: Brain },
      { href: "/app/integrations", label: "Integrations", icon: Plug },
      { href: "/app/onboarding", label: "Onboarding", icon: Rocket },
    ],
  },
];

export function AppShell({
  children,
  userEmail,
  orgName,
  isDemo,
  isSuperAdmin,
}: {
  children: ReactNode;
  userEmail?: string | null;
  orgName?: string | null;
  isDemo?: boolean;
  isSuperAdmin?: boolean;
}) {
  const initial = (orgName || userEmail || "K").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r border-neutral-900 bg-neutral-950 md:flex md:flex-col">
          <div className="flex h-14 items-center border-b border-neutral-900 px-4">
            <Link href="/app" className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/10 font-mono text-[10px] font-bold">K</span>
              {APP_NAME}
            </Link>
          </div>
          <nav className="flex-1 space-y-5 overflow-y-auto p-3">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">{group.label}</p>
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => (
                    <AppNavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
                  ))}
                </div>
              </div>
            ))}
            {isSuperAdmin ? (
              <div>
                <p className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Platform</p>
                <Link
                  href="/admin"
                  className="mt-1 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-amber-400/90 hover:bg-neutral-900"
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2} />
                  Admin console
                </Link>
              </div>
            ) : null}
          </nav>
          <div className="border-t border-neutral-900 p-3">
            <div className="flex items-center gap-2.5 rounded-md px-1 py-1">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-semibold text-neutral-300">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-neutral-300">{userEmail}</p>
                {orgName ? (
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-neutral-500">
                    <span className="truncate">{orgName}</span>
                    {isDemo ? <Badge tone="demo">DEMO</Badge> : null}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-1">
              <SignOutButton />
            </div>
          </div>
        </aside>
        <main className="flex-1 overflow-x-hidden">
          <MobileNav groups={NAV_GROUPS} adminHref={isSuperAdmin ? "/admin" : null} />
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
