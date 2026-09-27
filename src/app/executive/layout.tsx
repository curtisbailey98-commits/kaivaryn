import { ExecShell } from "@/components/executive/exec-shell";
import { requireExecutive } from "@/lib/executive/access";

export const dynamic = "force-dynamic";

export default async function ExecutiveLayout({ children }: { children: React.ReactNode }) {
  const exec = await requireExecutive();
  return <ExecShell exec={exec}>{children}</ExecShell>;
}
