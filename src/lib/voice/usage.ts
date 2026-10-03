/**
 * Included Voice Usage — per tenant per month (UTC). Aggregated from stored calls, so it is idempotent.
 * The allowance is nullable: no pricing or minutes are hard-coded. When an allowance is set (by Kaivaryn,
 * per tenant), managers are notified once per threshold per month at 75%, 90%, and 100%.
 */
import { prisma } from "@/lib/prisma";
import { notifyOrgManagers } from "@/lib/notifications";

export const USAGE_THRESHOLDS = [75, 90, 100] as const;

export type OverageState = "NO_ALLOWANCE" | "OK" | "NOTICE_75" | "WARNING_90" | "AT_LIMIT" | "OVER";

export function usageState(minutes: number, included: number | null | undefined): { percent: number | null; remaining: number | null; state: OverageState; crossed: number[] } {
  if (included === null || included === undefined || !(included > 0)) return { percent: null, remaining: null, state: "NO_ALLOWANCE", crossed: [] };
  const percent = Math.round((minutes / included) * 1000) / 10;
  const remaining = Math.round(Math.max(0, included - minutes) * 10) / 10;
  const crossed = USAGE_THRESHOLDS.filter((t) => percent >= t);
  const state: OverageState = percent > 100 ? "OVER" : percent >= 100 ? "AT_LIMIT" : percent >= 90 ? "WARNING_90" : percent >= 75 ? "NOTICE_75" : "OK";
  return { percent, remaining, state, crossed: [...crossed] };
}

export const USAGE_STATE_LABEL: Record<OverageState, string> = {
  NO_ALLOWANCE: "Allowance not set yet",
  OK: "Within included usage",
  NOTICE_75: "75% of included usage used",
  WARNING_90: "90% of included usage used",
  AT_LIMIT: "Included usage reached",
  OVER: "Over included usage — Kaivaryn will contact you before anything changes",
};

/** Tenant's monthly included minutes, set by Kaivaryn in OrgSettings.settingsJson.voiceIncludedMinutes. */
export async function includedMinutesFor(tenantId: string): Promise<number | null> {
  const s = await prisma.orgSettings.findUnique({ where: { organizationId: tenantId }, select: { settingsJson: true } });
  try {
    const v = JSON.parse(s?.settingsJson || "{}").voiceIncludedMinutes;
    return typeof v === "number" && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export async function recomputeUsage(tenantId: string, period: string, opts?: { notify?: boolean }) {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  const agg = await prisma.voiceCall.aggregate({
    where: { tenantId, startedAt: { gte: from, lt: to } },
    _count: { _all: true },
    _sum: { durationSeconds: true, costUsd: true },
  });
  const costRows = await prisma.voiceCall.count({ where: { tenantId, startedAt: { gte: from, lt: to }, costUsd: { not: null } } });
  const minutes = Math.round(((agg._sum.durationSeconds ?? 0) / 60) * 10) / 10;
  const included = await includedMinutesFor(tenantId);
  const st = usageState(minutes, included);
  const prev = await prisma.voiceUsage.findUnique({ where: { tenantId_period: { tenantId, period } } });
  const alerted: number[] = JSON.parse(prev?.alertedThresholdsJson || "[]");
  const newly = st.crossed.filter((t) => !alerted.includes(t));
  const row = await prisma.voiceUsage.upsert({
    where: { tenantId_period: { tenantId, period } },
    update: { calls: agg._count._all, minutes, providerCostUsd: costRows ? Math.round((agg._sum.costUsd ?? 0) * 10000) / 10000 : null, includedMinutes: included, remainingMinutes: st.remaining, percentUsed: st.percent, overageState: st.state, alertedThresholdsJson: JSON.stringify([...alerted, ...newly].sort((a, b) => a - b)) },
    create: { tenantId, period, calls: agg._count._all, minutes, providerCostUsd: costRows ? Math.round((agg._sum.costUsd ?? 0) * 10000) / 10000 : null, includedMinutes: included, remainingMinutes: st.remaining, percentUsed: st.percent, overageState: st.state, alertedThresholdsJson: JSON.stringify(newly) },
  });
  if (newly.length && opts?.notify !== false) {
    const top = Math.max(...newly);
    await notifyOrgManagers({
      organizationId: tenantId,
      title: top >= 100 ? "Included Voice Usage reached" : `Included Voice Usage at ${top}%`,
      body: `${minutes} of ${included} included minutes used this month. Nothing is charged or switched off automatically — Kaivaryn will reach out before anything changes.`,
      href: "/app/calls",
    });
    await prisma.voiceEvent.create({ data: { tenantId, type: "usage.threshold", detailJson: JSON.stringify({ period, thresholds: newly, minutes, included }) } });
  }
  return row;
}

export async function currentUsage(tenantId: string, now = new Date()) {
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const row = await prisma.voiceUsage.findUnique({ where: { tenantId_period: { tenantId, period } } });
  const included = await includedMinutesFor(tenantId);
  if (row) return { ...row, includedMinutes: included ?? row.includedMinutes };
  const st = usageState(0, included);
  return { tenantId, period, calls: 0, minutes: 0, providerCostUsd: null, includedMinutes: included, remainingMinutes: st.remaining, percentUsed: st.percent, overageState: st.state, alertedThresholdsJson: "[]" };
}
