import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { getRecoveryTracker, recoveryLedgerToCsv } from "@/lib/recovery/tracker";

export const dynamic = "force-dynamic";

/** CSV of the signed-in tenant's money-recovered ledger. Read-only; scoped to the session's organization. */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 });
  if (!can(ctx.effectiveRole, "export")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const tracker = await getRecoveryTracker(ctx.organizationId);
  const csv = recoveryLedgerToCsv(tracker);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kaivaryn-money-recovered-${stamp}${ctx.organization?.isDemo ? "-example-data" : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
