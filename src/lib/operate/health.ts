/**
 * Operate health — renovated from 720 SI Operate (health checks, ticks, rollups).
 * Measured only: every component reports what was actually observed. Missing = labeled missing.
 */
import { prisma } from "@/lib/prisma";
import type { OpCtx } from "./context";
import { safeJson } from "./context";

export type HealthTone = "OK" | "DEGRADED" | "DOWN" | "INFO";
export type HealthComponent = { key: string; label: string; status: HealthTone; detail: string; latencyMs?: number };
export type HealthSnapshot = {
  id: string;
  status: "OK" | "DEGRADED" | "DOWN";
  components: HealthComponent[];
  latencyMs: number;
  createdAt: Date;
};

const DAY = 24 * 60 * 60 * 1000;

export async function runHealthCheck(ctx: OpCtx, source: "MANUAL" | "COMMAND" | "STANDING_ORDER" | "TICK" = "MANUAL"): Promise<HealthSnapshot> {
  const started = Date.now();
  const orgId = ctx.organizationId;
  const components: HealthComponent[] = [];

  const dbStart = Date.now();
  let dbOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }
  const dbLatency = Date.now() - dbStart;
  components.push({
    key: "database",
    label: "Database",
    status: dbOk ? (dbLatency > 1500 ? "DEGRADED" : "OK") : "DOWN",
    detail: dbOk ? `Responded in ${dbLatency} ms` : "Database query failed",
    latencyMs: dbLatency,
  });

  if (dbOk) {
    const now = Date.now();
    const [entitlements, lastRr, lastOe, lastDetection, overdueOrders, failedOrders, failedRuns, waitingRuns, integrations] = await Promise.all([
      prisma.entitlement.findMany({ where: { organizationId: orgId, active: true }, select: { product: true } }),
      prisma.siCognitionCycle.findFirst({ where: { organizationId: orgId, product: "REVENUE_RECOVERY", status: "succeeded" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }),
      prisma.siCognitionCycle.findFirst({ where: { organizationId: orgId, product: "OPERATIONS_EFFICIENCY", status: "succeeded" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }),
      prisma.intelligenceRun.findFirst({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, select: { status: true, createdAt: true } }),
      prisma.opStandingOrder.count({ where: { organizationId: orgId, enabled: true, nextRunAt: { lt: new Date(now - 60 * 60 * 1000) } } }),
      prisma.opStandingOrder.count({ where: { organizationId: orgId, enabled: true, lastStatus: "FAILED" } }),
      prisma.opRun.count({ where: { organizationId: orgId, status: "FAILED", createdAt: { gte: new Date(now - DAY) } } }),
      prisma.opRun.count({ where: { organizationId: orgId, status: "WAITING_APPROVAL" } }),
      prisma.integrationConnection.findMany({ where: { organizationId: orgId }, select: { provider: true, displayName: true, status: true } }),
    ]);
    const products = new Set(entitlements.map((e) => e.product));

    const engine = (label: string, key: string, product: string, last: { completedAt: Date | null } | null) => {
      if (!products.has(product)) {
        components.push({ key, label, status: "INFO", detail: "Not in this organization's plan" });
        return;
      }
      if (!last?.completedAt) {
        components.push({ key, label, status: "DEGRADED", detail: "No completed nine-return cycle yet — run Analyze" });
        return;
      }
      const ageDays = Math.floor((now - last.completedAt.getTime()) / DAY);
      components.push({
        key,
        label,
        status: ageDays > 7 ? "DEGRADED" : "OK",
        detail: ageDays === 0 ? "Last cycle completed today" : `Last cycle completed ${ageDays} day${ageDays === 1 ? "" : "s"} ago${ageDays > 7 ? " — stale" : ""}`,
      });
    };
    engine("Revenue Recovery intelligence", "engine_rr", "REVENUE_RECOVERY", lastRr);
    engine("Operations Efficiency intelligence", "engine_oe", "OPERATIONS_EFFICIENCY", lastOe);

    components.push({
      key: "detection",
      label: "Detection engines",
      status: !lastDetection ? "INFO" : lastDetection.status === "FAILED" ? "DEGRADED" : "OK",
      detail: !lastDetection ? "No detection run recorded yet" : `Last run ${lastDetection.status.toLowerCase()} · ${lastDetection.createdAt.toISOString().slice(0, 10)}`,
    });

    components.push({
      key: "schedules",
      label: "Standing orders",
      status: overdueOrders > 0 || failedOrders > 0 ? "DEGRADED" : "OK",
      detail:
        overdueOrders || failedOrders
          ? `${overdueOrders} overdue · ${failedOrders} last run failed`
          : "No overdue or failing standing orders",
    });

    components.push({
      key: "runs",
      label: "Playbook & job runs",
      status: failedRuns > 0 ? "DEGRADED" : "OK",
      detail: `${failedRuns} failed in last 24h · ${waitingRuns} waiting on approval`,
    });

    const connected = integrations.filter((i) => i.status === "CONNECTED");
    const missing = integrations.filter((i) => i.status !== "CONNECTED");
    components.push({
      key: "integrations",
      label: "Integrations",
      status: "INFO",
      detail: `${connected.length} connected${connected.length ? ` (${connected.map((c) => c.displayName).join(", ")})` : ""} · ${missing.length} not connected — labeled, never assumed`,
    });

    components.push(await schedulerHealthComponent(orgId, now));
  }

  const status: HealthSnapshot["status"] = components.some((c) => c.status === "DOWN")
    ? "DOWN"
    : components.some((c) => c.status === "DEGRADED")
    ? "DEGRADED"
    : "OK";
  const latencyMs = Date.now() - started;

  if (!dbOk) {
    return { id: "unpersisted", status, components, latencyMs, createdAt: new Date() };
  }
  const row = await prisma.opHealthCheck.create({
    data: { organizationId: orgId, status, componentsJson: JSON.stringify(components), source, latencyMs },
  });
  return { id: row.id, status, components, latencyMs, createdAt: row.createdAt };
}

export async function listHealthChecks(ctx: OpCtx, take = 30) {
  const rows = await prisma.opHealthCheck.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((r) => ({ ...r, components: safeJson<HealthComponent[]>(r.componentsJson, []) }));
}

/** Rollup over recorded checks — SI operatingRollup equivalent (measured history only). */
export async function healthRollup(ctx: OpCtx, days = 14) {
  const since = new Date(Date.now() - days * DAY);
  const rows = await prisma.opHealthCheck.findMany({
    where: { organizationId: ctx.organizationId, createdAt: { gte: since } },
    select: { status: true, createdAt: true, latencyMs: true },
    orderBy: { createdAt: "asc" },
  });
  const byDay = new Map<string, { day: string; ok: number; degraded: number; down: number }>();
  for (const r of rows) {
    const day = r.createdAt.toISOString().slice(5, 10);
    const b = byDay.get(day) ?? { day, ok: 0, degraded: 0, down: 0 };
    if (r.status === "OK") b.ok++;
    else if (r.status === "DEGRADED") b.degraded++;
    else b.down++;
    byDay.set(day, b);
  }
  const total = rows.length;
  const okCount = rows.filter((r) => r.status === "OK").length;
  return {
    total,
    okRate: total ? Math.round((okCount / total) * 100) : null,
    series: Array.from(byDay.values()),
  };
}

/** Live scheduler status (token configured, last platform tick, last automatic run here, next due). */
export async function schedulerHealthComponent(orgId: string, now: number = Date.now()): Promise<HealthComponent> {
  const tickConfigured = Boolean(process.env.OPERATE_TICK_TOKEN && process.env.OPERATE_TICK_TOKEN.length >= 16);
  const [lastTick, lastAuto, nextDue] = await Promise.all([
    prisma.opSchedulerTick.findFirst({ orderBy: { startedAt: "desc" }, select: { startedAt: true, status: true, source: true } }),
    prisma.opStandingOrder.findFirst({ where: { organizationId: orgId, lastResultJson: { contains: '"trigger":"TICK"' } }, orderBy: { lastRunAt: "desc" }, select: { lastRunAt: true, title: true } }),
    prisma.opStandingOrder.findFirst({ where: { organizationId: orgId, enabled: true, nextRunAt: { not: null } }, orderBy: { nextRunAt: "asc" }, select: { nextRunAt: true } }),
  ]);
  const ago = (d: Date) => {
    const m = Math.max(0, Math.round((now - d.getTime()) / 60000));
    return m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
  };
  const et = (d: Date) => `${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d)} ET`;
  const tickAgeH = lastTick ? (now - lastTick.startedAt.getTime()) / 3_600_000 : null;
  const sourceLabel = lastTick?.source === "github-actions" ? "GitHub Actions" : lastTick?.source ?? "external scheduler";
  return {
    key: "scheduler",
    label: "Scheduler",
    status: !tickConfigured ? "INFO" : !lastTick ? "INFO" : lastTick.status === "FAILED" || (tickAgeH ?? 0) > 6 ? "DEGRADED" : "OK",
    detail: !tickConfigured
      ? "Not configured. Standing orders run only when you press Run due now."
      : [
          lastTick
            ? "Configured — an external scheduler calls the secure tick (requested every 15 minutes; GitHub may delay scheduled runs)."
            : "Configured — secure tick token is set; waiting for the external scheduler's first call.",
          lastTick
            ? `Last tick ${et(lastTick.startedAt)} (${ago(lastTick.startedAt)}) via ${sourceLabel}${lastTick.status === "FAILED" ? " — failed" : ""}${(tickAgeH ?? 0) > 6 ? " — overdue" : ""}.`
            : "",
          lastAuto?.lastRunAt ? `Last automatic run here: ${et(lastAuto.lastRunAt)}.` : "No automatic run in this workspace yet.",
          nextDue?.nextRunAt ? `Next due: ${et(nextDue.nextRunAt)}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
  };
}
