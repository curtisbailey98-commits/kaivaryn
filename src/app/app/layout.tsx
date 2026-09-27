import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireOrgAccess } from "@/lib/tenant";
import { FlashToast } from "@/components/ui/flash-toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgAccess();
  return (
    <AppShell
      userEmail={ctx.user.email}
      orgName={ctx.organization?.name}
      isDemo={ctx.organization?.isDemo}
      isSuperAdmin={ctx.isSuperAdmin || ctx.isExecutive}
    >
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
      {children}
    </AppShell>
  );
}
