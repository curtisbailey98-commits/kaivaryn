import type { Role } from "@/lib/enums";

/** Role rank: higher can do more. SUPER_ADMIN / CEO / CSEO are platform-level. */
const RANK: Record<string, number> = {
  VIEWER: 10,
  ANALYST: 20,
  MANAGER: 30,
  ADMIN: 40,
  OWNER: 50,
  CSEO: 90,
  CEO: 95,
  SUPER_ADMIN: 100,
};

export type Permission =
  | "read"
  | "comment"
  | "write" // create/update work items
  | "assign"
  | "record_financial" // recovered/verified amounts
  | "approve"
  | "import"
  | "export"
  | "manage_settings"
  | "manage_members"
  | "run_intelligence"
  | "admin_console"
  | "executive_console"
  | "chief_foundry"
  | "chief_approve"
  | "chief_deploy"
  | "cseo_console"
  | "security_intake"
  | "switch_executive_dashboard"
  | "critical_security_change";

const PERM_MIN: Record<Permission, number> = {
  read: 10,
  comment: 10,
  write: 20,
  assign: 20,
  record_financial: 30,
  approve: 30,
  import: 30,
  export: 20,
  manage_settings: 40,
  manage_members: 40,
  run_intelligence: 20,
  admin_console: 100,
  executive_console: 90,
  chief_foundry: 90,
  chief_approve: 90,
  chief_deploy: 90,
  cseo_console: 90,
  security_intake: 90,
  switch_executive_dashboard: 90,
  critical_security_change: 90,
};

/** Fine-grained executive permission matrix (identity-aware). */
const EXEC_PERMS: Record<string, Permission[]> = {
  SUPER_ADMIN: [
    "admin_console",
    "executive_console",
    "chief_foundry",
    "chief_approve",
    "chief_deploy",
    "cseo_console",
    "security_intake",
    "switch_executive_dashboard",
    "critical_security_change",
  ],
  CEO: [
    "executive_console",
    "chief_foundry",
    "chief_approve",
    "chief_deploy",
    "cseo_console",
    "security_intake",
    "switch_executive_dashboard",
    "critical_security_change",
  ],
  CSEO: [
    "executive_console",
    "chief_foundry",
    "chief_approve",
    "cseo_console",
    "security_intake",
    "switch_executive_dashboard",
    "critical_security_change",
    // CSEO may stage but production deploy of non-security agents still needs CEO co-approval for privilege elevation
  ],
};

export function effectiveRole(platformRole: Role | string | null | undefined, membershipRole: Role | string | null | undefined): Role {
  if (platformRole === "SUPER_ADMIN" || platformRole === "CEO" || platformRole === "CSEO") {
    return platformRole as Role;
  }
  return (membershipRole as Role) || "VIEWER";
}

export function roleRank(role: string | null | undefined): number {
  return RANK[role || "VIEWER"] ?? 0;
}

export function isExecutivePlatformRole(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "CEO" || role === "CSEO";
}

export function can(role: string | null | undefined, permission: Permission): boolean {
  const execList = role ? EXEC_PERMS[role] : undefined;
  if (execList && (permission === "admin_console" ||
    permission === "executive_console" ||
    permission === "chief_foundry" ||
    permission === "chief_approve" ||
    permission === "chief_deploy" ||
    permission === "cseo_console" ||
    permission === "security_intake" ||
    permission === "switch_executive_dashboard" ||
    permission === "critical_security_change")) {
    return execList.includes(permission);
  }
  // Platform executives inherit full org-level capabilities for command-center visibility
  if (isExecutivePlatformRole(role) && PERM_MIN[permission] < 90) {
    return true;
  }
  return roleRank(role) >= PERM_MIN[permission];
}

export function assertCan(role: string | null | undefined, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Forbidden: requires ${permission}`);
  }
}

/** CSEO may approve security-scoped deploys; CEO/SUPER_ADMIN may approve any. */
export function canApproveFoundryDeploy(role: string | null | undefined, ownerRole: string): boolean {
  if (!can(role, "chief_approve")) return false;
  if (role === "CEO" || role === "SUPER_ADMIN") return true;
  if (role === "CSEO") return ownerRole === "CSEO" || ownerRole === "SHARED" || ownerRole === "SECURITY";
  return false;
}

/** Production deploy of unrestricted tool grants always needs CEO or SUPER_ADMIN. */
export function canDeployProduction(role: string | null | undefined, hasUnrestrictedTools: boolean): boolean {
  if (!can(role, "chief_deploy") && !(role === "CSEO" && !hasUnrestrictedTools)) return false;
  if (hasUnrestrictedTools) return role === "CEO" || role === "SUPER_ADMIN";
  return can(role, "chief_deploy") || role === "CSEO";
}
