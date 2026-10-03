import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireOrgAccess } from "@/lib/tenant";
import { FlashToast } from "@/components/ui/flash-toast";
import { getInboxCounts } from "@/lib/operate/inbox";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgAccess();
  // Inbox badge = exactly what the Inbox lists (shared with the home attention strip).
  let inboxCount = 0;
  if (ctx.organizationId) {
    inboxCount = await getInboxCounts(ctx.organizationId, ctx.user.id)
      .then((c) => c.total)
      .catch(() => 0);
  }
  return (
    <AppShell
      userEmail={ctx.user.email}
      orgName={ctx.organization?.name}
      isDemo={ctx.organization?.isDemo}
      isSuperAdmin={ctx.isSuperAdmin || ctx.isExecutive}
      badges={{ "/app/inbox": inboxCount }}
    >
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
      {children}
    </AppShell>
  );
}
