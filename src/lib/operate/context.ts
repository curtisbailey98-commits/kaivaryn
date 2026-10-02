/**
 * Operating layer context — the only way operating-layer functions receive tenant identity.
 * Every function takes an OpCtx and filters every query by ctx.organizationId.
 */
import { can, type Permission } from "@/lib/rbac";

export type OpCtx = {
  organizationId: string;
  userId: string | null;
  role: string;
  /** Platform executives (CEO/CSEO/SUPER_ADMIN) — unlocks CHIEF hand-off in Command. */
  isExecutive?: boolean;
};

export class OpError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function requireOpPermission(ctx: OpCtx, permission: Permission) {
  if (!ctx.organizationId) throw new OpError("no_org", "Organization context required", 403);
  if (!can(ctx.role, permission)) {
    throw new OpError("forbidden", `Requires ${permission} (role ${ctx.role})`, 403);
  }
}

/** Build an OpCtx from the session context returned by requireOrgAccess(). */
export function opCtxFromSession(ctx: {
  organizationId: string | null;
  user: { id: string };
  effectiveRole: string;
  isExecutive?: boolean;
  isSuperAdmin?: boolean;
}): OpCtx {
  if (!ctx.organizationId) throw new OpError("no_org", "Organization context required", 403);
  return {
    organizationId: ctx.organizationId,
    userId: ctx.user.id,
    role: ctx.effectiveRole,
    isExecutive: Boolean(ctx.isExecutive || ctx.isSuperAdmin),
  };
}

export function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
