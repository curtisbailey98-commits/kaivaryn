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
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { source: { contains: query, mode: "insensitive" } },
          { department: { contains: query, mode: "insensitive" } },
        ],
      },
      take,
      orderBy: { score: "desc" },
    }),
    prisma.inefficiency.findMany({
      where: {
        organizationId,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { department: { contains: query, mode: "insensitive" } },
        ],
      },
      take,
      orderBy: { score: "desc" },
    }),
    prisma.customer.findMany({
      where: {
        organizationId,
        OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }],
      },
      take,
    }),
    prisma.finding.findMany({
      where: {
        organizationId,
        OR: [
          { evidenceSummary: { contains: query, mode: "insensitive" } },
          { analysis: { contains: query, mode: "insensitive" } },
          { recommendation: { contains: query, mode: "insensitive" } },
          { ruleId: { contains: query, mode: "insensitive" } },
        ],
      },
      take,
    }),
  ]);
  return { opportunities, inefficiencies, customers, findings };
}
