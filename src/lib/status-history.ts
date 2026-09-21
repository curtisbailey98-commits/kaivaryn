import { prisma } from "./prisma";

export async function recordStatusChange(params: {
  organizationId: string;
  entityType: string;
  entityId: string;
  fromStatus: string | null | undefined;
  toStatus: string;
  actorId?: string | null;
  note?: string | null;
}) {
  if (params.fromStatus === params.toStatus) return null;
  return prisma.statusHistory.create({
    data: {
      organizationId: params.organizationId,
      entityType: params.entityType,
      entityId: params.entityId,
      fromStatus: params.fromStatus ?? null,
      toStatus: params.toStatus,
      actorId: params.actorId ?? null,
      note: params.note ?? null,
    },
  });
}
