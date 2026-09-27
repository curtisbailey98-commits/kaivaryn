import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/tenant";
import { can, isExecutivePlatformRole, type Permission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { ExecutiveDashboard } from "@/lib/enums";

export type ExecutiveContext = {
  user: { id: string; email: string; name?: string | null; role: string };
  platformRole: string;
  activeDashboard: ExecutiveDashboard;
  canSwitch: boolean;
  permissions: {
    executive: boolean;
    chief: boolean;
    chiefApprove: boolean;
    chiefDeploy: boolean;
    cseo: boolean;
    securityIntake: boolean;
  };
};

export async function requireExecutive(permission: Permission = "executive_console"): Promise<ExecutiveContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login?callbackUrl=/executive");
  if (!isExecutivePlatformRole(ctx.user.role) || !can(ctx.user.role, permission)) {
    redirect("/app?error=executive_only");
  }

  const pref = await prisma.executiveDashboardPref.findUnique({ where: { userId: ctx.user.id } });
  const defaultDash: ExecutiveDashboard = ctx.user.role === "CSEO" ? "CSEO" : "CEO";
  const activeDashboard = (pref?.activeDashboard as ExecutiveDashboard) || defaultDash;

  return {
    user: ctx.user,
    platformRole: ctx.user.role,
    activeDashboard,
    canSwitch: can(ctx.user.role, "switch_executive_dashboard"),
    permissions: {
      executive: can(ctx.user.role, "executive_console"),
      chief: can(ctx.user.role, "chief_foundry"),
      chiefApprove: can(ctx.user.role, "chief_approve"),
      chiefDeploy: can(ctx.user.role, "chief_deploy"),
      cseo: can(ctx.user.role, "cseo_console"),
      securityIntake: can(ctx.user.role, "security_intake"),
    },
  };
}

export async function setActiveDashboard(userId: string, role: string, dashboard: ExecutiveDashboard) {
  if (!can(role, "switch_executive_dashboard")) {
    throw new Error("Forbidden: cannot switch executive dashboard");
  }
  // Never bypass auth — preference only stored for authorized executives
  await prisma.executiveDashboardPref.upsert({
    where: { userId },
    update: { activeDashboard: dashboard },
    create: { userId, activeDashboard: dashboard },
  });
  await prisma.execAuditEvent.create({
    data: {
      actorId: userId,
      action: "executive.dashboard.switch",
      dashboard,
      entityType: "ExecutiveDashboardPref",
      metadataJson: JSON.stringify({ dashboard }),
    },
  });
}
