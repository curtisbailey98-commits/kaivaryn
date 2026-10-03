import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getSessionContext } from "@/lib/tenant";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: { default: "Admin console", template: "%s | Kaivaryn Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.isSuperAdmin) redirect("/app");

  const links = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/orgs", label: "Organizations" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/acquisition", label: "Acquisition" },
    { href: "/admin/acquisition/execution", label: "Execution" },
    { href: "/admin/demos", label: "Demo leads" },
    { href: "/admin/pricing", label: "Pricing" },
    { href: "/admin/audit", label: "Audit" },
    { href: "/admin/health", label: "Health" },
    { href: "/executive/ceo", label: "CEO Command" },
    { href: "/executive/chief", label: "CHIEF Agent Foundry" },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-900 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/admin" className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
            {APP_NAME} Admin
          </Link>
          <Link href="/app" className="text-xs text-neutral-500 hover:text-white">← App</Link>
        </div>
        <nav className="mx-auto mt-3 flex max-w-6xl flex-wrap gap-3 text-xs text-neutral-400">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-amber-400">
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
