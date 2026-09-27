/**
 * Same-domain live deploy adapter for CHIEF website/app agents.
 * Publishes packages at /a/<slug> (served from AgentVersion.webBundleJson).
 * Tracks liveUrl, health, and rollback on AgentDeployment.
 */
import { prisma } from "@/lib/prisma";
import type { WebBundle } from "./webgen";

export function publicBaseUrl(): string {
  const raw = (process.env.NEXTAUTH_URL || process.env.RENDER_EXTERNAL_URL || "https://kaivaryn.onrender.com").replace(/\/$/, "");
  return raw || "https://kaivaryn.onrender.com";
}

export function isWebRuntime(runtime?: string | null): boolean {
  return runtime === "static-site" || runtime === "web-app" || runtime === "next-microsite";
}

export function livePathForSlug(slug: string): string {
  return `/a/${slug}`;
}

export function healthPathForSlug(slug: string): string {
  return `/api/a/${slug}/health`;
}

export async function publishSameDomainAgent(params: {
  agentId: string;
  versionId: string;
  slug: string;
  approvedById: string;
  note?: string;
  bundle?: WebBundle | null;
}): Promise<{
  deploymentId: string;
  liveUrl: string;
  healthUrl: string;
  healthStatus: string;
  previousDeploymentId?: string;
}> {
  const base = publicBaseUrl();
  const liveUrl = `${base}${livePathForSlug(params.slug)}`;
  const healthUrl = `${base}${healthPathForSlug(params.slug)}`;

  // Rollback pointer: previous active production deploy for this agent
  const previous = await prisma.agentDeployment.findFirst({
    where: { agentId: params.agentId, environment: "PRODUCTION", status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  if (previous) {
    await prisma.agentDeployment.update({
      where: { id: previous.id },
      data: { status: "ROLLED_BACK", rolledBackAt: new Date() },
    });
  }

  // Activate any pending staging row
  await prisma.agentDeployment.updateMany({
    where: { agentId: params.agentId, environment: "STAGING", status: "PENDING" },
    data: { status: "ACTIVE", approvedById: params.approvedById, activatedAt: new Date() },
  });

  const healthStatus = params.bundle?.files?.["index.html"] ? "OK" : "UNKNOWN";

  const prod = await prisma.agentDeployment.create({
    data: {
      agentId: params.agentId,
      versionId: params.versionId,
      environment: "PRODUCTION",
      status: "ACTIVE",
      approvedById: params.approvedById,
      activatedAt: new Date(),
      notes: params.note || "Approved via CHIEF Foundry (same-domain live web)",
      liveUrl,
      healthUrl,
      healthStatus,
      healthCheckedAt: new Date(),
      adapter: "same-domain",
      previousDeploymentId: previous?.id || null,
    },
  });

  return {
    deploymentId: prod.id,
    liveUrl,
    healthUrl,
    healthStatus,
    previousDeploymentId: previous?.id,
  };
}

export async function rollbackWebDeployment(params: {
  agentId: string;
  actorId: string;
}): Promise<{ ok: boolean; error?: string; liveUrl?: string }> {
  const current = await prisma.agentDeployment.findFirst({
    where: { agentId: params.agentId, environment: "PRODUCTION", status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (!current?.previousDeploymentId) {
    return { ok: false, error: "No previous deployment to roll back to" };
  }
  const previous = await prisma.agentDeployment.findUnique({ where: { id: current.previousDeploymentId } });
  if (!previous) return { ok: false, error: "Previous deployment missing" };

  await prisma.agentDeployment.update({
    where: { id: current.id },
    data: { status: "ROLLED_BACK", rolledBackAt: new Date() },
  });
  await prisma.agentDeployment.update({
    where: { id: previous.id },
    data: {
      status: "ACTIVE",
      activatedAt: new Date(),
      rolledBackAt: null,
      healthStatus: previous.healthStatus || "OK",
      healthCheckedAt: new Date(),
      notes: `Rolled back by ${params.actorId}`,
    },
  });

  return { ok: true, liveUrl: previous.liveUrl || undefined };
}

export async function getActiveWebBundle(slug: string): Promise<{
  bundle: WebBundle;
  deploymentId: string;
  version: number;
  agentId: string;
  liveUrl: string | null;
  healthStatus: string | null;
} | null> {
  const agent = await prisma.agentDefinition.findUnique({
    where: { slug },
    include: {
      deployments: {
        where: { status: "ACTIVE", environment: "PRODUCTION" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { version: true },
      },
    },
  });
  const dep = agent?.deployments[0];
  if (!dep?.version?.webBundleJson) return null;
  let bundle: WebBundle;
  try {
    bundle = JSON.parse(dep.version.webBundleJson) as WebBundle;
  } catch {
    return null;
  }
  if (!bundle?.files?.["index.html"]) return null;
  return {
    bundle,
    deploymentId: dep.id,
    version: dep.version.version,
    agentId: agent!.id,
    liveUrl: dep.liveUrl,
    healthStatus: dep.healthStatus,
  };
}

export async function recordHealthCheck(deploymentId: string, status: string) {
  await prisma.agentDeployment.update({
    where: { id: deploymentId },
    data: { healthStatus: status, healthCheckedAt: new Date() },
  });
}
