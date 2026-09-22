import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/tenant";
import { getLearningSummary } from "@/lib/learning";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profiles = await getLearningSummary(ctx.organizationId);
  return NextResponse.json({ learningPolicy: "verified_outcomes_only", profiles });
}
