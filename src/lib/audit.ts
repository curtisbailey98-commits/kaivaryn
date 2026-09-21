import { prisma } from "./prisma";

export async function writeAudit(params: {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId ?? null,
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
      ip: params.ip,
    },
  });
}
