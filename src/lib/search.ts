import { prisma } from "./prisma";

/** Tenant-scoped search across opportunities, inefficiencies, customers, findings. */
export async function tenantSearch(organizationId: string, q: string, take = 40) {
  const query = q.trim();
  if (!query) return { opportunities: [], inefficiencies: [], customers: [], findings: [] };
  const [opportunities, inefficiencies, customers, findings] = await Promise.all([
    prisma.opportunity.findMany({
      where: {
        organizationId,
        OR: [
          { title: { contains: query } },
          { description: { contains: query } },
          { source: { contains: query } },
          { department: { contains: query } },
        ],
      },
      take,
      orderBy: { score: "desc" },
    }),
    prisma.inefficiency.findMany({
      where: {
        organizationId,
        OR: [
          { title: { contains: query } },
          { description: { contains: query } },
          { department: { contains: query } },
        ],
      },
      take,
      orderBy: { score: "desc" },
    }),
    prisma.customer.findMany({
      where: {
        organizationId,
        OR: [{ name: { contains: query } }, { email: { contains: query } }],
      },
      take,
    }),
    prisma.finding.findMany({
      where: {
        organizationId,
        OR: [
          { evidenceSummary: { contains: query } },
          { analysis: { contains: query } },
          { recommendation: { contains: query } },
          { ruleId: { contains: query } },
        ],
      },
      take,
    }),
  ]);
  return { opportunities, inefficiencies, customers, findings };
}
