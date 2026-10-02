/**
 * Playbooks — renovated from 720 SI Recipes (reusable directives) + Library.
 * System playbooks are seeded per organization (idempotent upsert on organizationId+slug).
 * Saved playbooks are tenant-owned. Running a playbook creates a recorded Run.
 */
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import type { OpCtx } from "./context";
import { OpError, requireOpPermission, safeJson } from "./context";
import { createRun, executeRun, normalizeSteps, type RunStep } from "./runs";

export type PlaybookTemplate = {
  slug: string;
  name: string;
  product: "REVENUE_RECOVERY" | "OPERATIONS_EFFICIENCY" | "BOTH";
  category: "ANALYSIS" | "GOVERNANCE" | "BRIEFING" | "HEALTH";
  summary: string;
  steps: RunStep[];
};

export const SYSTEM_PLAYBOOKS: PlaybookTemplate[] = [
  {
    slug: "revenue-leakage-sweep",
    name: "Revenue leakage sweep",
    product: "REVENUE_RECOVERY",
    category: "ANALYSIS",
    summary: "Run detection rules, a nine-return Revenue Recovery cycle, and save an executive digest.",
    steps: [{ kind: "DETECT" }, { kind: "ANALYZE", product: "REVENUE_RECOVERY", intent: "Revenue leakage sweep" }, { kind: "BRIEF" }],
  },
  {
    slug: "operations-friction-sweep",
    name: "Operations friction sweep",
    product: "OPERATIONS_EFFICIENCY",
    category: "ANALYSIS",
    summary: "Run detection rules, a nine-return Operations Efficiency cycle, and save an executive digest.",
    steps: [{ kind: "DETECT" }, { kind: "ANALYZE", product: "OPERATIONS_EFFICIENCY", intent: "Operations friction sweep" }, { kind: "BRIEF" }],
  },
  {
    slug: "executive-weekly-review",
    name: "Executive weekly review",
    product: "BOTH",
    category: "BRIEFING",
    summary: "Health check, both intelligence cycles, a digest, and a recall of what Kaivaryn has learned.",
    steps: [{ kind: "STATUS" }, { kind: "ANALYZE", product: "BOTH", intent: "Executive weekly review" }, { kind: "BRIEF" }, { kind: "RECALL" }],
  },
  {
    slug: "high-value-recovery-governance",
    name: "High-value recovery governance",
    product: "REVENUE_RECOVERY",
    category: "GOVERNANCE",
    summary: "Surface high-value items, assign an owner task, and pause for executive approval before the plan proceeds.",
    steps: [
      { kind: "ANSWER", question: "High-value items" },
      { kind: "TASK", title: "Assign owners to high-value recovery items", body: "Review the high-value recovery list and assign an accountable owner to each item." },
      { kind: "APPROVAL", title: "Approve high-value recovery plan", description: "Approve the recovery plan for high-value items. Approval records the decision; outreach is performed by your team." },
      { kind: "BRIEF" },
    ],
  },
  {
    slug: "automation-candidate-review",
    name: "Automation candidate review",
    product: "OPERATIONS_EFFICIENCY",
    category: "GOVERNANCE",
    summary: "Review projected savings, create a validation task, and gate the automation pilot behind approval.",
    steps: [
      { kind: "ANSWER", question: "How much projected vs realized savings?" },
      { kind: "TASK", title: "Validate top automation candidates with process owners" },
      { kind: "APPROVAL", title: "Approve automation pilot scope", description: "Approve the pilot scope. No automation runs in external systems from Kaivaryn." },
      { kind: "STATUS" },
    ],
  },
  {
    slug: "platform-health-check",
    name: "Platform health check",
    product: "BOTH",
    category: "HEALTH",
    summary: "Record a health check: database, engine freshness, schedules, runs, and integrations.",
    steps: [{ kind: "STATUS" }],
  },
];

export function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "playbook";
}

export async function ensureSystemPlaybooks(organizationId: string) {
  for (const t of SYSTEM_PLAYBOOKS) {
    await prisma.opPlaybook.upsert({
      where: { organizationId_slug: { organizationId, slug: t.slug } },
      update: { name: t.name, product: t.product, category: t.category, summary: t.summary, stepsJson: JSON.stringify(t.steps), isSystem: true },
      create: { organizationId, slug: t.slug, name: t.name, product: t.product, category: t.category, summary: t.summary, stepsJson: JSON.stringify(t.steps), isSystem: true },
    });
  }
}

export async function listPlaybooks(ctx: OpCtx) {
  const count = await prisma.opPlaybook.count({ where: { organizationId: ctx.organizationId, isSystem: true } });
  if (count < SYSTEM_PLAYBOOKS.length) await ensureSystemPlaybooks(ctx.organizationId);
  const rows = await prisma.opPlaybook.findMany({ where: { organizationId: ctx.organizationId }, orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
  return rows.map((r) => ({ ...r, steps: normalizeSteps(safeJson(r.stepsJson, [])) }));
}

export async function findPlaybook(ctx: OpCtx, idOrSlug: string) {
  const key = idOrSlug.trim();
  const bySlug = await prisma.opPlaybook.findFirst({ where: { organizationId: ctx.organizationId, slug: slugify(key) } });
  if (bySlug) return bySlug;
  const byId = await prisma.opPlaybook.findFirst({ where: { organizationId: ctx.organizationId, id: key } });
  if (byId) return byId;
  return prisma.opPlaybook.findFirst({ where: { organizationId: ctx.organizationId, name: { equals: key, mode: "insensitive" } } });
}

/** Translate a free-text directive into steps (deterministic). Used by "save playbook X :: directive". */
export function stepsFromDirective(directive: string): RunStep[] {
  const parts = directive.split(/\s+then\s+|\s*;\s*|\s*→\s*/i).map((p) => p.trim()).filter(Boolean).slice(0, 8);
  const steps: RunStep[] = [];
  for (const p of parts) {
    const t = p.toLowerCase();
    if (/\bdetect\b|\bscan\b/.test(t)) steps.push({ kind: "DETECT" });
    else if (/\bdigest\b|\bbrief\b|\bsummar/.test(t)) steps.push({ kind: "BRIEF" });
    else if (/\brecall\b|\blearn(ed)?\b/.test(t)) steps.push({ kind: "RECALL" });
    else if (/\bstatus\b|\bhealth\b/.test(t)) steps.push({ kind: "STATUS" });
    else if (/^approv/.test(t)) steps.push({ kind: "APPROVAL", title: p.replace(/^approv\w*\s*/i, "Approve ").slice(0, 200) || "Approve plan" });
    else if (/^(task|assign|todo)\b/.test(t)) steps.push({ kind: "TASK", title: p.replace(/^(task|todo)\s*:?\s*/i, "").slice(0, 200) || p });
    else if (/\?$/.test(t) || /^(how much|what|which|top|pending|unassigned)\b/.test(t)) steps.push({ kind: "ANSWER", question: p });
    else {
      const rr = /\b(revenue|billing|invoice|churn|lead|payment|recover)/.test(t);
      const oe = /\b(operations?|process|hours|manual|bottleneck|efficien|automation)/.test(t);
      steps.push({ kind: "ANALYZE", product: rr && !oe ? "REVENUE_RECOVERY" : oe && !rr ? "OPERATIONS_EFFICIENCY" : "BOTH", intent: p });
    }
  }
  return steps.length ? steps : [{ kind: "ANALYZE", product: "BOTH", intent: directive.slice(0, 300) }];
}

export async function savePlaybook(
  ctx: OpCtx,
  input: { name: string; summary?: string; product?: string; steps?: unknown; directive?: string },
) {
  requireOpPermission(ctx, "write");
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new OpError("invalid", "Playbook name required");
  const slug = slugify(name);
  const existing = await prisma.opPlaybook.findUnique({ where: { organizationId_slug: { organizationId: ctx.organizationId, slug } } });
  if (existing?.isSystem) throw new OpError("conflict", "A system playbook already uses that name", 409);
  const steps = input.steps ? normalizeSteps(input.steps) : stepsFromDirective(input.directive || name);
  if (!steps.length) throw new OpError("invalid", "Playbook needs at least one valid step");
  const product = input.product === "REVENUE_RECOVERY" || input.product === "OPERATIONS_EFFICIENCY" ? input.product : "BOTH";
  const row = await prisma.opPlaybook.upsert({
    where: { organizationId_slug: { organizationId: ctx.organizationId, slug } },
    update: { name, summary: input.summary || input.directive || name, product, stepsJson: JSON.stringify(steps) },
    create: { organizationId: ctx.organizationId, slug, name, summary: input.summary || input.directive || name, product, category: "ANALYSIS", stepsJson: JSON.stringify(steps), createdById: ctx.userId },
  });
  await writeAudit({ organizationId: ctx.organizationId, actorId: ctx.userId, action: "playbook.saved", entityType: "OpPlaybook", entityId: row.id, metadata: { slug, steps: steps.length } });
  return row;
}

export async function deletePlaybook(ctx: OpCtx, id: string) {
  requireOpPermission(ctx, "write");
  const res = await prisma.opPlaybook.deleteMany({ where: { id, organizationId: ctx.organizationId, isSystem: false } });
  return res.count;
}

export async function runPlaybook(
  ctx: OpCtx,
  idOrSlug: string,
  opts?: { source?: "PLAYBOOK" | "STANDING_ORDER" | "COMMAND"; sourceId?: string; initiativeId?: string | null; skipPermission?: boolean },
) {
  if (!opts?.skipPermission) requireOpPermission(ctx, "run_intelligence");
  await ensureSystemPlaybooks(ctx.organizationId);
  const pb = await findPlaybook(ctx, idOrSlug);
  if (!pb) throw new OpError("not_found", `Playbook “${idOrSlug}” not found in this organization`, 404);
  const steps = normalizeSteps(safeJson(pb.stepsJson, []));
  const run = await createRun(ctx, {
    title: pb.name,
    steps,
    source: opts?.source ?? "PLAYBOOK",
    sourceId: opts?.sourceId ?? pb.id,
    initiativeId: opts?.initiativeId ?? null,
  });
  await prisma.opPlaybook.update({ where: { id: pb.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
  const finished = await executeRun(ctx, run.id);
  return { playbook: pb, run: finished };
}
