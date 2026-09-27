import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, effectiveRole } from "@/lib/rbac";
import type { Role } from "@/lib/enums";
import { buildReport, reportToCsv, reportToHtml, type ReportType } from "@/lib/reports";

const TYPES: ReportType[] = ["rr_summary", "ops_summary", "weekly_brief", "monthly_impact"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const role = effectiveRole((user?.role as Role) || "VIEWER", membership.role as Role);
  if (!can(role, "export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const typeParam = req.nextUrl.searchParams.get("type") || "rr_summary";
  const type = (TYPES.includes(typeParam as ReportType) ? typeParam : "rr_summary") as ReportType;
  const format = req.nextUrl.searchParams.get("format") || "csv";
  const report = await buildReport(membership.organizationId, type);

  if (format === "html") {
    return new NextResponse(reportToHtml(report), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new NextResponse(reportToCsv(report), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kaivaryn-${type}.csv"`,
    },
  });
}
