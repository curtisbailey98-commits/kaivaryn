/**
 * Restaurant numbers and signals from imported SpotOn sales rows — computed only from real imported rows.
 * Works for daily-summary rows (detail.orderCount = orders that day) and check-level rows (one check each).
 * Signals compare the latest 30 days with the same restaurant's own prior 60 days. Every dollar figure
 * is an ESTIMATE (extra rate × recent sales) and only ever becomes an estimated opportunity.
 */
import { prisma } from "@/lib/prisma";
import { SPOTON_SOURCE } from "./export-format";

export type SpotOnRow = { type: string; status: string; amount: number; occurredAt: Date; locationId: string | null; detailJson: string | null };

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
function detail(row: SpotOnRow): Record<string, unknown> {
  try { return row.detailJson ? (JSON.parse(row.detailJson) as Record<string, unknown>) : {}; } catch { return {}; }
}

export type SpotOnTotals = { orders: number; guests: number; netSales: number; grossSales: number; discounts: number; comps: number; voids: number; refunds: number; refundCount: number; days: number };

export function spotOnTotals(rows: SpotOnRow[], from: Date, to: Date): SpotOnTotals {
  const t: SpotOnTotals = { orders: 0, guests: 0, netSales: 0, grossSales: 0, discounts: 0, comps: 0, voids: 0, refunds: 0, refundCount: 0, days: 0 };
  const days = new Set<string>();
  for (const row of rows) {
    if (row.occurredAt < from || row.occurredAt >= to || row.status !== "SUCCEEDED") continue;
    const d = detail(row);
    if (row.type === "ORDER") {
      t.orders += num(d.orderCount) > 0 ? num(d.orderCount) : 1;
      t.guests += num(d.guests);
      t.netSales += row.amount;
      t.grossSales += num(d.gross);
      t.discounts += num(d.discounts);
      t.comps += num(d.comps);
      t.voids += num(d.voids);
      days.add(row.occurredAt.toISOString().slice(0, 10));
    } else if (row.type === "REFUND") {
      t.refunds += row.amount;
      t.refundCount += num(d.refundCount) > 0 ? num(d.refundCount) : 1;
    }
  }
  return { ...t, netSales: r2(t.netSales), grossSales: r2(t.grossSales), discounts: r2(t.discounts), comps: r2(t.comps), voids: r2(t.voids), refunds: r2(t.refunds), days: days.size };
}

export type SpotOnSummary = {
  days: number;
  totals: SpotOnTotals;
  averageCheck: number;
  byDay: Array<{ day: string; locationName: string; orders: number; netSales: number }>;
  firstAt: Date | null;
  lastAt: Date | null;
  rows: number;
};

export function buildSpotOnSummary(rows: SpotOnRow[], now = new Date(), days = 30): SpotOnSummary {
  const from = new Date(now.getTime() - days * 86_400_000);
  let firstAt: Date | null = null;
  let lastAt: Date | null = null;
  const byDay = new Map<string, { day: string; locationName: string; orders: number; netSales: number }>();
  for (const row of rows) {
    if (!firstAt || row.occurredAt < firstAt) firstAt = row.occurredAt;
    if (!lastAt || row.occurredAt > lastAt) lastAt = row.occurredAt;
    if (row.type !== "ORDER" || row.status !== "SUCCEEDED" || row.occurredAt < from || row.occurredAt > now) continue;
    const d = detail(row);
    const day = row.occurredAt.toISOString().slice(0, 10);
    const key = `${day}|${row.locationId ?? ""}`;
    const cur = byDay.get(key) ?? { day, locationName: String(d.locationName || "Main location"), orders: 0, netSales: 0 };
    cur.orders += num(d.orderCount) > 0 ? num(d.orderCount) : 1;
    cur.netSales = r2(cur.netSales + row.amount);
    byDay.set(key, cur);
  }
  const totals = spotOnTotals(rows, from, new Date(now.getTime() + 1));
  return {
    days,
    totals,
    averageCheck: totals.orders > 0 ? r2(totals.netSales / totals.orders) : 0,
    byDay: Array.from(byDay.values()).sort((a, b) => (a.day === b.day ? a.locationName.localeCompare(b.locationName) : b.day.localeCompare(a.day))),
    firstAt,
    lastAt,
    rows: rows.length,
  };
}

const ROW_SELECT = { type: true, status: true, amount: true, occurredAt: true, locationId: true, detailJson: true } as const;

export async function loadSpotOnRows(organizationId: string, since?: Date) {
  return prisma.transaction.findMany({ where: { organizationId, source: SPOTON_SOURCE, ...(since ? { occurredAt: { gte: since } } : {}) }, select: ROW_SELECT });
}

/** Summary anchored on the latest imported day (exports are point-in-time), falling back to now. */
export async function getSpotOnSummary(organizationId: string, days = 30) {
  const rows = await loadSpotOnRows(organizationId);
  if (!rows.length) return null;
  const last = rows.reduce((m, r) => (r.occurredAt > m ? r.occurredAt : m), rows[0]!.occurredAt);
  return buildSpotOnSummary(rows, new Date(Math.min(Date.now(), last.getTime() + 12 * 3_600_000)), days);
}

export type SpotOnSignal = { ruleId: "spoton_comps_discounts" | "spoton_voids" | "spoton_refunds"; periodKey: string; title: string; description: string; evidence: string; estimate: number };

export const SPOTON_SIGNAL_RULES = { recentDays: 30, baselineDays: 60, minRecentOrders: 100, minBaselineOrders: 150, minRateDeltaPts: 2, minVoidDeltaPts: 1, minEstimate: 250 };

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function detectSpotOnSignals(rows: SpotOnRow[], now = new Date()): { signals: SpotOnSignal[]; insufficient: string | null; recent: SpotOnTotals | null; base: SpotOnTotals | null } {
  const R = SPOTON_SIGNAL_RULES;
  const recentFrom = new Date(now.getTime() - R.recentDays * 86_400_000);
  const baseFrom = new Date(recentFrom.getTime() - R.baselineDays * 86_400_000);
  const recent = spotOnTotals(rows, recentFrom, new Date(now.getTime() + 1));
  const base = spotOnTotals(rows, baseFrom, recentFrom);
  const earliest = rows.reduce<Date | null>((m, r) => (!m || r.occurredAt < m ? r.occurredAt : m), null);
  if (!earliest || earliest > new Date(baseFrom.getTime() + 7 * 86_400_000) || recent.orders < R.minRecentOrders || base.orders < R.minBaselineOrders || recent.grossSales <= 0 || base.grossSales <= 0) {
    return { signals: [], insufficient: "spoton signals: need ~90 days of SpotOn sales (30-day window + 60-day baseline)", recent: null, base: null };
  }
  const periodKey = now.toISOString().slice(0, 7);
  const rate = (x: number, of: number) => (of > 0 ? x / of : 0);
  const out: SpotOnSignal[] = [];

  const rCD = rate(recent.discounts + recent.comps, recent.grossSales);
  const bCD = rate(base.discounts + base.comps, base.grossSales);
  const cdEst = Math.round((rCD - bCD) * recent.grossSales);
  if ((rCD - bCD) * 100 >= R.minRateDeltaPts && cdEst >= R.minEstimate) {
    out.push({
      ruleId: "spoton_comps_discounts", periodKey,
      title: `Comps & discounts above your usual rate (last ${R.recentDays} days)`,
      description: `Your SpotOn sales export shows comps + discounts at ${pct(rCD)} of sales in the last ${R.recentDays} days vs ${pct(bCD)} over the prior ${R.baselineDays} days (comps ${usd(recent.comps)}, discounts ${usd(recent.discounts)} on ${usd(recent.grossSales)} sales). Estimate = the extra rate × recent sales. It's an estimate, not money recovered.`,
      evidence: `spoton comps+discounts ${pct(rCD)} vs baseline ${pct(bCD)}; sales ${recent.grossSales.toFixed(2)}`,
      estimate: cdEst,
    });
  }
  const rV = rate(recent.voids, recent.grossSales + recent.voids);
  const bV = rate(base.voids, base.grossSales + base.voids);
  const vEst = Math.round((rV - bV) * (recent.grossSales + recent.voids));
  if ((rV - bV) * 100 >= R.minVoidDeltaPts && vEst >= R.minEstimate) {
    out.push({
      ruleId: "spoton_voids", periodKey,
      title: `Voids above your usual rate (last ${R.recentDays} days)`,
      description: `Your SpotOn sales export shows voids at ${pct(rV)} of rung-up sales in the last ${R.recentDays} days vs ${pct(bV)} over the prior ${R.baselineDays} days (${usd(recent.voids)} voided). Estimate = the extra rate × recent rung-up sales. Some voids are honest mistakes, so this is an estimate to review, not money recovered.`,
      evidence: `spoton voids ${pct(rV)} vs baseline ${pct(bV)}; voided ${recent.voids.toFixed(2)}`,
      estimate: vEst,
    });
  }
  const rR = rate(recent.refunds, recent.netSales);
  const bR = rate(base.refunds, base.netSales);
  const rEst = Math.round((rR - bR) * recent.netSales);
  if ((rR - bR) * 100 >= R.minRateDeltaPts && rEst >= R.minEstimate) {
    out.push({
      ruleId: "spoton_refunds", periodKey,
      title: `Refunds above your usual rate (last ${R.recentDays} days)`,
      description: `Your SpotOn sales export shows refunds at ${pct(rR)} of net sales in the last ${R.recentDays} days vs ${pct(bR)} over the prior ${R.baselineDays} days (${usd(recent.refunds)} across ${recent.refundCount} refunds). Estimate = the extra rate × recent net sales. It's an estimate, not money recovered.`,
      evidence: `spoton refunds ${pct(rR)} vs baseline ${pct(bR)}; net ${recent.netSales.toFixed(2)}`,
      estimate: rEst,
    });
  }
  return { signals: out, insufficient: null, recent, base };
}
