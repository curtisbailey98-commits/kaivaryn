/**
 * Standing orders — renovated from 720 SI standing_orders (cron-like owner directives).
 * Prompted automations: a plain-English prompt is parsed (deterministically) into a schedule,
 * time zone, action steps, optional threshold, and delivery, previewed, then saved here.
 * Free-plan honesty: no always-on worker. Due orders run on "Run due now" or the authenticated
 * scheduler tick (external cron → POST /api/operate/tick). Ticks claim each order atomically so
 * a retried or overlapping tick never runs the same order twice.
 */
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import type { OpCtx } from "./context";
import { OpError, requireOpPermission, safeJson } from "./context";
import { createRun, executeRun, normalizeSteps, resolveActorId, type RunStep } from "./runs";
import { inferProduct } from "./router";
import { runPlaybook, findPlaybook, listPlaybooks } from "./playbooks";
import { computeNextRun, describeSchedule, nextRuns, normalizeSchedule, safeTimezone, DEFAULT_TIMEZONE, isValidTimezone, type ScheduleSpec } from "./schedule";
import {
  parseAutomationPrompt,
  draftTitle,
  describeAction,
  describeCondition,
  METRIC_LABEL,
  type AutomationAction,
  type AutomationCondition,
  type AutomationDraft,
  type MetricKey,
} from "./automation-prompt";

export type Cadence = "HOURLY" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "MONTHLY";
export type StandingKind = "ANALYZE" | "STATUS" | "DIGEST" | "PLAYBOOK" | "DETECT" | "RECALL" | "WATCH" | "MULTI";
export type RunTrigger = "TICK" | "RUN_DUE" | "MANUAL";

export const CADENCE_LABEL: Record<Cadence, string> = {
  HOURLY: "Every hour",
  DAILY: "Every day",
  WEEKDAYS: "Every weekday",
  WEEKLY: "Every week",
  MONTHLY: "Every month",
};

export function parseCadence(text: string): Cadence | null {
  const t = text.toLowerCase();
  if (/\bevery\s+hour\b|\bhourly\b|\beach hour\b/.test(t)) return "HOURLY";
  if (/\bevery\s+week\b|\bweekly\b|\beach week\b|\bevery\s+(monday|tuesday|wednesday|thursday|friday)\b/.test(t)) return "WEEKLY";
  if (/\bevery\s+(day|morning|evening)\b|\bdaily\b|\beach (day|morning)\b/.test(t)) return "DAILY";
  return null;
}

export function stripCadence(text: string): string {
  return (
    text
      .replace(/^(standing( order)?|schedule)\s*:?\s*/i, "")
      .replace(/\b(every|each)\s+(hour|day|morning|evening|week|monday|tuesday|wednesday|thursday|friday)\b/gi, "")
      .replace(/\b(hourly|daily|weekly)\b/gi, "")
      .replace(/^\s*(,|:|-)\s*/, "")
      .replace(/\s+/g, " ")
      .trim() || "status"
  );
}

export function inferStandingKind(directive: string): { kind: StandingKind; playbookSlug?: string } {
  const t = directive.toLowerCase();
  const pb = t.match(/\b(?:run\s+)?playbook\s+([a-z0-9-]+)/);
  if (pb) return { kind: "PLAYBOOK", playbookSlug: pb[1] };
  if (/\bdigest\b|\bbrief\b|\bsummar/.test(t)) return { kind: "DIGEST" };
  if (/\bstatus\b|\bhealth\b/.test(t)) return { kind: "STATUS" };
  return { kind: "ANALYZE" };
}

/** Legacy interval for orders created before prompted automations (no scheduleJson). */
export function computeNextRunAt(cadence: Cadence, from: Date = new Date()): Date {
  const ms = from.getTime();
  const h = 60 * 60 * 1000;
  return new Date(ms + (cadence === "HOURLY" ? h : cadence === "DAILY" || cadence === "WEEKDAYS" ? 24 * h : cadence === "MONTHLY" ? 30 * 24 * h : 7 * 24 * h));
}

type OrderLike = { cadence: string; scheduleJson?: string | null; timezone?: string | null };

export function orderSchedule(order: OrderLike): { spec: ScheduleSpec; timezone: string } | null {
  const spec = normalizeSchedule(safeJson<unknown>(order.scheduleJson, null));
  return spec ? { spec, timezone: safeTimezone(order.timezone) } : null;
}

/** Next due time for any order: wall-clock schedule when present, legacy interval otherwise. */
export function nextRunForOrder(order: OrderLike, from: Date = new Date()): Date {
  const s = orderSchedule(order);
  return s ? computeNextRun(s.spec, s.timezone, from) : computeNextRunAt(order.cadence as Cadence, from);
}

export function describeOrderSchedule(order: OrderLike): string {
  const s = orderSchedule(order);
  return s ? describeSchedule(s.spec, s.timezone) : `${CADENCE_LABEL[order.cadence as Cadence] ?? order.cadence} (from when it was created or last ran)`;
}

export type StoredAction = { actions: AutomationAction[]; steps: RunStep[] };

export function orderActions(order: { actionJson?: string | null }): StoredAction | null {
  const a = safeJson<StoredAction | null>(order.actionJson, null);
  if (!a || !Array.isArray(a.steps)) return null;
  return { actions: Array.isArray(a.actions) ? a.actions : [], steps: normalizeSteps(a.steps) };
}

export function orderCondition(order: { conditionJson?: string | null }): AutomationCondition | null {
  const c = safeJson<AutomationCondition | null>(order.conditionJson, null);
  if (!c || !(c.metric in METRIC_LABEL) || !Number.isFinite(Number(c.amount))) return null;
  return { metric: c.metric as MetricKey, op: c.op === "lt" ? "lt" : "gt", amount: Number(c.amount) };
}

export function stepsForKind(kind: StandingKind, directive: string): RunStep[] {
  if (kind === "DIGEST") return [{ kind: "BRIEF" }];
  if (kind === "STATUS") return [{ kind: "STATUS" }];
  if (kind === "DETECT") return [{ kind: "DETECT" }];
  if (kind === "RECALL") return [{ kind: "RECALL" }];
  return [{ kind: "ANALYZE", product: inferProduct(directive), intent: directive }];
}

/** Organization time zone (OrgSettings.settingsJson.timezone), default America/New_York. */
export async function orgTimezone(organizationId: string): Promise<string> {
  const s = await prisma.orgSettings.findUnique({ where: { organizationId }, select: { settingsJson: true } });
  const tz = safeJson<{ timezone?: string }>(s?.settingsJson, {}).timezone;
  return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

export type AutomationPreview = {
  draft: AutomationDraft;
  title: string;
  scheduleText: string | null;
  actionsText: string[];
  conditionText: string | null;
  nextRuns: Date[];
};

/** Parse a prompt for this tenant (its playbooks + time zone). Read-only — nothing is saved. */
export async function previewAutomationPrompt(ctx: OpCtx, prompt: string): Promise<AutomationPreview> {
  const [playbooks, tz] = await Promise.all([listPlaybooks(ctx), orgTimezone(ctx.organizationId)]);
  const draft = parseAutomationPrompt(prompt, { timezone: tz, playbooks: playbooks.map((p) => ({ slug: p.slug, name: p.name })) });
  return {
    draft,
    title: draftTitle(draft),
    scheduleText: draft.schedule ? describeSchedule(draft.schedule, draft.timezone) : null,
    actionsText: draft.actions.map(describeAction),
    conditionText: draft.condition ? describeCondition(draft.condition) : null,
    nextRuns: draft.schedule ? nextRuns(draft.schedule, draft.timezone, new Date(), 3) : [],
  };
}

export type AutomationInput = {
  schedule: ScheduleSpec | unknown;
  timezone?: string | null;
  actions: AutomationAction[];
  condition?: AutomationCondition | null;
  title?: string | null;
  prompt?: string | null;
};

const ACTION_KINDS = new Set(["ANALYZE", "DIGEST", "STATUS", "DETECT", "RECALL", "PLAYBOOK", "WATCH"]);

/** Create a standing order from a confirmed (and possibly edited) automation spec. */
export async function createAutomation(ctx: OpCtx, input: AutomationInput) {
  requireOpPermission(ctx, "write");
  const schedule = normalizeSchedule(input.schedule);
  if (!schedule) throw new OpError("schedule_invalid", "Choose how often this runs (hourly, daily, weekdays, weekly, or monthly).");
  const timezone = input.timezone && isValidTimezone(input.timezone) ? input.timezone : await orgTimezone(ctx.organizationId);
  let condition: AutomationCondition | null = null;
  if (input.condition) {
    const amount = Number(input.condition.amount);
    if (!(input.condition.metric in METRIC_LABEL) || !Number.isFinite(amount) || amount < 0) throw new OpError("condition_invalid", "Threshold needs a measure and a non-negative amount.");
    condition = { metric: input.condition.metric, op: input.condition.op === "lt" ? "lt" : "gt", amount };
  }
  const actions = (input.actions ?? []).filter((a) => a && ACTION_KINDS.has(a.kind)).slice(0, 4);
  if (!actions.length) throw new OpError("action_missing", "Choose what the automation should do.");
  if (actions.length === 1 && actions[0]!.kind === "WATCH" && !condition) throw new OpError("condition_missing", "A threshold check needs a threshold, e.g. leakage over $50k.");

  const steps: RunStep[] = [];
  let playbookId: string | null = null;
  const resolved: AutomationAction[] = [];
  for (const a of actions) {
    if (a.kind === "PLAYBOOK") {
      const pb = await findPlaybook(ctx, a.playbookSlug || a.playbookName || "");
      if (!pb) throw new OpError("not_found", `Playbook “${a.playbookName ?? a.playbookSlug ?? ""}” not found in this organization`, 404);
      playbookId = playbookId ?? pb.id;
      steps.push(...normalizeSteps(safeJson(pb.stepsJson, [])));
      resolved.push({ kind: "PLAYBOOK", playbookSlug: pb.slug, playbookName: pb.name });
    } else if (a.kind === "ANALYZE") {
      const product = a.product === "REVENUE_RECOVERY" || a.product === "OPERATIONS_EFFICIENCY" ? a.product : "BOTH";
      steps.push({ kind: "ANALYZE", product, intent: (input.prompt || "Scheduled analysis").slice(0, 300) });
      resolved.push({ kind: "ANALYZE", product });
    } else if (a.kind === "DIGEST") {
      steps.push({ kind: "BRIEF" });
      resolved.push(a);
    } else if (a.kind === "STATUS") {
      steps.push({ kind: "STATUS" });
      resolved.push(a);
    } else if (a.kind === "DETECT") {
      steps.push({ kind: "DETECT" });
      resolved.push(a);
    } else if (a.kind === "RECALL") {
      steps.push({ kind: "RECALL" });
      resolved.push(a);
    } else if (a.kind === "WATCH") {
      resolved.push(a);
    }
  }
  if (condition) steps.push({ kind: "CHECK", metric: condition.metric, op: condition.op, amount: condition.amount });
  if (!steps.length) throw new OpError("action_missing", "Choose what the automation should do.");

  const kind: StandingKind = resolved.length === 1 ? (resolved[0]!.kind as StandingKind) : "MULTI";
  const title = (input.title?.trim() || draftTitle({ actions: resolved, condition, schedule, timezone })).slice(0, 160);
  const directive = (input.prompt?.trim() || [resolved.map(describeAction).join(" + "), condition ? describeCondition(condition) : ""].filter(Boolean).join(" · ")).slice(0, 300);
  const nextRunAt = computeNextRun(schedule, timezone, new Date());
  const row = await prisma.opStandingOrder.create({
    data: {
      organizationId: ctx.organizationId,
      title,
      directive,
      kind,
      cadence: schedule.cadence,
      playbookId: kind === "PLAYBOOK" ? playbookId : null,
      nextRunAt,
      createdById: ctx.userId,
      prompt: input.prompt?.trim().slice(0, 600) || null,
      scheduleJson: JSON.stringify(schedule),
      timezone,
      actionJson: JSON.stringify({ actions: resolved, steps } satisfies StoredAction),
      conditionJson: condition ? JSON.stringify(condition) : null,
      delivery: "INBOX",
    },
  });
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: "standing_order.created",
    entityType: "OpStandingOrder",
    entityId: row.id,
    metadata: { kind, cadence: schedule.cadence, timezone, source: input.prompt ? "prompt" : "form", condition: condition?.metric ?? null, nextRunAt: nextRunAt.toISOString() },
  });
  return row;
}

/** Prompt → saved automation in one call (API/Command confirm). Refuses drafts with open problems. */
export async function createAutomationFromPrompt(ctx: OpCtx, prompt: string, overrides?: { title?: string | null }) {
  requireOpPermission(ctx, "write");
  const p = await previewAutomationPrompt(ctx, prompt);
  if (!p.draft.ok || !p.draft.schedule) {
    throw new OpError("prompt_unparsed", p.draft.problems[0] ?? "Couldn't turn that into an automation — use the form to fill in the missing parts.");
  }
  return createAutomation(ctx, { schedule: p.draft.schedule, timezone: p.draft.timezone, actions: p.draft.actions, condition: p.draft.condition, title: overrides?.title ?? null, prompt });
}

export async function createStandingOrder(
  ctx: OpCtx,
  input: { directive: string; cadence?: Cadence | string | null; title?: string; kind?: StandingKind; playbookId?: string | null },
) {
  requireOpPermission(ctx, "write");
  const cadence = (["HOURLY", "DAILY", "WEEKLY"].includes(String(input.cadence)) ? input.cadence : parseCadence(input.directive)) as Cadence | null;
  if (!cadence) throw new OpError("cadence_unparsed", "Standing order needs a cadence: every hour, every day, or every week.");
  const directive = stripCadence(input.directive).slice(0, 300);
  const inferred = inferStandingKind(directive);
  const kind = input.kind ?? inferred.kind;
  let playbookId = input.playbookId ?? null;
  if (kind === "PLAYBOOK") {
    const pb = await findPlaybook(ctx, playbookId || inferred.playbookSlug || "");
    if (!pb) throw new OpError("not_found", "Playbook for standing order not found in this organization", 404);
    playbookId = pb.id;
  } else {
    playbookId = null;
  }
  const row = await prisma.opStandingOrder.create({
    data: {
      organizationId: ctx.organizationId,
      title: (input.title || `${CADENCE_LABEL[cadence]} · ${directive}`).slice(0, 160),
      directive,
      kind,
      cadence,
      playbookId,
      nextRunAt: computeNextRunAt(cadence),
      createdById: ctx.userId,
    },
  });
  await writeAudit({ organizationId: ctx.organizationId, actorId: ctx.userId, action: "standing_order.created", entityType: "OpStandingOrder", entityId: row.id, metadata: { kind, cadence } });
  return row;
}

export async function listStandingOrders(ctx: OpCtx) {
  return prisma.opStandingOrder.findMany({ where: { organizationId: ctx.organizationId }, orderBy: [{ enabled: "desc" }, { createdAt: "desc" }] });
}

export async function setStandingOrderEnabled(ctx: OpCtx, id: string, enabled: boolean) {
  requireOpPermission(ctx, "write");
  const row = await prisma.opStandingOrder.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!row) throw new OpError("not_found", "Standing order not found in this organization", 404);
  const updated = await prisma.opStandingOrder.update({
    where: { id: row.id },
    data: { enabled, nextRunAt: enabled ? nextRunForOrder(row) : row.nextRunAt },
  });
  await writeAudit({ organizationId: ctx.organizationId, actorId: ctx.userId, action: enabled ? "standing_order.resumed" : "standing_order.paused", entityType: "OpStandingOrder", entityId: row.id });
  return updated;
}

export async function deleteStandingOrder(ctx: OpCtx, id: string) {
  requireOpPermission(ctx, "write");
  const res = await prisma.opStandingOrder.deleteMany({ where: { id, organizationId: ctx.organizationId } });
  if (res.count) await writeAudit({ organizationId: ctx.organizationId, actorId: ctx.userId, action: "standing_order.deleted", entityType: "OpStandingOrder", entityId: id });
  return res.count;
}

/** Execute one standing order now (permission checked by caller or skipped for authenticated tick). */
export async function runStandingOrder(ctx: OpCtx, id: string, opts?: { skipPermission?: boolean; trigger?: RunTrigger; claimed?: boolean }) {
  if (!opts?.skipPermission) requireOpPermission(ctx, "run_intelligence");
  const trigger: RunTrigger = opts?.trigger ?? "MANUAL";
  const order = await prisma.opStandingOrder.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!order) throw new OpError("not_found", "Standing order not found in this organization", 404);
  const runCtx: OpCtx = { ...ctx, userId: ctx.userId ?? order.createdById };
  const stored = orderActions(order);
  let status: "SUCCEEDED" | "FAILED" = "FAILED";
  let runId: string | null = null;
  let error: string | null = null;
  let summary: string | null = null;
  try {
    if (order.kind === "PLAYBOOK" && order.playbookId && !stored) {
      const { run } = await runPlaybook(runCtx, order.playbookId, { source: "STANDING_ORDER", sourceId: order.id, skipPermission: true });
      runId = run.id;
      status = run.status === "FAILED" || run.status === "CANCELLED" ? "FAILED" : "SUCCEEDED";
      error = run.error;
    } else {
      const steps = stored?.steps.length ? stored.steps : stepsForKind(order.kind as StandingKind, order.directive);
      const run = await createRun(runCtx, { title: order.title, steps, source: "STANDING_ORDER", sourceId: order.id });
      const done = await executeRun(runCtx, run.id);
      runId = done.id;
      status = done.status === "SUCCEEDED" || done.status === "WAITING_APPROVAL" ? "SUCCEEDED" : "FAILED";
      error = done.error;
      const ev = safeJson<Array<{ summary?: string }>>(done.evidenceJson, []);
      summary = ev[ev.length - 1]?.summary ?? null;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const now = new Date();
  const updated = await prisma.opStandingOrder.update({
    where: { id: order.id },
    data: {
      lastRunAt: now,
      // A tick already advanced nextRunAt when it claimed the order; manual runs reschedule from now.
      ...(opts?.claimed ? {} : { nextRunAt: nextRunForOrder(order, now) }),
      lastStatus: status,
      lastResultJson: JSON.stringify({ ok: status === "SUCCEEDED", runId, error, trigger, at: now.toISOString() }),
      runCount: { increment: 1 },
      ...(status === "FAILED" ? { failureCount: { increment: 1 } } : {}),
    },
  });

  // Delivery: Inbox. Automatic runs leave a notification for the owner (hourly ones only on failure;
  // briefings already land in the Inbox; threshold alerts are sent by the check step itself).
  if (trigger === "TICK") {
    const quiet = order.cadence === "HOURLY" || order.kind === "DIGEST" || order.kind === "WATCH";
    if (status === "FAILED" || !quiet) {
      const owner = await resolveActorId(runCtx, order.createdById);
      if (owner) {
        await notify({
          organizationId: ctx.organizationId,
          userId: owner,
          title: `${status === "FAILED" ? "Automation failed" : "Automation ran"} · ${order.title}`.slice(0, 200),
          body: (status === "FAILED" ? error ?? "Run failed" : summary ?? "Completed").slice(0, 500),
          href: runId ? `/app/automations?run=${runId}` : "/app/automations",
        }).catch(() => undefined);
      }
    }
  }
  return updated;
}

/**
 * Run every due standing order for one organization. Each order is claimed with a compare-and-set
 * on nextRunAt, so two overlapping ticks (or a tick plus "Run due now") cannot run it twice.
 */
export async function runDueStandingOrders(ctx: OpCtx, opts?: { skipPermission?: boolean; limit?: number; trigger?: RunTrigger }) {
  if (!opts?.skipPermission) requireOpPermission(ctx, "run_intelligence");
  const now = new Date();
  const due = await prisma.opStandingOrder.findMany({
    where: { organizationId: ctx.organizationId, enabled: true, nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: opts?.limit ?? 10,
  });
  const results = [];
  for (const o of due) {
    const claim = await prisma.opStandingOrder.updateMany({
      where: { id: o.id, organizationId: ctx.organizationId, enabled: true, nextRunAt: o.nextRunAt },
      data: { nextRunAt: nextRunForOrder(o, now) },
    });
    if (claim.count !== 1) continue; // another tick already took it
    results.push(await runStandingOrder(ctx, o.id, { skipPermission: true, trigger: opts?.trigger ?? "RUN_DUE", claimed: true }));
  }
  return results;
}

/** Platform tick (token-authenticated route): iterate orgs with due orders. Each org is processed in its own context. */
export async function tickAllOrganizations(limitOrgs = 25) {
  const due = await prisma.opStandingOrder.findMany({
    where: { enabled: true, nextRunAt: { lte: new Date() } },
    select: { organizationId: true },
    distinct: ["organizationId"],
    take: limitOrgs,
  });
  const out: Array<{ organizationId: string; ran: number }> = [];
  for (const { organizationId } of due) {
    const ctx: OpCtx = { organizationId, userId: null, role: "SYSTEM" };
    const r = await runDueStandingOrders(ctx, { skipPermission: true, limit: 5, trigger: "TICK" });
    out.push({ organizationId, ran: r.length });
  }
  return out;
}

export type TickResult = { tickId: string; tickKey: string; replay: boolean; status: string; organizations: number; ran: number; startedAt: Date; finishedAt: Date | null };

/**
 * Idempotent platform tick. The same tickKey (e.g. the GitHub run id) never executes twice:
 * a retry after a timeout gets the recorded result (or "RUNNING") instead of a second pass.
 */
export async function platformTick(input?: { tickKey?: string | null; source?: string | null }): Promise<TickResult> {
  const tickKey = (input?.tickKey || `auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 120);
  const source = (input?.source || "external").replace(/[^a-z0-9._-]/gi, "").slice(0, 40) || "external";
  const shape = (t: { id: string; tickKey: string; status: string; organizations: number; ran: number; startedAt: Date; finishedAt: Date | null }, replay: boolean): TickResult => ({
    tickId: t.id,
    tickKey: t.tickKey,
    replay,
    status: t.status,
    organizations: t.organizations,
    ran: t.ran,
    startedAt: t.startedAt,
    finishedAt: t.finishedAt,
  });
  const prior = await prisma.opSchedulerTick.findUnique({ where: { tickKey } });
  if (prior) return shape(prior, true);
  // Insert-if-absent: the unique tickKey decides which concurrent caller executes.
  const ins = await prisma.opSchedulerTick.createMany({ data: [{ tickKey, source, status: "RUNNING" }], skipDuplicates: true });
  const row = await prisma.opSchedulerTick.findUnique({ where: { tickKey } });
  if (!row) throw new OpError("tick_failed", "Could not record scheduler tick", 500);
  if (ins.count !== 1) return shape(row, true);
  try {
    const orgs = await tickAllOrganizations();
    const done = await prisma.opSchedulerTick.update({
      where: { id: row.id },
      data: { status: "SUCCEEDED", organizations: orgs.length, ran: orgs.reduce((s, o) => s + o.ran, 0), finishedAt: new Date() },
    });
    return shape(done, false);
  } catch (e) {
    const failed = await prisma.opSchedulerTick.update({
      where: { id: row.id },
      data: { status: "FAILED", error: (e instanceof Error ? e.message : String(e)).slice(0, 500), finishedAt: new Date() },
    });
    return shape(failed, false);
  }
}

export function tickTokenConfigured() {
  return Boolean(process.env.OPERATE_TICK_TOKEN && process.env.OPERATE_TICK_TOKEN.length >= 16);
}

/** Last recorded platform tick (timing + status only — no other tenant's data). */
export async function lastSchedulerTick() {
  return prisma.opSchedulerTick.findFirst({ orderBy: { startedAt: "desc" }, select: { startedAt: true, finishedAt: true, status: true, source: true } });
}
