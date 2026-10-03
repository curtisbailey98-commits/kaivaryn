import type { Metadata } from "next";
import { ExecShell } from "@/components/executive/exec-shell";
import { requireExecutive } from "@/lib/executive/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Executive", template: "%s | Kaivaryn Executive" },
  robots: { index: false, follow: false },
};

export default async function ExecutiveLayout({ children }: { children: React.ReactNode }) {
  const exec = await requireExecutive();
  return <ExecShell exec={exec}>{children}</ExecShell>;
}
