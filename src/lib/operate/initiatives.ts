/**
 * Initiatives — renovated from 720 SI Projects (named work containers + links).
 * Link targets are verified to belong to the same organization before linking.
 */
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import type { OpCtx } from "./context";
import { OpError, requireOpPermission } from "./context";

export const LINK_TYPES = ["OPPORTUNITY", "INEFFICIENCY", "RUN", "PLAYBOOK", "CYCLE", "BRIEFING"] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export async function createInitiative(ctx: OpCtx, input: { name: string; description?: string; product?: string }) {
  requireOpPermission(ctx, "write");
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new OpError("invalid", "Initiative name required");
  const product = input.product === "REVENUE_RECOVERY" || input.product === "OPERATIONS_EFFICIENCY" ? input.product : "BOTH";
  const row = await prisma.opInitiative.create({
    data: { organizationId: ctx.organizationId, name, description: (input.description || "").slice(0, 2000), product, ownerId: ctx.userId, createdById: ctx.userId },
  });
  await writeAudit({ organizationId: ctx.organizationId, actorId: ctx.userId, action: "initiative.created", entityType: "OpInitiative", entityId: row.id, metadata: { name } });
  return row;
}

export async function listInitiatives(ctx: OpCtx) {
  return prisma.opInitiative.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: { _count: { select: { links: true } } },
  });
}

async function assertLinkTarget(ctx: OpCtx, type: LinkType, id: string) {
  const where = { id, organizationId: ctx.organizationId };
  const found =
    type === "OPPORTUNITY" ? await prisma.opportunity.findFirst({ where, select: { id: true } })
    : type === "INEFFICIENCY" ? await prisma.inefficiency.findFirst({ where, select: { id: true } })
    : type === "RUN" ? await prisma.opRun.findFirst({ where, select: { id: true } })
    : type === "PLAYBOOK" ? await prisma.opPlaybook.findFirst({ where, select: { id: true } })
    : type === "CYCLE" ? await prisma.siCognitionCycle.findFirst({ where, select: { id: true } })
    : await prisma.opBriefing.findFirst({ where, select: { id: true } });
  if (!found) throw new OpError("not_found", `${type} not found in this organization`, 404);
}

export async function linkToInitiative(ctx: OpCtx, initiativeId: string, type: LinkType, entityId: string) {
  requireOpPermission(ctx, "write");
  if (!LINK_TYPES.includes(type)) throw new OpError("invalid", "Unsupported link type");
  const ini = await prisma.opInitiative.findFirst({ where: { id: initiativeId, organizationId: ctx.organizationId } });
  if (!ini) throw new OpError("not_found", "Initiative not found in this organization", 404);
  await assertLinkTarget(ctx, type, entityId);
  return prisma.opInitiativeLink.upsert({
    where: { initiativeId_entityType_entityId: { initiativeId, entityType: type, entityId } },
    update: {},
    create: { organizationId: ctx.organizationId, initiativeId, entityType: type, entityId },
  });
}

export async function setInitiativeStatus(ctx: OpCtx, id: string, status: "ACTIVE" | "PAUSED" | "COMPLETED") {
  requireOpPermission(ctx, "write");
  const res = await prisma.opInitiative.updateMany({ where: { id, organizationId: ctx.organizationId }, data: { status } });
  if (!res.count) throw new OpError("not_found", "Initiative not found in this organization", 404);
  return res.count;
}

/** Detail with resolved links — money fields carry their nature (estimate vs recorded). */
export async function getInitiativeDetail(ctx: OpCtx, id: string) {
  const ini = await prisma.opInitiative.findFirst({ where: { id, organizationId: ctx.organizationId }, include: { links: { orderBy: { createdAt: "desc" } } } });
  if (!ini) return null;
  const ids = (t: string) => ini.links.filter((l) => l.entityType === t).map((l) => l.entityId);
  const [opps, ineffs, runs, playbooks] = await Promise.all([
    prisma.opportunity.findMany({ where: { organizationId: ctx.organizationId, id: { in: ids("OPPORTUNITY") } }, select: { id: true, title: true, status: true, priority: true, potentialAmount: true, recoveredAmount: true } }),
    prisma.inefficiency.findMany({ where: { organizationId: ctx.organizationId, id: { in: ids("INEFFICIENCY") } }, select: { id: true, title: true, status: true, priority: true, projectedSavings: true, realizedSavings: true } }),
    prisma.opRun.findMany({ where: { organizationId: ctx.organizationId, id: { in: ids("RUN") } }, orderBy: { createdAt: "desc" } }),
    prisma.opPlaybook.findMany({ where: { organizationId: ctx.organizationId, id: { in: ids("PLAYBOOK") } } }),
  ]);
  const totals = {
    pipelinePotential: opps.reduce((s, o) => s + (o.potentialAmount ?? 0), 0),
    cashRecovered: opps.reduce((s, o) => s + (o.recoveredAmount ?? 0), 0),
    projectedSavings: ineffs.reduce((s, i) => s + (i.projectedSavings ?? 0), 0),
    realizedSavings: ineffs.reduce((s, i) => s + (i.realizedSavings ?? 0), 0),
  };
  return { initiative: ini, opps, ineffs, runs, playbooks, totals };
}
