/**
 * Threshold metrics for prompted automations ("alert me if leakage is over $50k").
 * Every value is measured from tenant data at run time. Estimates stay labelled as estimates
 * and are never mixed with recorded (realized/verified) outcomes.
 */
import { prisma } from "@/lib/prisma";
import { RR_CLOSED_STATUSES, OE_CLOSED_STATUSES } from "@/lib/money-glossary";
import type { MetricKey } from "./automation-prompt";
import { METRIC_IS_MONEY, METRIC_LABEL, formatMoneyShort } from "./automation-prompt";

export async function measureMetric(organizationId: string, metric: MetricKey): Promise<number> {
  const rrClosed = [...RR_CLOSED_STATUSES];
  const oeClosed = [...OE_CLOSED_STATUSES];
  switch (metric) {
    case "OPEN_RR_ESTIMATE": {
      const a = await prisma.opportunity.aggregate({ where: { organizationId, status: { notIn: rrClosed } }, _sum: { potentialAmount: true } });
      return Math.round((a._sum.potentialAmount ?? 0) * 100) / 100;
    }
    case "OPEN_OE_ESTIMATE": {
      const a = await prisma.inefficiency.aggregate({ where: { organizationId, status: { notIn: oeClosed } }, _sum: { projectedSavings: true } });
      return Math.round((a._sum.projectedSavings ?? 0) * 100) / 100;
    }
    case "CRITICAL_ITEMS": {
      const [o, i] = await Promise.all([
        prisma.opportunity.count({ where: { organizationId, priority: "CRITICAL", status: { notIn: rrClosed } } }),
        prisma.inefficiency.count({ where: { organizationId, priority: "CRITICAL", status: { notIn: oeClosed } } }),
      ]);
      return o + i;
    }
    case "PENDING_APPROVALS":
      return prisma.approvalRequest.count({ where: { organizationId, status: "PENDING" } });
    case "FAILED_RUNS_24H":
      return prisma.opRun.count({ where: { organizationId, status: "FAILED", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  }
}

export function formatMetricValue(metric: MetricKey, v: number) {
  return METRIC_IS_MONEY[metric] ? formatMoneyShort(v) : String(v);
}

export function metricHref(metric: MetricKey) {
  return metric === "OPEN_RR_ESTIMATE" ? "/app/revenue" : metric === "OPEN_OE_ESTIMATE" ? "/app/operations" : metric === "PENDING_APPROVALS" ? "/app/approvals" : metric === "FAILED_RUNS_24H" ? "/app/automations#runs" : "/app/action-center";
}

export function metricSentence(metric: MetricKey, value: number, op: "gt" | "lt", amount: number, met: boolean) {
  const label = METRIC_LABEL[metric];
  const v = formatMetricValue(metric, value);
  const t = formatMetricValue(metric, amount);
  return met
    ? `${label}: ${v} — ${op === "gt" ? "over" : "under"} your ${t} threshold`
    : `${label}: ${v} — within your ${t} threshold, no alert`;
}
