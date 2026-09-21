import Link from "next/link";
import { ReactNode } from "react";
import { APP_NAME } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

const nav = [
  { href: "/app", label: "Home" },
  { href: "/app/action-center", label: "Action Center" },
  { href: "/app/revenue", label: "Revenue Recovery" },
  { href: "/app/operations", label: "Operations" },
  { href: "/app/integrations", label: "Integrations" },
  { href: "/app/approvals", label: "Approvals" },
  { href: "/app/onboarding", label: "Onboarding" },
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
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 border-r border-neutral-900 bg-neutral-950 md:flex md:flex-col">
          <div className="flex h-14 items-center border-b border-neutral-900 px-4">
            <Link href="/app" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">
              {APP_NAME}
            </Link>
          </div>
          <nav className="flex-1 space-y-0.5 p-3">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            {isSuperAdmin ? (
              <Link
                href="/admin"
                className="mt-4 block rounded-md px-3 py-2 text-sm text-amber-400/90 hover:bg-neutral-900"
              >
                Admin console
              </Link>
            ) : null}
          </nav>
          <div className="border-t border-neutral-900 p-3 text-xs text-neutral-500">
            <p className="truncate text-neutral-300">{userEmail}</p>
            {orgName ? (
              <p className="mt-1 flex items-center gap-1.5 truncate">
                {orgName}
                {isDemo ? <Badge tone="demo">DEMO</Badge> : null}
              </p>
            ) : null}
            <form action="/api/auth/signout" method="POST" className="mt-2">
              <button type="submit" className="text-neutral-500 hover:text-white">Sign out</button>
            </form>
          </div>
        </aside>
        <main className="flex-1 overflow-x-hidden">
          <div className="border-b border-neutral-900 px-4 py-3 md:hidden">
            <Link href="/app" className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              {APP_NAME}
            </Link>
          </div>
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
