import type { Role } from "@/lib/enums";
import type { Permission } from "@/lib/rbac";
import { can, effectiveRole } from "@/lib/rbac";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  organizationId?: string | null;
  membershipRole?: Role | null;
};

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function getSessionContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      memberships: {
        include: { organization: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  if (!user) return null;

  const membership = user.memberships[0] ?? null;
  const membershipRole = (membership?.role as Role) ?? null;
  const eff = effectiveRole(user.role as Role, membershipRole);
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    },
    membership,
    organization: membership?.organization ?? null,
    organizationId: membership?.organizationId ?? null,
    membershipRole,
    effectiveRole: eff,
    isSuperAdmin: user.role === "SUPER_ADMIN",
  };
}

/** Enforce tenant isolation. Super admin may pass orgId override only in /admin flows. */
export async function requireOrgAccess(opts?: { allowSuperAdminCrossTenant?: boolean; orgIdOverride?: string }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  if (opts?.allowSuperAdminCrossTenant && ctx.isSuperAdmin && opts.orgIdOverride) {
    return { ...ctx, organizationId: opts.orgIdOverride };
  }

  if (!ctx.organizationId && !ctx.isSuperAdmin) {
    redirect("/app/onboarding");
  }

  return ctx;
}

export async function requirePermission(permission: Permission, opts?: { allowSuperAdminCrossTenant?: boolean; orgIdOverride?: string }) {
  const ctx = await requireOrgAccess(opts);
  if (!can(ctx.effectiveRole, permission)) {
    throw new Error(`Forbidden: ${permission} requires higher role (have ${ctx.effectiveRole})`);
  }
  return ctx;
}

export function assertOrgId(organizationId: string | null | undefined): asserts organizationId is string {
  if (!organizationId) {
    throw new Error("Organization context required");
  }
}

/** Server-side tenant guard for a row. */
export function assertSameOrg(rowOrgId: string, sessionOrgId: string) {
  if (rowOrgId !== sessionOrgId) {
    throw new Error("Cross-tenant access denied");
  }
}
