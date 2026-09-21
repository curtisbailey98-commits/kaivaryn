import { prisma } from "./prisma";

export async function notify(params: {
  organizationId: string;
  userId: string;
  title: string;
  body?: string;
  href?: string;
}) {
  return prisma.notification.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      title: params.title,
      body: params.body,
      href: params.href,
    },
  });
}

export async function notifyOrgManagers(params: {
  organizationId: string;
  title: string;
  body?: string;
  href?: string;
}) {
  const members = await prisma.membership.findMany({
    where: {
      organizationId: params.organizationId,
      role: { in: ["OWNER", "ADMIN", "MANAGER"] },
    },
  });
  for (const m of members) {
    await notify({ ...params, userId: m.userId });
  }
}
