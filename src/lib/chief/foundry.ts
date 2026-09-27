/**
 * CHIEF Foundry — genuine internal agent manufacturer.
 * Path: instruction → architecture → generate package → eval → stage → approve → deploy.
 * CHIEF cannot self-grant unrestricted privileges.
 */
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { matchTemplate, BUILTIN_TEMPLATES, buildTemplateWebBundle } from "./templates";
import { runEvalHarness } from "./eval";
import { assertNoSelfGrant, sanitizeToolsForAgent } from "./permissions";
import { executeAgentSource } from "./runtime";
import { canApproveFoundryDeploy, canDeployProduction } from "@/lib/rbac";
import { isWebRuntime, publishSameDomainAgent } from "./deploy-web";
import { webAgentRunnerSource } from "./webgen";

const AGENTS_ROOT = path.join(process.cwd(), "data", "agents");

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function pushActivity(jobId: string, entry: Record<string, unknown>) {
  const job = await prisma.foundryJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  const activity = JSON.parse(job.activityJson || "[]") as unknown[];
  activity.push({ ...entry, at: new Date().toISOString() });
  await prisma.foundryJob.update({
    where: { id: jobId },
    data: { activityJson: JSON.stringify(activity) },
  });
}

export async function ensureBuiltinTemplates() {
  for (const t of BUILTIN_TEMPLATES) {
    await prisma.agentTemplate.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        description: t.description,
        category: t.category,
        architectureJson: JSON.stringify(t.architecture),
        starterCode: t.starterCode,
        defaultToolsJson: JSON.stringify(t.defaultTools),
        evalHarnessJson: JSON.stringify(t.evalHarness),
        active: true,
      },
      create: {
        slug: t.slug,
        name: t.name,
        description: t.description,
        category: t.category,
        architectureJson: JSON.stringify(t.architecture),
        starterCode: t.starterCode,
        defaultToolsJson: JSON.stringify(t.defaultTools),
        evalHarnessJson: JSON.stringify(t.evalHarness),
      },
    });
  }
}

export async function manufactureAgent(params: {
  instruction: string;
  requesterId: string;
  requesterRole: string;
  ownerRole?: string;
}): Promise<{ jobId: string; status: string }> {
  await ensureBuiltinTemplates();

  const template = matchTemplate(params.instruction);
  const ownerRole = params.ownerRole || (template.category === "SECURITY_INTAKE" ? "CSEO" : "CEO");

  const job = await prisma.foundryJob.create({
    data: {
      instruction: params.instruction,
      status: "RECEIVED",
      stage: "intake",
      requesterId: params.requesterId,
      requesterRole: params.requesterRole,
      templateSlug: template.slug,
      activityJson: JSON.stringify([{ event: "received", instruction: params.instruction }]),
    },
  });

  try {
    // DESIGN
    await prisma.foundryJob.update({ where: { id: job.id }, data: { status: "DESIGNING", stage: "architecture" } });
    const architecture = {
      ...template.architecture,
      instruction: params.instruction,
      template: template.slug,
      ownerRole,
      designedAt: new Date().toISOString(),
    };
    await prisma.foundryJob.update({
      where: { id: job.id },
      data: { architectureJson: JSON.stringify(architecture) },
    });
    await pushActivity(job.id, { event: "designed", template: template.slug });

    // GENERATE
    await prisma.foundryJob.update({ where: { id: job.id }, data: { status: "GENERATING", stage: "codegen" } });

    const baseSlug = slugify(`${template.slug}-${Date.now().toString(36)}`);
    const tools = sanitizeToolsForAgent(template.defaultTools);
    const selfGrant = assertNoSelfGrant({ requestedBy: "CHIEF", tools: template.defaultTools });

    const kind =
      template.category === "SECURITY_INTAKE"
        ? "SECURITY_INTAKE"
        : template.category === "STATIC_SITE"
          ? "STATIC_SITE"
          : template.category === "WEB_APP"
            ? "WEB_APP"
            : "INTERNAL";

    const agent = await prisma.agentDefinition.create({
      data: {
        slug: baseSlug,
        name: `${template.name} (${baseSlug.slice(-6)})`,
        description: `Manufactured by CHIEF from instruction: ${params.instruction.slice(0, 240)}`,
        kind,
        status: "DRAFT",
        ownerRole,
        capabilitiesJson: JSON.stringify(architecture),
        policyJson: JSON.stringify({
          sideEffects: template.architecture.sideEffects || "none",
          selfGrantBlocked: selfGrant.selfGrantBlocked,
          blockedTools: selfGrant.blocked,
        }),
        createdById: params.requesterId,
      },
    });

    const versionNum = 1;
    const packageDir = path.join(AGENTS_ROOT, agent.slug, `v${versionNum}`);
    await fs.mkdir(packageDir, { recursive: true });

    const webBundle = buildTemplateWebBundle(template, params.instruction, agent.slug);
    const runtime = template.webRuntime || "json-runner";
    const sourceCode = webBundle
      ? webAgentRunnerSource(template.webRuntime!, webBundle.title)
      : template.starterCode;

    if (webBundle) {
      const webDir = path.join(packageDir, "web");
      await fs.mkdir(webDir, { recursive: true });
      for (const [fileName, content] of Object.entries(webBundle.files)) {
        await fs.writeFile(path.join(webDir, fileName), content, "utf8");
      }
    }

    const packageManifest = {
      slug: agent.slug,
      version: versionNum,
      tools,
      architecture,
      entry: webBundle ? "web/index.html" : "agent.js",
      runtime,
      livePath: webBundle ? `/a/${agent.slug}` : null,
      generatedBy: "CHIEF",
      generatedAt: new Date().toISOString(),
      web: webBundle
        ? { title: webBundle.title, runtime: webBundle.runtime, files: Object.keys(webBundle.files) }
        : null,
    };
    await fs.writeFile(path.join(packageDir, "agent.js"), sourceCode, "utf8");
    await fs.writeFile(path.join(packageDir, "package.json"), JSON.stringify(packageManifest, null, 2), "utf8");

    const version = await prisma.agentVersion.create({
      data: {
        agentId: agent.id,
        version: versionNum,
        changelog: webBundle
          ? `Initial ${runtime} package via CHIEF Foundry (live UI)`
          : "Initial manufacture via CHIEF Foundry",
        status: "STAGED",
        packagePath: path.relative(process.cwd(), packageDir),
        packageJson: JSON.stringify(packageManifest),
        sourceCode,
        webBundleJson: webBundle ? JSON.stringify(webBundle) : null,
        runtime,
        architectureJson: JSON.stringify(architecture),
        toolsJson: JSON.stringify(tools),
        createdById: params.requesterId,
      },
    });

    await prisma.foundryJob.update({
      where: { id: job.id },
      data: { agentId: agent.id, versionId: version.id },
    });
    await pushActivity(job.id, { event: "generated", agentId: agent.id, versionId: version.id, packagePath: version.packagePath });

    // Tool grants (READ/WRITE only — never ADMIN via CHIEF)
    for (const t of tools) {
      await prisma.toolPermissionGrant.upsert({
        where: { agentId_toolId_scope: { agentId: agent.id, toolId: t.toolId, scope: t.scope } },
        update: { status: "ACTIVE", grantedById: params.requesterId, requiresHuman: false },
        create: {
          agentId: agent.id,
          toolId: t.toolId,
          scope: t.scope,
          status: "ACTIVE",
          grantedById: params.requesterId,
          requiresHuman: false,
        },
      });
    }
    if (selfGrant.blocked.length) {
      await prisma.foundryApproval.create({
        data: {
          jobId: job.id,
          versionId: version.id,
          type: "PRIVILEGE",
          title: "Blocked CHIEF self-grant of unrestricted tools",
          description: `CHIEF attempted or template listed unrestricted scopes; blocked: ${selfGrant.blocked.map((b) => `${b.toolId}:${b.scope}`).join(", ")}`,
          status: "PENDING",
          requestedRole: params.requesterRole,
          selfGrantBlocked: true,
          payloadJson: JSON.stringify({ blocked: selfGrant.blocked }),
        },
      });
    }

    // EVALUATE
    await prisma.foundryJob.update({ where: { id: job.id }, data: { status: "EVALUATING", stage: "eval" } });
    const evalResult = await runEvalHarness({
      sourceCode,
      tools: template.defaultTools,
      suite: template.evalHarness,
      input: template.slug === "security-intake-recorder" ? { title: "eval-spec" } : {},
    });

    await prisma.agentEvalRun.create({
      data: {
        versionId: version.id,
        status: evalResult.status,
        suiteName: "chief-default",
        score: evalResult.score,
        passed: evalResult.passed,
        failed: evalResult.failed,
        resultsJson: JSON.stringify(evalResult.results),
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });
    await prisma.agentVersion.update({
      where: { id: version.id },
      data: { evalSummaryJson: JSON.stringify(evalResult) },
    });
    await pushActivity(job.id, { event: "evaluated", ...evalResult, results: undefined, resultCount: evalResult.results.length });

    if (evalResult.status !== "PASSED") {
      await prisma.foundryJob.update({
        where: { id: job.id },
        data: { status: "FAILED", stage: "eval", errorMessage: "Eval harness failed", completedAt: new Date() },
      });
      await writeAudit({
        actorId: params.requesterId,
        action: "chief.manufacture.failed_eval",
        entityType: "FoundryJob",
        entityId: job.id,
        metadata: { score: evalResult.score },
      });
      return { jobId: job.id, status: "FAILED" };
    }

    // STAGE + APPROVAL
    await prisma.agentDefinition.update({ where: { id: agent.id }, data: { status: "REGISTERED" } });
    await prisma.agentDeployment.create({
      data: {
        agentId: agent.id,
        versionId: version.id,
        environment: "STAGING",
        status: "PENDING",
        notes: webBundle
          ? `Staged ${runtime} package — will publish at /a/${agent.slug} on approval`
          : "Staged pending executive approval",
        adapter: webBundle ? "same-domain" : "sandbox",
        liveUrl: webBundle ? `/a/${agent.slug}` : null,
        healthUrl: webBundle ? `/api/a/${agent.slug}/health` : null,
        healthStatus: "UNKNOWN",
      },
    });

    await prisma.foundryApproval.create({
      data: {
        jobId: job.id,
        versionId: version.id,
        type: "DEPLOY",
        title: `Deploy ${agent.name} v${versionNum}`,
        description: `Eval score ${evalResult.score}. Tools: ${tools.map((t) => t.toolId).join(", ") || "none"}. Owner: ${ownerRole}.`,
        status: "PENDING",
        requestedRole: params.requesterRole,
        selfGrantBlocked: false,
        payloadJson: JSON.stringify({ agentId: agent.id, versionId: version.id, environment: "PRODUCTION" }),
      },
    });

    await prisma.foundryJob.update({
      where: { id: job.id },
      data: { status: "AWAITING_APPROVAL", stage: "approval" },
    });
    await pushActivity(job.id, { event: "awaiting_approval" });

    await prisma.execAuditEvent.create({
      data: {
        actorId: params.requesterId,
        action: "chief.manufacture.staged",
        dashboard: "CHIEF",
        entityType: "FoundryJob",
        entityId: job.id,
        metadataJson: JSON.stringify({ agentId: agent.id, versionId: version.id }),
      },
    });

    await writeAudit({
      actorId: params.requesterId,
      action: "chief.manufacture.staged",
      entityType: "FoundryJob",
      entityId: job.id,
      metadata: { agentSlug: agent.slug },
    });

    return { jobId: job.id, status: "AWAITING_APPROVAL" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "manufacture failed";
    await prisma.foundryJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: msg, completedAt: new Date() },
    });
    await pushActivity(job.id, { event: "failed", error: msg });
    return { jobId: job.id, status: "FAILED" };
  }
}

export async function decideFoundryApproval(params: {
  approvalId: string;
  deciderId: string;
  deciderRole: string;
  decision: "APPROVED" | "REJECTED";
  note?: string;
}): Promise<{ ok: boolean; error?: string; deploymentId?: string }> {
  const approval = await prisma.foundryApproval.findUnique({
    where: { id: params.approvalId },
    include: { job: true, version: { include: { agent: true } } },
  });
  if (!approval || approval.status !== "PENDING") {
    return { ok: false, error: "Approval not pending" };
  }
  if (approval.selfGrantBlocked && approval.type === "PRIVILEGE") {
    // Human executives may clear a blocked privilege request only explicitly —
    // never auto-grant ADMIN. Rejecting is the safe default unless CEO clears with note.
    if (params.decision === "APPROVED" && params.deciderRole !== "CEO" && params.deciderRole !== "SUPER_ADMIN") {
      return { ok: false, error: "Only CEO/SUPER_ADMIN may clear blocked privilege grants" };
    }
    if (params.decision === "APPROVED") {
      // Still do not activate unrestricted tools — record rejection of self-grant principle
      await prisma.foundryApproval.update({
        where: { id: approval.id },
        data: {
          status: "REJECTED",
          decidedById: params.deciderId,
          decidedAt: new Date(),
          decisionNote: params.note || "Privilege self-grant permanently denied by policy; CHIEF cannot receive unrestricted scopes.",
        },
      });
      await prisma.execAuditEvent.create({
        data: {
          actorId: params.deciderId,
          action: "chief.privilege.self_grant_denied",
          dashboard: "CHIEF",
          entityType: "FoundryApproval",
          entityId: approval.id,
        },
      });
      return { ok: true };
    }
  }

  const ownerRole = approval.version?.agent.ownerRole || "CEO";
  if (params.decision === "APPROVED" && approval.type === "DEPLOY") {
    if (!canApproveFoundryDeploy(params.deciderRole, ownerRole)) {
      return { ok: false, error: `Role ${params.deciderRole} cannot approve deploy for owner ${ownerRole}` };
    }
  }

  await prisma.foundryApproval.update({
    where: { id: approval.id },
    data: {
      status: params.decision,
      decidedById: params.deciderId,
      decidedAt: new Date(),
      decisionNote: params.note || null,
    },
  });

  if (params.decision === "REJECTED") {
    await prisma.foundryJob.update({
      where: { id: approval.jobId },
      data: { status: "CANCELLED", stage: "rejected", completedAt: new Date() },
    });
    if (approval.versionId) {
      await prisma.agentVersion.update({ where: { id: approval.versionId }, data: { status: "REJECTED" } });
    }
    await pushActivity(approval.jobId, { event: "rejected", by: params.deciderId });
    return { ok: true };
  }

  // APPROVED deploy path
  if (approval.type === "DEPLOY" && approval.version && approval.job.agentId) {
    const tools = JSON.parse(approval.version.toolsJson || "[]") as { toolId: string; scope: string }[];
    const hasUnrestricted = tools.some((t) => /ADMIN|UNRESTRICTED/i.test(t.scope));
    if (!canDeployProduction(params.deciderRole, hasUnrestricted)) {
      return { ok: false, error: "Insufficient role for production deploy" };
    }

    await prisma.agentVersion.update({ where: { id: approval.version.id }, data: { status: "APPROVED" } });

    const agentRow = approval.version.agent;
    const runtime = approval.version.runtime || "json-runner";
    let deploymentId: string;
    let liveMeta: Record<string, unknown> = {};

    if (isWebRuntime(runtime) && approval.version.webBundleJson) {
      let bundle = null;
      try {
        bundle = JSON.parse(approval.version.webBundleJson);
      } catch {
        bundle = null;
      }
      const published = await publishSameDomainAgent({
        agentId: approval.job.agentId,
        versionId: approval.version.id,
        slug: agentRow.slug,
        approvedById: params.deciderId,
        note: params.note || "Approved via CHIEF Foundry (live web)",
        bundle,
      });
      deploymentId = published.deploymentId;
      liveMeta = {
        liveUrl: published.liveUrl,
        healthUrl: published.healthUrl,
        healthStatus: published.healthStatus,
        adapter: "same-domain",
        previousDeploymentId: published.previousDeploymentId,
      };
    } else {
      await prisma.agentDeployment.updateMany({
        where: { agentId: approval.job.agentId, environment: "STAGING", status: "PENDING" },
        data: { status: "ACTIVE", approvedById: params.deciderId, activatedAt: new Date() },
      });

      const prod = await prisma.agentDeployment.create({
        data: {
          agentId: approval.job.agentId,
          versionId: approval.version.id,
          environment: "PRODUCTION",
          status: "ACTIVE",
          approvedById: params.deciderId,
          activatedAt: new Date(),
          notes: params.note || "Approved via CHIEF Foundry",
          adapter: "sandbox",
          healthStatus: "N/A",
        },
      });
      deploymentId = prod.id;
    }

    await prisma.foundryJob.update({
      where: { id: approval.jobId },
      data: { status: "DEPLOYED", stage: "deployed", completedAt: new Date() },
    });
    await pushActivity(approval.jobId, {
      event: "deployed",
      deploymentId,
      environment: "PRODUCTION",
      ...liveMeta,
    });

    await prisma.execAuditEvent.create({
      data: {
        actorId: params.deciderId,
        action: "chief.deploy.approved",
        dashboard: "CHIEF",
        entityType: "AgentDeployment",
        entityId: deploymentId,
        metadataJson: JSON.stringify({ jobId: approval.jobId, ...liveMeta }),
      },
    });

    return { ok: true, deploymentId };
  }

  await prisma.foundryJob.update({
    where: { id: approval.jobId },
    data: { status: "APPROVED", stage: "approved" },
  });
  return { ok: true };
}

export async function runDeployedAgent(params: {
  agentId: string;
  actorId: string;
  input?: Record<string, unknown>;
}): Promise<{ ok: boolean; executionId?: string; output?: unknown; error?: string }> {
  const deployment = await prisma.agentDeployment.findFirst({
    where: { agentId: params.agentId, status: "ACTIVE", environment: "PRODUCTION" },
    include: { version: true },
    orderBy: { createdAt: "desc" },
  });
  if (!deployment?.version?.sourceCode) {
    return { ok: false, error: "No active production deployment" };
  }

  const execution = await prisma.agentExecution.create({
    data: {
      agentId: params.agentId,
      deploymentId: deployment.id,
      triggeredById: params.actorId,
      status: "RUNNING",
      inputJson: JSON.stringify(params.input || {}),
      startedAt: new Date(),
    },
  });

  const result = await executeAgentSource(deployment.version.sourceCode, params.input || {});
  await prisma.agentExecution.update({
    where: { id: execution.id },
    data: {
      status: result.ok ? "SUCCEEDED" : "FAILED",
      outputJson: JSON.stringify(result.output),
      errorMessage: result.error || null,
      finishedAt: new Date(),
    },
  });

  return { ok: result.ok, executionId: execution.id, output: result.output, error: result.error };
}

export async function listFoundrySnapshot() {
  const [jobs, agents, approvals, deployments, executions, templates] = await Promise.all([
    prisma.foundryJob.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.agentDefinition.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { versions: { orderBy: { version: "desc" }, take: 1 }, deployments: { where: { status: "ACTIVE" } } },
    }),
    prisma.foundryApproval.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { job: true },
    }),
    prisma.agentDeployment.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.agentExecution.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.agentTemplate.findMany({ where: { active: true } }),
  ]);
  return { jobs, agents, approvals, deployments, executions, templates };
}
