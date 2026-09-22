import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

const STATUSES = new Set(["IDENTIFIED", "NEW", "UNDER_REVIEW", "APPROVED", "IN_RECOVERY", "IN_PROGRESS", "PARTIALLY_RECOVERED", "RECOVERED", "VERIFIED", "DISMISSED"]);
const PRIORITIES = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const rawLimit = Number(params.get("limit") || 25);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 100) : 25;
  const rawPage = Number(params.get("page") || 1);
  const page = Number.isFinite(rawPage) ? Math.max(Math.floor(rawPage), 1) : 1;
  const status = params.get("status");
  const priority = params.get("priority");
  const search = params.get("search")?.trim();
  const where = {
    organizationId: ctx.organizationId,
    ...(status && STATUSES.has(status) ? { status } : {}),
    ...(priority && PRIORITIES.has(priority) ? { priority } : {}),
    ...(search ? { OR: [{ title: { contains: search } }, { source: { contains: search } }, { department: { contains: search } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      orderBy: [{ score: "desc" }, { potentialAmount: "desc" }],
      select: { id: true, title: true, status: true, priority: true, score: true, potentialAmount: true, estimatedAmount: true, recoveredAmount: true, source: true, department: true, identifiedAt: true, updatedAt: true },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.opportunity.count({ where }),
  ]);
  return NextResponse.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, filters: { status: status && STATUSES.has(status) ? status : null, priority: priority && PRIORITIES.has(priority) ? priority : null, search: search || null } });
}
