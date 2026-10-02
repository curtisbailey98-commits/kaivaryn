import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireOrgAccess } from "@/lib/tenant";
import { FlashToast } from "@/components/ui/flash-toast";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgAccess();
  // Inbox badge: pending approvals + unread notifications + unread briefings (tenant-scoped)
  let inboxCount = 0;
  if (ctx.organizationId) {
    const [a, n, b] = await Promise.all([
      prisma.approvalRequest.count({ where: { organizationId: ctx.organizationId, status: "PENDING" } }),
      prisma.notification.count({ where: { organizationId: ctx.organizationId, userId: ctx.user.id, readAt: null } }),
      prisma.opBriefing.count({ where: { organizationId: ctx.organizationId, readAt: null } }),
    ]).catch(() => [0, 0, 0]);
    inboxCount = a + n + b;
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
