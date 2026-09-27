/**
 * Real backend aggregations for CEO Command Center.
 * Missing integrations are labeled — never faked.
 */
import { prisma } from "@/lib/prisma";
import { getExecutiveSiSummary } from "@/lib/si/dashboard";

export async function getExecutiveOverview() {
  const [
    orgCount,
    userCount,
    demoCount,
    opportunityAgg,
    inefficiencyAgg,
    pendingApprovals,
    acquisitionByStage,
    demoByStatus,
    recentDemos,
    recentAcquisition,
    entitlements,
    subscriptions,
    integrations,
    intelligenceRuns,
    importJobs,
    auditRecent,
    agents,
    foundryJobs,
    pendingFoundry,
    executions,
    notifications,
    siSummary,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.demoRequest.count(),
    prisma.opportunity.aggregate({
      _count: { _all: true },
      _sum: { potentialAmount: true, recoveredAmount: true, verifiedAmount: true },
    }),
    prisma.inefficiency.aggregate({
      _count: { _all: true },
      _sum: { estimatedWasteAnnual: true, projectedSavings: true, realizedSavings: true },
    }),
    prisma.approvalRequest.count({ where: { status: "PENDING" } }),
    prisma.acquisitionAccount.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.demoRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.demoRequest.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.acquisitionAccount.findMany({ orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.entitlement.findMany({ where: { active: true }, include: { organization: true }, take: 50 }),
    prisma.subscription.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { organization: true } }),
    prisma.integrationConnection.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.intelligenceRun.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.agentDefinition.findMany({
      include: { deployments: { where: { status: "ACTIVE" } }, versions: { take: 1, orderBy: { version: "desc" } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.foundryJob.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.foundryApproval.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.agentExecution.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    getExecutiveSiSummary(),
  ]);

  const missingIntegrations: { key: string; label: string; status: "missing" | "configured" }[] = [
    { key: "stripe_webhook", label: "Stripe webhook verification", status: process.env.STRIPE_WEBHOOK_SECRET ? "configured" : "missing" },
    { key: "smtp", label: "SMTP email delivery", status: process.env.SMTP_HOST ? "configured" : "missing" },
    { key: "openai", label: "OpenAI call agent", status: process.env.OPENAI_API_KEY ? "configured" : "missing" },
    { key: "twilio", label: "Twilio voice", status: process.env.TWILIO_ACCOUNT_SID ? "configured" : "missing" },
    { key: "google", label: "Google Workspace acquisition", status: process.env.GOOGLE_CLIENT_ID ? "configured" : "missing" },
    { key: "clay", label: "Clay intent ingest", status: process.env.CLAY_WEBHOOK_SECRET ? "configured" : "missing" },
  ];

  const rrActiveOrgs = entitlements.filter((e) => e.product === "REVENUE_RECOVERY").length;
  const oeActiveOrgs = entitlements.filter((e) => e.product === "OPERATIONS_EFFICIENCY").length;

  const paidSubs = subscriptions.filter((s) => s.status === "ACTIVE" || s.status === "active");
  const revenueCents = paidSubs.reduce((a, s) => a + (s.priceCents || 0), 0);

  return {
    company: {
      organizations: orgCount,
      users: userCount,
      demoLeads: demoCount,
      pendingApprovals,
    },
    revenue: {
      subscriptionRevenueCents: revenueCents,
      activeSubscriptions: paidSubs.length,
      totalSubscriptions: subscriptions.length,
      note: paidSubs.length
        ? "Sum of ACTIVE subscription priceCents from database"
        : "No ACTIVE subscriptions in database yet — commercial revenue not fabricated",
      recoveredAmount: opportunityAgg._sum.recoveredAmount ?? 0,
      verifiedAmount: opportunityAgg._sum.verifiedAmount ?? 0,
      potentialAmount: opportunityAgg._sum.potentialAmount ?? 0,
      opportunityCount: opportunityAgg._count._all,
    },
    acquisition: {
      byStage: acquisitionByStage.map((s) => ({ stage: s.stage, count: s._count._all })),
      recent: recentAcquisition,
      total: acquisitionByStage.reduce((a, s) => a + s._count._all, 0),
    },
    demoFunnel: {
      byStatus: demoByStatus.map((s) => ({ status: s.status, count: s._count._all })),
      recent: recentDemos,
    },
    rr: {
      activeOrgEntitlements: rrActiveOrgs,
      opportunityCount: opportunityAgg._count._all,
      potential: opportunityAgg._sum.potentialAmount ?? 0,
      recovered: opportunityAgg._sum.recoveredAmount ?? 0,
      verified: opportunityAgg._sum.verifiedAmount ?? 0,
    },
    oe: {
      activeOrgEntitlements: oeActiveOrgs,
      inefficiencyCount: inefficiencyAgg._count._all,
      estimatedWaste: inefficiencyAgg._sum.estimatedWasteAnnual ?? 0,
      projectedSavings: inefficiencyAgg._sum.projectedSavings ?? 0,
      realizedSavings: inefficiencyAgg._sum.realizedSavings ?? 0,
    },
    agents: {
      definitions: agents,
      foundryJobs,
      pendingApprovals: pendingFoundry,
      executions,
      activeCount: agents.filter((a) => a.deployments.some((d) => d.environment === "PRODUCTION")).length,
    },
    clients: {
      entitlements,
      subscriptions,
      onboardingOrgs: entitlements.length,
    },
    platform: {
      integrationStatuses: integrations.map((i) => ({ status: i.status, count: i._count._all })),
      missingIntegrations,
      recentIntelligence: intelligenceRuns,
      recentImports: importJobs,
      recentAudit: auditRecent,
    },
    notifications,
    si: siSummary,
    generatedAt: new Date().toISOString(),
  };
}

export function money(n: number | null | undefined) {
  const v = n ?? 0;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}
