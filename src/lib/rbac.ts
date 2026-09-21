import type { Role } from "@/lib/enums";

/** Role rank: higher can do more. SUPER_ADMIN is platform-level. */
const RANK: Record<string, number> = {
  VIEWER: 10,
  ANALYST: 20,
  MANAGER: 30,
  ADMIN: 40,
  OWNER: 50,
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
  | "admin_console";

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
};

export function effectiveRole(platformRole: Role | string | null | undefined, membershipRole: Role | string | null | undefined): Role {
  if (platformRole === "SUPER_ADMIN") return "SUPER_ADMIN";
  return (membershipRole as Role) || "VIEWER";
}

export function roleRank(role: string | null | undefined): number {
  return RANK[role || "VIEWER"] ?? 0;
}

export function can(role: string | null | undefined, permission: Permission): boolean {
  return roleRank(role) >= PERM_MIN[permission];
}

export function assertCan(role: string | null | undefined, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Forbidden: requires ${permission}`);
  }
}
