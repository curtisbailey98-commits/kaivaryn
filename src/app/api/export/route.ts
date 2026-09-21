import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exportFindingsCsv, exportOpportunitiesCsv } from "@/lib/exports";
import { can, effectiveRole } from "@/lib/rbac";
import type { Role } from "@/lib/enums";

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
  const type = req.nextUrl.searchParams.get("type") || "opportunities";
  const csv =
    type === "findings"
      ? await exportFindingsCsv(membership.organizationId)
      : await exportOpportunitiesCsv(membership.organizationId);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kaivaryn-${type}.csv"`,
    },
  });
}
