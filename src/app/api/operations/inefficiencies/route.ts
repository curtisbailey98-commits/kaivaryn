import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

const STATUSES = new Set(["IDENTIFIED", "NEW", "ANALYZING", "APPROVED", "IMPLEMENTING", "IN_PROGRESS", "REALIZED", "VERIFIED", "RESOLVED", "DISMISSED"]);
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
  const automation = params.get("automation");
  const search = params.get("search")?.trim();
  const where = {
    organizationId: ctx.organizationId,
    ...(status && STATUSES.has(status) ? { status } : {}),
    ...(priority && PRIORITIES.has(priority) ? { priority } : {}),
    ...(automation === "true" || automation === "false" ? { automationCandidate: automation === "true" } : {}),
    ...(search ? { OR: [{ title: { contains: search } }, { source: { contains: search } }, { department: { contains: search } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.inefficiency.findMany({
      where,
      orderBy: [{ score: "desc" }, { projectedSavings: "desc" }],
      select: { id: true, title: true, status: true, priority: true, score: true, estimatedWasteAnnual: true, projectedSavings: true, realizedSavings: true, recoveredAnnual: true, automationCandidate: true, source: true, department: true, identifiedAt: true, updatedAt: true },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.inefficiency.count({ where }),
  ]);
  return NextResponse.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, filters: { status: status && STATUSES.has(status) ? status : null, priority: priority && PRIORITIES.has(priority) ? priority : null, automation: automation === "true" || automation === "false" ? automation === "true" : null, search: search || null } });
}
