/**
 * CHIEF Foundry + executive RBAC + live web agent validation.
 * Run: npx tsx scripts/chief-validation.ts
 */
import { PrismaClient } from "@prisma/client";
import { can, canApproveFoundryDeploy, canDeployProduction, isExecutivePlatformRole } from "../src/lib/rbac";
import { assertNoSelfGrant, sanitizeToolsForAgent } from "../src/lib/chief/permissions";
import { manufactureAgent, decideFoundryApproval, runDeployedAgent, ensureBuiltinTemplates } from "../src/lib/chief/foundry";
import { getExecutiveOverview } from "../src/lib/executive/overview";
import { matchTemplate } from "../src/lib/chief/templates";
import { getActiveWebBundle, publicBaseUrl } from "../src/lib/chief/deploy-web";

const prisma = new PrismaClient();
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK:", msg);
  }
}

async function main() {
  console.log("=== CHIEF / executive validation ===");

  assert(isExecutivePlatformRole("CEO") && isExecutivePlatformRole("CSEO"), "CEO/CSEO are executive roles");
  assert(can("CEO", "chief_deploy") && can("CEO", "executive_console"), "CEO: foundry+exec");
  assert(can("CSEO", "cseo_console") && can("CSEO", "chief_foundry"), "CSEO: security+foundry");
  assert(!can("CSEO", "chief_deploy"), "CSEO: no blanket chief_deploy perm (uses canDeployProduction helper)");
  assert(can("CSEO", "security_intake"), "CSEO: intake");
  assert(!can("ADMIN", "executive_console"), "tenant ADMIN cannot enter executive");
  assert(!can("OWNER", "chief_foundry"), "tenant OWNER cannot use CHIEF");
  assert(canApproveFoundryDeploy("CEO", "CSEO"), "CEO can approve CSEO-owned");
  assert(canApproveFoundryDeploy("CSEO", "CSEO"), "CSEO can approve own security owner");
  assert(!canApproveFoundryDeploy("CSEO", "CEO"), "CSEO cannot approve CEO-owned deploy");
  assert(canDeployProduction("CEO", true), "CEO can deploy unrestricted");
  assert(!canDeployProduction("CSEO", true), "CSEO cannot deploy unrestricted");
  assert(canDeployProduction("CSEO", false), "CSEO can deploy sanitized tools");

  const blocked = assertNoSelfGrant({
    requestedBy: "CHIEF",
    tools: [
      { toolId: "org.metrics.read", scope: "READ" },
      { toolId: "secrets", scope: "ADMIN" },
    ],
  });
  assert(blocked.selfGrantBlocked && blocked.blocked.length === 1, "CHIEF self-grant of ADMIN blocked");
  assert(sanitizeToolsForAgent([{ toolId: "org.metrics.read", scope: "READ" }, { toolId: "x", scope: "ADMIN" }]).length === 1, "sanitize drops unknown+admin");

  assert(matchTemplate("Manufacture a small internal ops status reporter").slug === "internal-ops-status", "match sandbox ops");
  assert(matchTemplate("Build a live internal status page for Kaivaryn").slug === "static-site", "match static-site");
  assert(matchTemplate("build a landing page for Acme").slug === "next-microsite", "match next-microsite");
  assert(matchTemplate("build a mini app that does notes").slug === "web-app", "match web-app");

  const curtis = await prisma.user.findUnique({ where: { email: "curtis@kaivaryn.com" } });
  const don = await prisma.user.findUnique({ where: { email: "don@kaivaryn.com" } });
  assert(!!curtis && curtis.role === "CEO", "Curtis CEO seeded");
  assert(!!don && don.role === "CSEO", "Don CSEO seeded");

  await ensureBuiltinTemplates();
  const templates = await prisma.agentTemplate.count();
  assert(templates >= 5, `templates seeded (${templates})`);

  // E2E manufacture — sandbox agent (regression)
  const mfg = await manufactureAgent({
    instruction: "Manufacture a small internal ops status reporter for platform health",
    requesterId: curtis!.id,
    requesterRole: "CEO",
  });
  assert(mfg.status === "AWAITING_APPROVAL", `manufacture staged (${mfg.status})`);

  const job = await prisma.foundryJob.findUnique({ where: { id: mfg.jobId } });
  assert(!!job?.agentId && !!job.versionId, "job linked to agent+version");

  const evalRun = await prisma.agentEvalRun.findFirst({ where: { versionId: job!.versionId! } });
  assert(evalRun?.status === "PASSED", `eval passed (score=${evalRun?.score})`);

  const approval = await prisma.foundryApproval.findFirst({
    where: { jobId: job!.id, type: "DEPLOY", status: "PENDING" },
  });
  assert(!!approval, "deploy approval pending");

  const decided = await decideFoundryApproval({
    approvalId: approval!.id,
    deciderId: curtis!.id,
    deciderRole: "CEO",
    decision: "APPROVED",
    note: "chief-validation e2e",
  });
  assert(decided.ok && !!decided.deploymentId, "approved and deployed");

  const run = await runDeployedAgent({ agentId: job!.agentId!, actorId: curtis!.id });
  assert(run.ok, `execution ok (${run.error || "no error"})`);
  assert(Boolean((run.output as { brief?: unknown })?.brief || (run.output as { hasBrief?: boolean })?.hasBrief), "execution produced brief");

  // E2E manufacture — LIVE website/app agent
  const webMfg = await manufactureAgent({
    instruction: "Build a live internal status page for Kaivaryn platform health",
    requesterId: curtis!.id,
    requesterRole: "CEO",
  });
  assert(webMfg.status === "AWAITING_APPROVAL", `web manufacture staged (${webMfg.status})`);

  const webJob = await prisma.foundryJob.findUnique({ where: { id: webMfg.jobId } });
  assert(!!webJob?.agentId && !!webJob.versionId, "web job linked");
  assert(webJob?.templateSlug === "static-site", `web template=${webJob?.templateSlug}`);

  const webVersion = await prisma.agentVersion.findUnique({ where: { id: webJob!.versionId! } });
  assert(webVersion?.runtime === "static-site", `runtime=${webVersion?.runtime}`);
  assert(Boolean(webVersion?.webBundleJson), "webBundleJson present");
  const bundle = JSON.parse(webVersion!.webBundleJson || "{}") as { files?: Record<string, string> };
  assert(Boolean(bundle.files?.["index.html"]?.includes("<!DOCTYPE html>")), "bundle has real HTML");
  assert(Boolean(bundle.files?.["styles.css"] && bundle.files?.["app.js"]), "bundle has css+js");

  const webEval = await prisma.agentEvalRun.findFirst({ where: { versionId: webJob!.versionId! } });
  assert(webEval?.status === "PASSED", `web eval passed (score=${webEval?.score})`);

  const webApproval = await prisma.foundryApproval.findFirst({
    where: { jobId: webJob!.id, type: "DEPLOY", status: "PENDING" },
  });
  assert(!!webApproval, "web deploy approval pending");

  const webDecided = await decideFoundryApproval({
    approvalId: webApproval!.id,
    deciderId: curtis!.id,
    deciderRole: "CEO",
    decision: "APPROVED",
    note: "chief-validation live web e2e",
  });
  assert(webDecided.ok && !!webDecided.deploymentId, "web approved and deployed");

  const webDep = await prisma.agentDeployment.findUnique({ where: { id: webDecided.deploymentId! } });
  assert(webDep?.adapter === "same-domain", `adapter=${webDep?.adapter}`);
  assert(Boolean(webDep?.liveUrl?.includes("/a/")), `liveUrl=${webDep?.liveUrl}`);
  assert(webDep?.healthStatus === "OK", `healthStatus=${webDep?.healthStatus}`);

  const agent = await prisma.agentDefinition.findUnique({ where: { id: webJob!.agentId! } });
  assert(!!agent?.slug, "web agent slug");
  const active = await getActiveWebBundle(agent!.slug);
  assert(!!active, "active web bundle resolvable");
  assert(active!.bundle.files["index.html"].includes("Live agent"), "HTML content is real UI");

  const webRun = await runDeployedAgent({ agentId: webJob!.agentId!, actorId: curtis!.id });
  assert(webRun.ok && Boolean((webRun.output as { hasHtml?: boolean })?.hasHtml), "web agent run hasHtml");

  console.log("LIVE_AGENT_SLUG:", agent!.slug);
  console.log("LIVE_AGENT_URL:", webDep!.liveUrl || `${publicBaseUrl()}/a/${agent!.slug}`);
  console.log("LIVE_AGENT_HEALTH:", webDep!.healthUrl || `${publicBaseUrl()}/api/a/${agent!.slug}/health`);

  // Tenant isolation still: executive overview reads aggregates but org data remains scoped in tenant app
  const overview = await getExecutiveOverview();
  assert(typeof overview.company.organizations === "number", "CEO overview live data");
  assert(overview.platform.missingIntegrations.some((m) => m.status === "missing" || m.status === "configured"), "integrations labeled");

  if (failed) {
    console.error(`\n${failed} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll CHIEF checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
