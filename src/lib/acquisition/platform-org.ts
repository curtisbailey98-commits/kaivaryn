import { prisma } from "@/lib/prisma";

const PLATFORM_ORG_SLUG = "kaivaryn-platform";

/**
 * The Client Acquisition Intelligence System reuses the existing org-scoped
 * tables (Finding, Evidence, StatusHistory, Notification, LearningEvent,
 * LearningProfile, ApprovalRequest, IntegrationConnection, Comment, Task)
 * rather than forking parallel ones. Every acquisition-system row in those
 * tables is scoped to this one internal Organization — never a real client.
 * `isPlatform: true` excludes it from client-org listings (see admin/orgs).
 *
 * This is intentionally request-cached only (no in-memory singleton across
 * requests/instances) so a cold start or multi-instance deploy can't read a
 * stale id — the upsert is cheap and idempotent.
 */
export async function getPlatformOrgId(): Promise<string> {
  const org = await prisma.organization.upsert({
    where: { slug: PLATFORM_ORG_SLUG },
    update: {},
    create: {
      name: "Kaivaryn (Platform)",
      slug: PLATFORM_ORG_SLUG,
      isDemo: false,
      isPlatform: true,
    },
  });
  return org.id;
}

export { PLATFORM_ORG_SLUG };
