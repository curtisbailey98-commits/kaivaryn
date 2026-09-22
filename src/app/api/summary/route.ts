import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ctx.organizationId || !ctx.organization) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const organizationId = ctx.organizationId;
  const [
    entitlements,
    revenue,
    revenueOpen,
    revenueCritical,
    operations,
    automationCandidates,
    operationsOpen,
    pendingApprovals,
    unreadNotifications,
    openTasks,
  ] = await Promise.all([
    prisma.entitlement.findMany({
      where: { organizationId, active: true },
      select: { product: true },
      orderBy: { product: "asc" },
    }),
    prisma.opportunity.aggregate({
      where: { organizationId },
      _sum: { estimatedAmount: true, recoveredAmount: true },
      _count: true,
    }),
    prisma.opportunity.count({
      where: {
        organizationId,
        status: { notIn: ["RECOVERED", "VERIFIED", "DISMISSED"] },
      },
    }),
    prisma.opportunity.count({
      where: { organizationId, priority: "CRITICAL", status: { not: "DISMISSED" } },
    }),
    prisma.inefficiency.aggregate({
      where: { organizationId },
      _sum: { estimatedWasteAnnual: true, recoveredAnnual: true },
      _count: true,
    }),
    prisma.inefficiency.count({
      where: { organizationId, automationCandidate: true, status: { not: "DISMISSED" } },
    }),
    prisma.inefficiency.count({
      where: { organizationId, status: { notIn: ["REALIZED", "VERIFIED", "RESOLVED", "DISMISSED"] } },
    }),
    prisma.approvalRequest.count({ where: { organizationId, status: "PENDING" } }),
    prisma.notification.count({ where: { organizationId, userId: ctx.user.id, readAt: null } }),
    prisma.task.count({ where: { organizationId, status: "OPEN" } }),
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    organization: {
      id: ctx.organization.id,
      name: ctx.organization.name,
      isDemo: ctx.organization.isDemo,
    },
    access: {
      role: ctx.effectiveRole,
      entitlements: entitlements.map((item) => item.product),
    },
    revenueRecovery: {
      total: revenue._count,
      open: revenueOpen,
      critical: revenueCritical,
      estimated: revenue._sum.estimatedAmount ?? 0,
      recovered: revenue._sum.recoveredAmount ?? 0,
    },
    operationsEfficiency: {
      total: operations._count,
      open: operationsOpen,
      automationCandidates,
      estimatedWasteAnnual: operations._sum.estimatedWasteAnnual ?? 0,
      recoveredAnnual: operations._sum.recoveredAnnual ?? 0,
    },
    actionCenter: {
      pendingApprovals,
      unreadNotifications,
      openTasks,
    },
  });
}
