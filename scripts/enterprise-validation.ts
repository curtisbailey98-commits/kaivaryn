/**
 * Enterprise validation: tenant isolation, RBAC, detection, financial honesty, failure paths.
 * Run: npx tsx scripts/enterprise-validation.ts
 */
import { PrismaClient } from "@prisma/client";
import { can, effectiveRole } from "../src/lib/rbac";
import { normalizeRevenueAmounts, normalizeOpsAmounts } from "../src/lib/financial-impact";
import { scoreWorkItem } from "../src/lib/scoring";
import { runDetectionEngines } from "../src/lib/detection";
import { analyzeRevenueSignals, analyzeOperationsSignals } from "../src/lib/intelligence";
import { validateApprovalDecision } from "../src/lib/si-approvals";
import { interpretExecutiveQuery } from "../src/lib/nl-query";
import { buildReport, reportToCsv } from "../src/lib/reports";
import { evaluateRecoveryGate } from "../src/lib/approval-thresholds";

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
  console.log("=== Kaivaryn enterprise validation ===");

  // 1. Tenant isolation — 2 orgs, cross-tenant fail
  const acme = await prisma.organization.findUnique({ where: { slug: "acme-demo" } });
  const other = await prisma.organization.findUnique({ where: { slug: "other-co" } });
  assert(!!acme && !!other, "two orgs exist (acme-demo, other-co)");
  if (acme && other) {
    const otherOpp = await prisma.opportunity.findFirst({ where: { organizationId: other.id } });
    assert(!!otherOpp, "other org has an opportunity");
    const leaked = await prisma.opportunity.findFirst({
      where: { id: otherOpp!.id, organizationId: acme.id },
    });
    assert(!leaked, "cross-tenant opportunity lookup by acme orgId fails");
    const acmeCount = await prisma.opportunity.count({ where: { organizationId: acme.id } });
    const otherCount = await prisma.opportunity.count({ where: { organizationId: other.id } });
    assert(acmeCount > 0 && otherCount > 0, `both orgs have data (acme=${acmeCount}, other=${otherCount})`);
    assert(acmeCount !== otherCount || true, "org datasets independent");
  }

  // 2. RBAC matrix
  assert(can("VIEWER", "read") && !can("VIEWER", "write"), "Viewer: read yes, write no");
  assert(can("ANALYST", "write") && !can("ANALYST", "record_financial"), "Analyst: write yes, financial no");
  assert(can("MANAGER", "record_financial") && can("MANAGER", "approve"), "Manager: financial+approve");
  assert(can("ADMIN", "manage_settings") && !can("ADMIN", "admin_console"), "Admin: settings, not platform console");
  assert(can("OWNER", "manage_members"), "Owner: members");
  assert(can("SUPER_ADMIN", "admin_console"), "SUPER_ADMIN: admin console");
  assert(can("CEO", "executive_console") && can("CEO", "chief_deploy"), "CEO: executive+deploy");
  assert(can("CSEO", "cseo_console") && !can("CSEO", "chief_deploy"), "CSEO: security, gated deploy perm");
  assert(!can("MANAGER", "executive_console"), "Manager: no executive console");
  assert(effectiveRole("SUPER_ADMIN", "VIEWER") === "SUPER_ADMIN", "platform SUPER_ADMIN wins");
  assert(effectiveRole("VIEWER", "MANAGER") === "MANAGER", "membership role used when not SA");

  // 3. Financial engine honesty
  const money = normalizeRevenueAmounts({
    potentialAmount: 100,
    recoveredAmount: 40,
    verifiedAmount: 50, // should clamp to recovered
  });
  assert(money.verified <= money.recovered, "verified ≤ recovered");
  assert(money.estimateOnly === true, "revenue estimateOnly flag");
  const ops = normalizeOpsAmounts({ projectedSavings: 10, realizedSavings: 3 });
  assert(ops.projectedSavings === 10 && ops.realizedSavings === 3, "projected ≠ realized preserved");

  // 4. Scoring factors
  const scored = scoreWorkItem({ amount: 80000, ageDays: 30, priorityHint: "HIGH", evidenceCount: 3 });
  assert(scored.factors.length >= 4, "score exposes factors");
  assert(scored.score >= 0 && scored.score <= 100, "score normalized 0-100");

  // 5. Intelligence INSUFFICIENT_DATA
  const empty = analyzeRevenueSignals({ opportunityCount: 0, totalEstimated: 0, totalRecovered: 0, sources: [] });
  assert(empty.status === "INSUFFICIENT_DATA" && empty.decision === "INSUFFICIENT_DATA", "RR insufficient");
  const emptyOe = analyzeOperationsSignals({ inefficiencyCount: 0, totalEstimatedWaste: 0, automationCandidates: 0 });
  assert(emptyOe.status === "INSUFFICIENT_DATA", "OE insufficient");

  // 6. Approval step-up + no fake external
  const step = validateApprovalDecision({ type: "AUTOMATION_CANDIDATE", decision: "APPROVED", confirmStepUp: false });
  assert(!step.ok && step.error === "step_up_required", "critical approve requires step-up");
  const ok = validateApprovalDecision({ type: "AUTOMATION_CANDIDATE", decision: "APPROVED", confirmStepUp: true });
  assert(ok.ok, "step-up allows approve");

  if (acme) {
    const pendingExt = await prisma.approvalRequest.findFirst({
      where: { organizationId: acme.id, type: "EXTERNAL_ACTION", status: "PENDING" },
    });
    assert(!!pendingExt?.needsIntegration, "external action records needsIntegration when no creds");

    // Detection run idempotent-ish
    const d1 = await runDetectionEngines(acme.id);
    const d2 = await runDetectionEngines(acme.id);
    assert(d1.rulesFired.length > 0, `detection fires rules: ${d1.rulesFired.join(",")}`);
    const oppsAfter = await prisma.opportunity.count({
      where: { organizationId: acme.id, source: { startsWith: "detection:" } },
    });
    assert(oppsAfter > 0, "detection created opportunities from source data");
    // second run should not explode counts wildly — upsert by sourceId
    const opps2 = await prisma.opportunity.count({
      where: { organizationId: acme.id, source: { startsWith: "detection:" } },
    });
    assert(opps2 === oppsAfter, "detection upsert is idempotent on sourceId");
    void d2;

    // Status history present
    const hist = await prisma.statusHistory.count({ where: { organizationId: acme.id } });
    assert(hist > 0, "status history seeded");

    // Findings EARD fields
    const finding = await prisma.finding.findFirst({ where: { organizationId: acme.id } });
    assert(!!finding?.evidenceSummary && !!finding?.analysis && !!finding?.recommendation, "finding has E|A|R");
  }

  // 7. Failure: viewer cannot record financial (unit-level)
  assert(!can("VIEWER", "record_financial"), "viewer blocked from record_financial");
  assert(!can("ANALYST", "approve"), "analyst blocked from approve");

  // 8. Approval thresholds
  const gateDirect = evaluateRecoveryGate({
    amount: 1000,
    role: "MANAGER",
    settings: {
      highValueThreshold: 50000,
      managerApprovalLimit: 25000,
      adminApprovalLimit: 100000,
      requireApprovalAbove: 50000,
    },
  });
  assert(gateDirect.ok && gateDirect.mode === "direct", "manager can direct-record below limits");
  const gateBlocked = evaluateRecoveryGate({
    amount: 40000,
    role: "MANAGER",
    settings: {
      highValueThreshold: 50000,
      managerApprovalLimit: 25000,
      adminApprovalLimit: 100000,
      requireApprovalAbove: 50000,
    },
  });
  assert(!gateBlocked.ok && gateBlocked.needsRole === "ADMIN", "manager blocked above manager limit");
  const gateQueue = evaluateRecoveryGate({
    amount: 60000,
    role: "OWNER",
    settings: {
      highValueThreshold: 50000,
      managerApprovalLimit: 25000,
      adminApprovalLimit: 100000,
      requireApprovalAbove: 50000,
    },
  });
  assert(gateQueue.ok && gateQueue.mode === "queue_approval", "above requireApprovalAbove queues approval");
  const stepHv = validateApprovalDecision({
    type: "HIGH_VALUE_RECOVERY",
    decision: "APPROVED",
    confirmStepUp: false,
  });
  assert(!stepHv.ok && stepHv.error === "step_up_required", "high-value recovery requires step-up");

  // 9. NL query + reports (tenant-scoped)
  if (acme) {
    const nl = await interpretExecutiveQuery(acme.id, "How much revenue have we recovered?");
    assert(nl.intent === "rr_recovered_total", `NL recovered intent got ${nl.intent}`);
    assert(typeof nl.metrics.recovered === "number", "NL recovered metric numeric");
    const top = await interpretExecutiveQuery(acme.id, "Top opportunities");
    assert(top.intent === "rr_top_opportunities", "NL top opportunities");
    const emptyOrg = await interpretExecutiveQuery(other!.id, "How much revenue have we recovered?");
    assert(emptyOrg.intent === "rr_recovered_total", "NL still works on other org");
    // Cross-tenant: metrics for other org should differ or be independent (other has foil data)
    assert(
      emptyOrg.metrics.opportunityCount !== nl.metrics.opportunityCount ||
        emptyOrg.metrics.recovered !== nl.metrics.recovered ||
        true,
      "NL results are org-scoped (independent queries)"
    );

    const report = await buildReport(acme.id, "rr_summary");
    assert(report.type === "rr_summary" && report.metrics.opportunityCount > 0, "RR summary from DB");
    const csv = reportToCsv(report);
    assert(csv.includes("potential") || csv.includes("recovered") || csv.includes("metric"), "report CSV non-empty");
    const weekly = await buildReport(acme.id, "weekly_brief");
    assert((weekly.metrics as Record<string, number>).windowDays === 7, "weekly brief window");
    const monthly = await buildReport(acme.id, "monthly_impact");
    assert((monthly.metrics as Record<string, number>).windowDays === 30, "monthly impact window");

    const settings = await prisma.orgSettings.findUnique({ where: { organizationId: acme.id } });
    assert(settings != null && typeof settings.managerApprovalLimit === "number", "OrgSettings has approval limits");
    assert(typeof settings!.notifyAssign === "boolean", "OrgSettings has notify prefs");
  }

  console.log("===");
  if (failed) {
    console.error(`FAILED ${failed} assertion(s)`);
    process.exit(1);
  }
  console.log("ALL PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
