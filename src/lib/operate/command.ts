/**
 * Command — renovated from 720 SI command hub (executeCommand + command_log).
 * Not a chatbot: every ask routes into a real, tenant-scoped plane and leaves a record.
 * Deterministic routing + deterministic engines. No LLM is called anywhere in this path.
 */
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { interpretExecutiveQuery } from "@/lib/nl-query";
import { tenantSearch } from "@/lib/search";
import { manufactureAgent } from "@/lib/chief/foundry";
import type { OpCtx } from "./context";
import { OpError, requireOpPermission } from "./context";
import { routeCommand, type CommandRoute, COMMAND_HELP } from "./router";
import { runHealthCheck } from "./health";
import { buildDigest, buildRecall } from "./briefing";
import { createRun, executeRun, describeStep, type RunStep } from "./runs";
import { runPlaybook, savePlaybook, listPlaybooks } from "./playbooks";
import { createStandingOrder, CADENCE_LABEL, type Cadence } from "./standing";
import { createInitiative, listInitiatives } from "./initiatives";

export type CommandLink = { label: string; href: string };
export type CommandResult = {
  id: string;
  route: CommandRoute;
  reason: string;
  status: "OK" | "ERROR" | "DENIED";
  message: string;
  links: CommandLink[];
  data?: Record<string, unknown>;
  replay?: boolean;
};

const ROUTE_PERMISSION: Record<CommandRoute, Parameters<typeof can>[1]> = {
  ANALYZE: "run_intelligence",
  PLAYBOOK: "run_intelligence",
  BUILD: "write",
  REQUEST: "write",
  STANDING: "write",
  INITIATIVE: "read", // create branch re-checks write
  ANSWER: "read",
  STATUS: "read",
  DIGEST: "read",
  RECALL: "read",
  SEARCH: "read",
  HELP: "read",
};

const CHIEF_WORDS = /\b(website|web site|site|landing page|microsite|web app|mini app|app|status page|agent)\b/i;

function planStepsFor(text: string, product: "REVENUE_RECOVERY" | "OPERATIONS_EFFICIENCY" | "BOTH"): RunStep[] {
  const cleaned = text.replace(/^(build|make|create|ship|implement|fix|deploy|launch|draft|set up|setup|plan|do)\s+(a\s+|an\s+|the\s+)?/i, "").trim() || text;
  return [
    { kind: "ANALYZE", product, intent: `Plan: ${cleaned}` },
    { kind: "TASK", title: `Own the plan: ${cleaned}`.slice(0, 200), body: `Action plan created from Command: “${text}”. Define scope, owner, and the measurable outcome before execution.` },
    { kind: "APPROVAL", title: `Approve plan: ${cleaned}`.slice(0, 200), description: `Human-in-the-loop gate for “${text}”. Approving resumes the internal steps (briefing). Kaivaryn does not execute changes in your external systems.` },
    { kind: "BRIEF" },
  ];
}

async function persist(ctx: OpCtx, text: string, idempotencyKey: string | null, r: Omit<CommandResult, "id">) {
  const row = await prisma.opCommand.create({
    data: {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      text: text.slice(0, 1000),
      route: r.route,
      routeReason: r.reason,
      status: r.status,
      message: r.message.slice(0, 2000),
      resultJson: r.data ? JSON.stringify(r.data).slice(0, 20000) : null,
      linksJson: JSON.stringify(r.links),
      idempotencyKey,
    },
  });
  await writeAudit({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: "command.executed",
    entityType: "OpCommand",
    entityId: row.id,
    metadata: { route: r.route, reason: r.reason, status: r.status },
  });
  return row.id;
}

export async function executeCommand(ctx: OpCtx, rawText: string, opts?: { idempotencyKey?: string | null }): Promise<CommandResult> {
  const text = String(rawText || "").trim().slice(0, 1000);
  const idempotencyKey = opts?.idempotencyKey?.trim().slice(0, 120) || null;
  if (!ctx.organizationId) throw new OpError("no_org", "Organization context required", 403);

  if (idempotencyKey) {
    const prior = await prisma.opCommand.findUnique({ where: { organizationId_idempotencyKey: { organizationId: ctx.organizationId, idempotencyKey } } });
    if (prior) {
      return {
        id: prior.id,
        route: prior.route as CommandRoute,
        reason: prior.routeReason,
        status: prior.status as CommandResult["status"],
        message: prior.message,
        links: JSON.parse(prior.linksJson || "[]"),
        replay: true,
      };
    }
  }

  const routed = routeCommand(text);
  const base = { route: routed.route, reason: routed.reason };

  if (!can(ctx.role, ROUTE_PERMISSION[routed.route])) {
    const denied = { ...base, status: "DENIED" as const, message: `Your role (${ctx.role}) cannot run ${routed.route.toLowerCase()} commands. Ask an analyst, manager, or admin.`, links: [] };
    const id = await persist(ctx, text, idempotencyKey, denied);
    return { id, ...denied };
  }

  let result: Omit<CommandResult, "id">;
  try {
    result = await dispatch(ctx, text, routed.route, routed.reason, routed.product);
  } catch (e) {
    const err = e as OpError;
    result = { ...base, status: err.code === "forbidden" ? "DENIED" : "ERROR", message: err.message || String(e), links: [] };
  }
  const id = await persist(ctx, text, idempotencyKey, result);
  return { id, ...result };
}

async function dispatch(ctx: OpCtx, text: string, route: CommandRoute, reason: string, product: "REVENUE_RECOVERY" | "OPERATIONS_EFFICIENCY" | "BOTH"): Promise<Omit<CommandResult, "id">> {
  const ok = (message: string, links: CommandLink[] = [], data?: Record<string, unknown>) => ({ route, reason, status: "OK" as const, message, links, data });

  switch (route) {
    case "HELP":
      return ok("Command routes your ask into analysis, answers, plans, briefings, schedules, and playbooks. Every ask leaves a record.", [{ label: "Playbooks", href: "/app/playbooks" }], { help: COMMAND_HELP });

    case "ANSWER": {
      const a = await interpretExecutiveQuery(ctx.organizationId, text);
      return ok(a.summary, a.links ?? [], { answer: a });
    }

    case "SEARCH": {
      const term = text.replace(/^(find|search|lookup|look up)\s*(for\s+)?/i, "").trim();
      if (!term) return ok("Tell me what to find, e.g. “find invoice”.");
      const res = await tenantSearch(ctx.organizationId, term, 20);
      const total = Object.values(res as Record<string, unknown[]>).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0);
      return ok(`${total} match${total === 1 ? "" : "es"} for “${term}” in your organization.`, [{ label: "Open search", href: `/app/search?q=${encodeURIComponent(term)}` }], { search: res, term });
    }

    case "STATUS": {
      const h = await runHealthCheck(ctx, "COMMAND");
      const degraded = h.components.filter((c) => c.status === "DEGRADED" || c.status === "DOWN");
      return ok(
        `Health ${h.status}. ${degraded.length ? `Needs attention: ${degraded.map((d) => `${d.label} (${d.detail})`).join("; ")}.` : "All measured components are healthy."}`,
        [{ label: "Operate", href: "/app/operate" }],
        { health: h },
      );
    }

    case "DIGEST": {
      const { briefing, body } = await buildDigest(ctx, "COMMAND");
      return ok(
        `Digest saved. ${body.work.pendingApprovals} approvals pending · ${body.work.openTasks} open tasks · ${body.work.critical} critical items · ${body.changes.newOpportunities + body.changes.newInefficiencies} new items since ${body.since ? "your last digest" : "the last 7 days"}.`,
        [{ label: "Open briefing", href: `/app/inbox?briefing=${briefing.id}` }],
        { briefingId: briefing.id, digest: body },
      );
    }

    case "RECALL": {
      const { briefing, body } = await buildRecall(ctx, "COMMAND");
      return ok(
        body.empty
          ? "Nothing recorded yet. Run Analyze to create the first continuity state — recall never invents memory."
          : `Recalled ${body.continuity.length} continuity state${body.continuity.length === 1 ? "" : "s"}, ${body.lessons.length} lessons, ${body.memory.length} memory items.${body.continuity[0]?.witness ? ` Latest Witness: ${body.continuity[0].witness}` : ""}`,
        [{ label: "Open recall", href: `/app/inbox?briefing=${briefing.id}` }, { label: "Intelligence", href: "/app/intelligence" }],
        { briefingId: briefing.id, recall: body },
      );
    }

    case "ANALYZE": {
      const run = await createRun(ctx, { title: text.slice(0, 160) || "Analysis", steps: [{ kind: "ANALYZE", product, intent: text }], source: "COMMAND" });
      const done = await executeRun(ctx, run.id);
      const ev = JSON.parse(done.evidenceJson || "[]") as Array<{ summary: string; refs?: CommandLink[] }>;
      return {
        route,
        reason,
        status: done.status === "FAILED" ? "ERROR" : "OK",
        message: ev[0]?.summary || `Analysis ${done.status.toLowerCase()}`,
        links: [...(ev[0]?.refs ?? []), { label: "Run record", href: `/app/automations?run=${done.id}` }],
        data: { runId: done.id, status: done.status },
      };
    }

    case "BUILD": {
      if (ctx.isExecutive && CHIEF_WORDS.test(text) && can(ctx.role, "chief_foundry") && ctx.userId) {
        const job = await manufactureAgent({ instruction: text, requesterId: ctx.userId, requesterRole: ctx.role });
        return ok(`Handed to CHIEF Agent Foundry. Job ${job.jobId.slice(0, 8)} is ${job.status.toLowerCase()} — it stages for human approval before anything goes live.`, [{ label: "CHIEF Foundry", href: `/executive/chief?job=${job.jobId}` }], { chiefJobId: job.jobId });
      }
      const steps = planStepsFor(text, product);
      const run = await createRun(ctx, { title: `Plan · ${text.slice(0, 140)}`, steps, source: "COMMAND" });
      const done = await executeRun(ctx, run.id);
      return {
        route,
        reason,
        status: done.status === "FAILED" ? "ERROR" : "OK",
        message:
          done.status === "WAITING_APPROVAL"
            ? `Action plan created (${steps.map(describeStep).join(" → ")}). Paused at the approval gate — nothing proceeds until a person approves.`
            : `Action plan ${done.status.toLowerCase()}${done.error ? `: ${done.error}` : ""}.`,
        links: [{ label: "Run record", href: `/app/automations?run=${done.id}` }, { label: "Approvals", href: "/app/approvals" }],
        data: { runId: done.id, status: done.status },
      };
    }

    case "REQUEST": {
      const what = text.replace(/^request\s*:?\s*/i, "").trim() || "Owner action request";
      const run = await createRun(ctx, {
        title: `Request · ${what.slice(0, 140)}`,
        steps: [
          { kind: "TASK", title: what.slice(0, 200), body: "Owner action request recorded from Command. A person fulfills it — Kaivaryn does not perform external actions on its own." },
          { kind: "APPROVAL", title: `Confirm request fulfilled: ${what}`.slice(0, 200) },
        ],
        source: "COMMAND",
      });
      const done = await executeRun(ctx, run.id);
      return ok(`Request recorded as an owned task with a confirmation gate. Kaivaryn will not perform it on its own.`, [{ label: "Action Center", href: "/app/action-center" }, { label: "Run record", href: `/app/automations?run=${done.id}` }], { runId: done.id });
    }

    case "STANDING": {
      const order = await createStandingOrder(ctx, { directive: text });
      return ok(
        `Standing order created: ${CADENCE_LABEL[order.cadence as Cadence]} · ${order.kind.toLowerCase()} · “${order.directive}”. Next due ${order.nextRunAt?.toISOString().slice(0, 16).replace("T", " ")} UTC. Runs on “Run due now” or the scheduler tick — there is no always-on worker on the current plan.`,
        [{ label: "Automations", href: "/app/automations" }],
        { standingOrderId: order.id },
      );
    }

    case "PLAYBOOK": {
      const save = text.match(/\b(?:save|create)\s+(?:playbook|recipe)\s+(.+?)\s*::\s*(.+)$/i);
      if (save) {
        const pb = await savePlaybook(ctx, { name: save[1]!, directive: save[2]! });
        return ok(`Playbook saved: ${pb.name} (${pb.slug}).`, [{ label: "Playbooks", href: "/app/playbooks" }], { playbookId: pb.id });
      }
      const runMatch = text.match(/^run\s+(?:playbook|recipe)\s+(.+)$/i);
      if (runMatch) {
        const { playbook, run } = await runPlaybook(ctx, runMatch[1]!.trim(), { source: "COMMAND" });
        return {
          route,
          reason,
          status: run.status === "FAILED" ? "ERROR" : "OK",
          message: `Playbook “${playbook.name}” ${run.status === "WAITING_APPROVAL" ? "paused at its approval gate" : run.status.toLowerCase()}${run.error ? `: ${run.error}` : ""}.`,
          links: [{ label: "Run record", href: `/app/automations?run=${run.id}` }, { label: "Playbooks", href: "/app/playbooks" }],
          data: { runId: run.id, status: run.status },
        };
      }
      const list = await listPlaybooks(ctx);
      return ok(`Playbooks (${list.length}): ${list.map((p) => p.slug).join(", ")}. Run with “run playbook <slug>”, save with “save playbook <name> :: <steps>”.`, [{ label: "Playbooks", href: "/app/playbooks" }]);
    }

    case "INITIATIVE": {
      const create = text.match(/^(?:initiative|project)s?\s+(?:create|new|start)\s+(.+)$/i);
      if (create) {
        requireOpPermission(ctx, "write");
        const ini = await createInitiative(ctx, { name: create[1]!, product });
        return ok(`Initiative created: ${ini.name}.`, [{ label: "Open initiative", href: `/app/initiatives/${ini.id}` }], { initiativeId: ini.id });
      }
      const list = await listInitiatives(ctx);
      return ok(list.length ? `Initiatives (${list.length}): ${list.map((i) => `${i.name} [${i.status.toLowerCase()}]`).join(", ")}.` : "No initiatives yet. Try “initiative create Q4 billing cleanup”.", [{ label: "Initiatives", href: "/app/initiatives" }]);
    }
  }
}

export async function listCommandHistory(ctx: OpCtx, take = 25) {
  return prisma.opCommand.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" }, take });
}
