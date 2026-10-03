import { PrismaClient } from "@prisma/client";
import { Role, Product, OpportunityPriority, InefficiencyPriority, IntegrationStatus } from "../src/lib/enums";
import { hash } from "bcryptjs";
import { scoreWorkItem } from "../src/lib/scoring";
import { runDetectionEngines } from "../src/lib/detection";
import { ZOOM_SCHEDULER_URL } from "../src/lib/constants";
import { generateWebBundle, webAgentRunnerSource } from "../src/lib/chief/webgen";
import { publicBaseUrl } from "../src/lib/chief/deploy-web";
import { ensureKaivarynVoiceAgents } from "../src/lib/voice/kaivaryn";
import { ensureSystemPlaybooks, runPlaybook, createStandingOrder, createInitiative, linkToInitiative, findPlaybook, runHealthCheck } from "../src/lib/operate";

const prisma = new PrismaClient();

const STRIPE = process.env.STRIPE_PAYMENT_LINK || "https://buy.stripe.com/14AaEZgJsdDNeTFePLeUU01";
const ZOOM = process.env.ZOOM_MEETING_URL || ZOOM_SCHEDULER_URL;

async function wipeOrg(orgId: string) {
  // Operating layer (renovated 720 SI) — demo/test orgs are rebuilt on every boot
  await prisma.opInitiativeLink.deleteMany({ where: { organizationId: orgId } });
  await prisma.opInitiative.deleteMany({ where: { organizationId: orgId } });
  await prisma.opRun.deleteMany({ where: { organizationId: orgId } });
  await prisma.opStandingOrder.deleteMany({ where: { organizationId: orgId } });
  await prisma.opBriefing.deleteMany({ where: { organizationId: orgId } });
  await prisma.opHealthCheck.deleteMany({ where: { organizationId: orgId } });
  await prisma.opCommand.deleteMany({ where: { organizationId: orgId } });
  await prisma.opPlaybook.deleteMany({ where: { organizationId: orgId, isSystem: false } });
  await prisma.siStageOutput.deleteMany({ where: { organizationId: orgId } });
  await prisma.siCycleInvariant.deleteMany({ where: { organizationId: orgId } });
  await prisma.siZeroState.deleteMany({ where: { organizationId: orgId } });
  await prisma.siPrediction.deleteMany({ where: { organizationId: orgId } });
  await prisma.siLesson.deleteMany({ where: { organizationId: orgId } });
  await prisma.siMemoryItem.deleteMany({ where: { organizationId: orgId } });
  await prisma.siErrorRecord.deleteMany({ where: { organizationId: orgId } });
  await prisma.siMetaReturn.deleteMany({ where: { organizationId: orgId } });
  await prisma.siMethodRegistry.deleteMany({ where: { organizationId: orgId } });
  await prisma.siCognitionCycle.deleteMany({ where: { organizationId: orgId } });
  await prisma.evidence.deleteMany({ where: { organizationId: orgId } });
  await prisma.finding.deleteMany({ where: { organizationId: orgId } });
  await prisma.statusHistory.deleteMany({ where: { organizationId: orgId } });
  await prisma.comment.deleteMany({ where: { organizationId: orgId } });
  await prisma.emailDraft.deleteMany({ where: { organizationId: orgId } });
  await prisma.task.deleteMany({ where: { organizationId: orgId } });
  await prisma.notification.deleteMany({ where: { organizationId: orgId } });
  await prisma.importJob.deleteMany({ where: { organizationId: orgId } });
  await prisma.intelligenceRun.deleteMany({ where: { organizationId: orgId } });
  await prisma.opportunityNote.deleteMany({ where: { opportunity: { organizationId: orgId } } });
  await prisma.inefficiencyNote.deleteMany({ where: { inefficiency: { organizationId: orgId } } });
  await prisma.opportunity.deleteMany({ where: { organizationId: orgId } });
  await prisma.inefficiency.deleteMany({ where: { organizationId: orgId } });
  await prisma.interaction.deleteMany({ where: { organizationId: orgId } });
  await prisma.appointment.deleteMany({ where: { organizationId: orgId } });
  await prisma.transaction.deleteMany({ where: { organizationId: orgId } });
  await prisma.lead.deleteMany({ where: { organizationId: orgId } });
  await prisma.contact.deleteMany({ where: { organizationId: orgId } });
  await prisma.customer.deleteMany({ where: { organizationId: orgId } });
  await prisma.process.deleteMany({ where: { organizationId: orgId } });
  await prisma.department.deleteMany({ where: { organizationId: orgId } });
  await prisma.approvalRequest.deleteMany({ where: { organizationId: orgId } });
}

async function main() {
  console.log("Seeding Kaivaryn (enterprise DEMO)…");

  await prisma.pricingConfig.upsert({
    where: { key: "default" },
    update: {
      introductorySeats: 10,
      introductoryPriceCents: 1_000_000,
      standardPriceCents: 2_000_000,
      stripePaymentLink: STRIPE,
      zoomMeetingUrl: ZOOM,
    },
    create: {
      key: "default",
      introductorySeats: 10,
      introductoryPriceCents: 1_000_000,
      standardPriceCents: 2_000_000,
      currency: "USD",
      stripePaymentLink: STRIPE,
      zoomMeetingUrl: ZOOM,
    },
  });

  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? null : "KaivarynAdmin!2026");
  if (!adminPassword) throw new Error("BOOTSTRAP_ADMIN_PASSWORD is required in production; refusing to seed a public default super-admin password.");
  const adminHash = await hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@kaivaryn.com" },
    update: { passwordHash: adminHash, role: Role.SUPER_ADMIN, name: "Kaivaryn Admin" },
    create: {
      email: "admin@kaivaryn.com",
      name: "Kaivaryn Admin",
      passwordHash: adminHash,
      role: Role.SUPER_ADMIN,
    },
  });


  // Executive identities — CEO Curtis Bailey, CSEO Don Lewis (internal only)
  // Prefer BOOTSTRAP_CEO_PASSWORD / BOOTSTRAP_CSEO_PASSWORD. Fallback is a strong default
  // used only when unset (rotate immediately in production after first login).
  const ceoPassword = process.env.BOOTSTRAP_CEO_PASSWORD || "Kv-CEO-Curtis!2026-X7mQ";
  const cseoPassword = process.env.BOOTSTRAP_CSEO_PASSWORD || "Kv-CSEO-Don!2026-R4nP";

  async function upsertExecutive(email: string, name: string, role: string, password: string) {
    const passwordHash = await hash(password, 12);
    return prisma.user.upsert({
      where: { email },
      update: { passwordHash, role, name },
      create: { email, name, passwordHash, role },
    });
  }

  const curtis = await upsertExecutive("curtis@kaivaryn.com", "Curtis Bailey", Role.CEO, ceoPassword);
  await prisma.executiveDashboardPref.upsert({
    where: { userId: curtis.id },
    update: { activeDashboard: "CEO" },
    create: { userId: curtis.id, activeDashboard: "CEO" },
  });

  const don = await upsertExecutive("don@kaivaryn.com", "Don Lewis", Role.CSEO, cseoPassword);
  await prisma.executiveDashboardPref.upsert({
    where: { userId: don.id },
    update: { activeDashboard: "CSEO" },
    create: { userId: don.id, activeDashboard: "CSEO" },
  });

  const hq = await prisma.organization.upsert({
    where: { slug: "kaivaryn-hq" },
    update: { name: "Kaivaryn HQ (Internal)", isDemo: false },
    create: { name: "Kaivaryn HQ (Internal)", slug: "kaivaryn-hq", isDemo: false },
  });
  for (const [userId, role] of [
    [curtis.id, Role.OWNER],
    [don.id, Role.ADMIN],
    [admin.id, Role.OWNER],
  ] as const) {
    await prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: hq.id, userId } },
      update: { role },
      create: { organizationId: hq.id, userId, role },
    });
  }


  // Voice layer: map Kaivaryn's own assistants (Viki phone, web, in-app) to the internal HQ tenant.
  try {
    const v = await ensureKaivarynVoiceAgents(prisma);
    console.log(`  Voice agents registered for Kaivaryn HQ: ${v.registered}${v.conflicts.length ? ` (conflicts: ${v.conflicts.join(", ")})` : ""}`);
  } catch (e) {
    console.warn("  Voice agent registration skipped:", (e as Error).message);
  }

  const demoHash = await hash("DemoClient!2026", 12);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@kaivaryn.com" },
    update: { passwordHash: demoHash, name: "Alex Morgan" },
    create: {
      email: "demo@kaivaryn.com",
      name: "Alex Morgan",
      passwordHash: demoHash,
      role: Role.VIEWER,
    },
  });

  const demoOwner = await prisma.user.upsert({
    where: { email: "owner@acme-demo.kaivaryn.com" },
    update: { passwordHash: demoHash, name: "Jordan Reyes" },
    create: {
      email: "owner@acme-demo.kaivaryn.com",
      name: "Jordan Reyes",
      passwordHash: demoHash,
      role: Role.VIEWER,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@acme-demo.kaivaryn.com" },
    update: { passwordHash: demoHash, name: "Priya Shah" },
    create: {
      email: "manager@acme-demo.kaivaryn.com",
      name: "Priya Shah",
      passwordHash: demoHash,
      role: Role.VIEWER,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: "viewer@acme-demo.kaivaryn.com" },
    update: { passwordHash: demoHash, name: "Sam Ellis" },
    create: {
      email: "viewer@acme-demo.kaivaryn.com",
      name: "Sam Ellis",
      passwordHash: demoHash,
      role: Role.VIEWER,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "acme-demo" },
    update: { name: "Acme Industries", isDemo: true },
    create: { name: "Acme Industries", slug: "acme-demo", isDemo: true },
  });

  // Isolation foil org (empty entitlements for cross-tenant tests)
  const other = await prisma.organization.upsert({
    where: { slug: "other-co" },
    update: { name: "Other Co (TEST)", isDemo: false },
    create: { name: "Other Co (TEST)", slug: "other-co", isDemo: false },
  });
  const otherUser = await prisma.user.upsert({
    where: { email: "analyst@other-co.test" },
    update: { passwordHash: demoHash, name: "Other Analyst" },
    create: {
      email: "analyst@other-co.test",
      name: "Other Analyst",
      passwordHash: demoHash,
      role: Role.VIEWER,
    },
  });
  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: other.id, userId: otherUser.id } },
    update: { role: Role.ANALYST },
    create: { organizationId: other.id, userId: otherUser.id, role: Role.ANALYST },
  });
  await wipeOrg(other.id);
  await prisma.opportunity.create({
    data: {
      organizationId: other.id,
      title: "[TEST] Other-org secret opportunity",
      status: "IDENTIFIED",
      priority: "LOW",
      potentialAmount: 999,
      estimatedAmount: 999,
    },
  });

  await wipeOrg(org.id);

  for (const [userId, role] of [
    [demoUser.id, Role.ANALYST],
    [demoOwner.id, Role.OWNER],
    [manager.id, Role.MANAGER],
    [viewer.id, Role.VIEWER],
  ] as const) {
    await prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId } },
      update: { role },
      create: { organizationId: org.id, userId, role },
    });
  }

  for (const product of [Product.REVENUE_RECOVERY, Product.OPERATIONS_EFFICIENCY]) {
    await prisma.entitlement.upsert({
      where: { organizationId_product: { organizationId: org.id, product } },
      update: { active: true },
      create: { organizationId: org.id, product, active: true },
    });
  }

  await prisma.subscription.deleteMany({ where: { organizationId: org.id } });
  await prisma.subscription.create({
    data: {
      organizationId: org.id,
      status: "ACTIVE",
      priceCents: 1_000_000,
      seatNumber: 1,
      startedAt: new Date(),
      stripeRef: "DEMO",
    },
  });

  await prisma.orgSettings.upsert({
    where: { organizationId: org.id },
    update: { settingsJson: JSON.stringify({ consumerDetections: false, vertical: "finance" }) },
    create: { organizationId: org.id, settingsJson: JSON.stringify({ consumerDetections: false, vertical: "finance" }) },
  });

  const integrations = [
    { provider: "csv_upload", displayName: "CSV / File Upload", status: IntegrationStatus.AVAILABLE },
    { provider: "manual_entry", displayName: "Manual Entry", status: IntegrationStatus.CONNECTED },
    { provider: "erp_generic", displayName: "ERP (Generic)", status: IntegrationStatus.NEEDS_CONFIG },
    { provider: "billing_system", displayName: "Billing System", status: IntegrationStatus.NEEDS_CONFIG },
    { provider: "claims_payer", displayName: "Claims / Payer Feed", status: IntegrationStatus.AVAILABLE },
    { provider: "hris", displayName: "HRIS / Time Tracking", status: IntegrationStatus.AVAILABLE },
  ];
  for (const i of integrations) {
    await prisma.integrationConnection.upsert({
      where: { organizationId_provider: { organizationId: org.id, provider: i.provider } },
      update: { displayName: i.displayName, status: i.status },
      create: { organizationId: org.id, ...i },
    });
  }

  const finance = await prisma.department.create({
    data: { organizationId: org.id, name: "Finance", code: "FIN" },
  });
  const sales = await prisma.department.create({
    data: { organizationId: org.id, name: "Sales Ops", code: "SO" },
  });
  const ops = await prisma.department.create({
    data: { organizationId: org.id, name: "Ops", code: "OPS" },
  });

  const days = (n: number) => new Date(Date.now() - n * 86400000);

  // Interconnected DEMO journey customers → leads/txns/appts/interactions
  const custA = await prisma.customer.create({
    data: {
      organizationId: org.id,
      name: "Northwind Hospital",
      email: "ap@northwind.demo",
      status: "ACTIVE",
      lastActivityAt: days(5),
      source: "demo_seed",
      sourceId: "cust-a",
      importedAt: new Date(),
    },
  });
  const custB = await prisma.customer.create({
    data: {
      organizationId: org.id,
      name: "Contoso Clinics",
      email: "billing@contoso.demo",
      status: "DORMANT",
      lastActivityAt: days(120),
      source: "demo_seed",
      sourceId: "cust-b",
      importedAt: new Date(),
    },
  });
  const custC = await prisma.customer.create({
    data: {
      organizationId: org.id,
      name: "Fabrikam Retail",
      email: "pay@fabrikam.demo",
      status: "ACTIVE",
      lastActivityAt: days(2),
      source: "demo_seed",
      sourceId: "cust-c",
      importedAt: new Date(),
    },
  });

  await prisma.contact.createMany({
    data: [
      { organizationId: org.id, customerId: custA.id, name: "Ada Billing", email: "ada@northwind.demo", source: "demo_seed", sourceId: "ct-1" },
      { organizationId: org.id, customerId: custB.id, name: "Ben Ops", email: "ben@contoso.demo", source: "demo_seed", sourceId: "ct-2" },
    ],
  });

  await prisma.lead.createMany({
    data: [
      {
        organizationId: org.id,
        customerId: custA.id,
        title: "Expansion — imaging suite",
        status: "OPEN",
        stage: "proposal",
        amount: 145000,
        lastTouchAt: days(20),
        source: "demo_seed",
        sourceId: "lead-1",
      },
      {
        organizationId: org.id,
        customerId: custC.id,
        title: "Retail loyalty upsell",
        status: "OPEN",
        stage: "discovery",
        amount: 28000,
        lastTouchAt: days(3),
        source: "demo_seed",
        sourceId: "lead-2",
      },
    ],
  });

  await prisma.transaction.createMany({
    data: [
      {
        organizationId: org.id,
        customerId: custA.id,
        type: "PAYMENT",
        status: "FAILED",
        amount: 18400,
        occurredAt: days(4),
        source: "demo_seed",
        sourceId: "txn-fail-1",
      },
      {
        organizationId: org.id,
        customerId: custC.id,
        type: "INVOICE",
        status: "FAILED",
        amount: 42750,
        occurredAt: days(6),
        source: "demo_seed",
        sourceId: "txn-ar-short-1",
      },
      {
        organizationId: org.id,
        customerId: custA.id,
        type: "PAYMENT",
        status: "SUCCEEDED",
        amount: 5000,
        occurredAt: days(10),
        source: "demo_seed",
        sourceId: "txn-ok-1",
      },
    ],
  });

  await prisma.appointment.createMany({
    data: [
      {
        organizationId: org.id,
        customerId: custA.id,
        title: "Quarterly business review — Northwind",
        status: "COMPLETED",
        scheduledAt: days(3),
        source: "demo_seed",
        sourceId: "appt-1",
      },
      {
        organizationId: org.id,
        customerId: custC.id,
        title: "Onboarding call",
        status: "SCHEDULED",
        scheduledAt: days(-2),
        source: "demo_seed",
        sourceId: "appt-2",
      },
    ],
  });

  await prisma.interaction.createMany({
    data: [
      {
        organizationId: org.id,
        customerId: custB.id,
        channel: "EMAIL",
        direction: "INBOUND",
        subject: "Contract question unanswered",
        answered: false,
        occurredAt: days(3),
        source: "demo_seed",
        sourceId: "int-1",
      },
      {
        organizationId: org.id,
        customerId: custA.id,
        channel: "PHONE",
        direction: "OUTBOUND",
        subject: "Collections follow-up",
        answered: true,
        occurredAt: days(1),
        source: "demo_seed",
        sourceId: "int-2",
      },
    ],
  });

  const procInvoice = await prisma.process.create({
    data: {
      organizationId: org.id,
      departmentId: finance.id,
      name: "Invoice reconciliation",
      description: "Weekly spreadsheet reconcile ERP ↔ billing",
      avgCycleDays: 9,
      stepsJson: JSON.stringify(["export", "match", "exception", "post"]),
      source: "demo_seed",
      sourceId: "proc-1",
    },
  });
  await prisma.process.create({
    data: {
      organizationId: org.id,
      departmentId: ops.id,
      name: "Exception triage",
      description: "Manual exception queue",
      avgCycleDays: 12,
      source: "demo_seed",
      sourceId: "proc-2",
    },
  });

  const settings = await prisma.orgSettings.findUniqueOrThrow({ where: { organizationId: org.id } });
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(10, 0, 0, 0);
    return d;
  };

  const mkOpp = async (o: {
    title: string;
    description: string;
    source: string;
    department: string;
    type: string;
    status: string;
    priority: string;
    amount: number;
    recovered?: number;
    assigneeId?: string;
    recoveredAt?: Date | null;
    identifiedAt?: Date;
    ageDaysHint?: number;
  }) => {
    const identifiedAt = o.identifiedAt ?? daysAgo(o.ageDaysHint ?? 7);
    const scored = scoreWorkItem({
      amount: o.amount,
      ageDays: Math.max(0, Math.floor((Date.now() - identifiedAt.getTime()) / 86400000)),
      priorityHint: o.priority,
      evidenceCount: 1,
      settings,
    });
    const created = await prisma.opportunity.create({
      data: {
        organizationId: org.id,
        title: o.title,
        description: o.description,
        source: o.source,
        department: o.department,
        type: o.type,
        status: o.status,
        priority: o.priority,
        score: scored.score,
        scoreFactorsJson: JSON.stringify(scored.factors),
        potentialAmount: o.amount,
        estimatedAmount: o.amount,
        approvedAmount: o.status === "APPROVED" || o.status === "IN_RECOVERY" || o.status === "RECOVERED" || o.status === "VERIFIED" ? o.amount * 0.8 : 0,
        inProgressAmount: o.status === "IN_RECOVERY" ? o.amount * 0.3 : 0,
        recoveredAmount: o.recovered ?? 0,
        verifiedAmount: o.status === "VERIFIED" ? o.recovered ?? 0 : 0,
        assigneeId: o.assigneeId,
        identifiedAt,
        recoveredAt: o.recoveredAt ?? null,
        verifiedAt: o.status === "VERIFIED" ? (o.recoveredAt ?? new Date()) : null,
        createdAt: identifiedAt,
      },
    });
    await prisma.statusHistory.create({
      data: {
        organizationId: org.id,
        entityType: "Opportunity",
        entityId: created.id,
        fromStatus: null,
        toStatus: o.status,
        actorId: demoUser.id,
        note: "Added to the workspace",
        createdAt: identifiedAt,
      },
    });
    await prisma.evidence.create({
      data: {
        organizationId: org.id,
        opportunityId: created.id,
        kind: "FACT",
        summary: o.description,
        createdAt: identifiedAt,
        source: o.source,
      },
    });
    return created;
  };

  // Demo cadence: one RR and one OE item identified per week across the 8-week charts (52…10 days ago),
  // so the demo has no empty weeks. Recovery/resolution dates always follow identification.
  await mkOpp({
    title: "Underbilled contract services — Q3",
    description: "Variance between contracted rates and invoiced amounts for managed services (linked to Northwind).",
    source: "billing_export",
    department: "Finance",
    type: "underbilling",
    status: "IDENTIFIED",
    priority: OpportunityPriority.CRITICAL,
    amount: 182000,
    identifiedAt: daysAgo(38),
  });
  await mkOpp({
    title: "Uncollected late fees",
    description: "Eligible late fees not applied per policy.",
    source: "ar_aging",
    department: "Collections",
    type: "fee_leakage",
    status: "IN_RECOVERY",
    priority: OpportunityPriority.HIGH,
    amount: 64000,
    recovered: 12000,
    assigneeId: demoUser.id,
    identifiedAt: daysAgo(24),
    recoveredAt: daysAgo(10),
  });
  await mkOpp({
    title: "Missed change-order revenue",
    description: "Scope changes delivered without corresponding invoices.",
    source: "project_mgmt",
    department: "Delivery",
    type: "change_order",
    status: "UNDER_REVIEW",
    priority: OpportunityPriority.HIGH,
    amount: 95500,
    identifiedAt: daysAgo(17),
  });
  await mkOpp({
    title: "Duplicate discount applied",
    description: "Stacked discounts beyond authorized matrix.",
    source: "crm",
    department: "Sales Ops",
    type: "discount_abuse",
    status: "VERIFIED",
    priority: OpportunityPriority.MEDIUM,
    amount: 22000,
    recovered: 22000,
    recoveredAt: daysAgo(21),
    identifiedAt: daysAgo(45),
    assigneeId: demoUser.id,
  });
  await mkOpp({
    title: "Payer underpayment batch",
    description: "Allowed amount below contracted fee schedule.",
    source: "claims",
    department: "Revenue Cycle",
    type: "underpayment",
    status: "IN_RECOVERY",
    priority: OpportunityPriority.CRITICAL,
    amount: 210000,
    recovered: 45000,
    assigneeId: demoOwner.id,
    identifiedAt: daysAgo(31),
    recoveredAt: daysAgo(7),
  });
  await mkOpp({
    title: "Contract rate variance — renewals",
    description: "Renewals billed at legacy rates below current schedule.",
    source: "contracts",
    department: "Finance",
    type: "contract",
    status: "IDENTIFIED",
    priority: OpportunityPriority.HIGH,
    amount: 88000,
    identifiedAt: daysAgo(10),
  });
  await mkOpp({
    title: "Denial write-off cluster",
    description: "Cluster of denials closed without appeal.",
    source: "claims",
    department: "Revenue Cycle",
    type: "denial",
    status: "RECOVERED",
    priority: OpportunityPriority.MEDIUM,
    amount: 31000,
    recovered: 27500,
    identifiedAt: daysAgo(52),
    recoveredAt: daysAgo(14),
    assigneeId: demoUser.id,
  });

  const mkIneff = async (o: {
    title: string;
    description: string;
    source: string;
    department: string;
    type: string;
    status: string;
    priority: string;
    waste: number;
    realized?: number;
    hours?: number;
    auto?: boolean;
    assigneeId?: string;
    processId?: string;
    resolvedAt?: Date | null;
    identifiedAt?: Date;
    ageDaysHint?: number;
  }) => {
    const identifiedAt = o.identifiedAt ?? daysAgo(o.ageDaysHint ?? 10);
    const scored = scoreWorkItem({
      amount: o.waste,
      ageDays: Math.max(0, Math.floor((Date.now() - identifiedAt.getTime()) / 86400000)),
      priorityHint: o.priority,
      evidenceCount: 1,
      settings,
    });
    const created = await prisma.inefficiency.create({
      data: {
        organizationId: org.id,
        processId: o.processId,
        title: o.title,
        description: o.description,
        source: o.source,
        department: o.department,
        type: o.type,
        status: o.status,
        priority: o.priority,
        score: scored.score,
        scoreFactorsJson: JSON.stringify(scored.factors),
        estimatedWasteAnnual: o.waste,
        projectedSavings: o.waste,
        recoveredAnnual: o.realized ?? 0,
        realizedSavings: o.realized ?? 0,
        hoursWastedWeekly: o.hours,
        projectedHoursWeekly: o.hours,
        automationCandidate: o.auto ?? false,
        assigneeId: o.assigneeId,
        identifiedAt,
        resolvedAt: o.resolvedAt ?? null,
        verifiedAt: o.status === "VERIFIED" || o.status === "REALIZED" ? (o.resolvedAt ?? new Date()) : null,
        createdAt: identifiedAt,
      },
    });
    await prisma.statusHistory.create({
      data: {
        organizationId: org.id,
        entityType: "Inefficiency",
        entityId: created.id,
        fromStatus: null,
        toStatus: o.status,
        actorId: demoUser.id,
        note: "Added to the workspace",
        createdAt: identifiedAt,
      },
    });
    await prisma.evidence.create({
      data: {
        organizationId: org.id,
        inefficiencyId: created.id,
        kind: "FACT",
        summary: o.description,
        createdAt: identifiedAt,
        source: o.source,
      },
    });
    return created;
  };

  await mkIneff({
    title: "Manual invoice reconciliation",
    description: "Analysts reconcile invoices in spreadsheets weekly — linked to Finance process.",
    source: "time_study",
    department: "Finance",
    type: "manual_process",
    status: "IDENTIFIED",
    priority: InefficiencyPriority.HIGH,
    waste: 78000,
    hours: 24,
    auto: true,
    processId: procInvoice.id,
    identifiedAt: daysAgo(31),
  });
  await mkIneff({
    title: "Duplicate data entry across ERP and CRM",
    description: "Same customer updates entered twice.",
    source: "interview",
    department: "Ops",
    type: "rework",
    status: "IMPLEMENTING",
    priority: InefficiencyPriority.CRITICAL,
    waste: 120000,
    realized: 15000,
    hours: 40,
    auto: true,
    assigneeId: demoUser.id,
    identifiedAt: daysAgo(24),
    resolvedAt: daysAgo(9),
  });
  await mkIneff({
    title: "Ad-hoc report generation",
    description: "Leadership packs assembled manually each month.",
    source: "observation",
    department: "Strategy",
    type: "reporting",
    status: "ANALYZING",
    priority: InefficiencyPriority.MEDIUM,
    waste: 36000,
    hours: 12,
    identifiedAt: daysAgo(17),
  });
  await mkIneff({
    title: "Exception queue backlog",
    description: "Exceptions age beyond SLA without owner.",
    source: "ticket_system",
    department: "Support",
    type: "queue_delay",
    status: "VERIFIED",
    priority: InefficiencyPriority.HIGH,
    waste: 54000,
    realized: 40000,
    hours: 18,
    identifiedAt: daysAgo(38),
    resolvedAt: daysAgo(20),
  });
  await mkIneff({
    title: "Handoff lag — sales to delivery",
    description: "Average 9-day lag between close and kickoff.",
    source: "process_map",
    department: "Delivery",
    type: "handoff_delay",
    status: "IDENTIFIED",
    priority: InefficiencyPriority.HIGH,
    waste: 67000,
    hours: 15,
    auto: true,
    identifiedAt: daysAgo(10),
  });
  await mkIneff({
    title: "Spreadsheet inventory sync",
    description: "Nightly inventory counts reconciled in sheets.",
    source: "time_study",
    department: "Ops",
    type: "manual_process",
    status: "REALIZED",
    priority: InefficiencyPriority.MEDIUM,
    waste: 42000,
    realized: 28000,
    hours: 10,
    auto: true,
    identifiedAt: daysAgo(45),
    resolvedAt: daysAgo(25),
  });

  await prisma.approvalRequest.create({
    data: {
      organizationId: org.id,
      type: "AUTOMATION_CANDIDATE",
      title: "Propose RPA for invoice reconciliation",
      description: "Proposal only. No automation runs without explicit approval.",
      status: "PENDING",
      payloadJson: JSON.stringify({
        inefficiencyTitle: "Manual invoice reconciliation",
        proposedAction: "document_only",
        executesExternally: false,
      }),
      requestedById: demoUser.id,
    },
  });
  await prisma.approvalRequest.create({
    data: {
      organizationId: org.id,
      type: "EXTERNAL_ACTION",
      title: "Push claim adjustment to billing system",
      description: "Waiting on the billing system connection. Nothing runs until it is connected and approved.",
      status: "PENDING",
      needsIntegration: "billing_system",
      payloadJson: JSON.stringify({ provider: "billing_system", executesExternally: false }),
      requestedById: manager.id,
    },
  });

  // ── Live-demo story (additive) ────────────────────────────────────────────────────────────
  // One Revenue Recovery item and one Operations Efficiency item carry the full arc a presenter
  // walks through: evidence → owner → approval → recorded outcome → verified / realized.
  // Illustrative example data for the Acme demo workspace only — not client results.
  {
    const at = (n: number, h = 10) => {
      const d = daysAgo(n);
      d.setHours(h, 0, 0, 0);
      return d;
    };
    const trail = async (entityType: "Opportunity" | "Inefficiency", entityId: string, identifiedAt: Date, steps: Array<[string | null, string, string, string, number]>) => {
      await prisma.statusHistory.deleteMany({ where: { organizationId: org.id, entityType, entityId } });
      await prisma.statusHistory.create({ data: { organizationId: org.id, entityType, entityId, fromStatus: null, toStatus: "IDENTIFIED", actorId: demoUser.id, note: "Identified from imported records", createdAt: identifiedAt } });
      for (const [fromStatus, toStatus, actorId, note, n] of steps) {
        await prisma.statusHistory.create({ data: { organizationId: org.id, entityType, entityId, fromStatus, toStatus, actorId, note, createdAt: at(n, 11) } });
      }
    };

    // RR — Payer underpayment batch: in recovery, first batch recovered AND verified.
    const payer = await prisma.opportunity.findFirst({ where: { organizationId: org.id, title: "Payer underpayment batch" } });
    if (payer) {
      await prisma.opportunity.update({
        where: { id: payer.id },
        data: {
          description: "Claims from one commercial payer were paid below the contracted fee schedule. The first appeal batch has been paid and matched to remittance; the remaining claims are being appealed.",
          verifiedAmount: 45000,
          verifiedAt: at(5),
        },
      });
      await prisma.evidence.createMany({
        data: [
          { organizationId: org.id, opportunityId: payer.id, kind: "METRIC", summary: "412 claims paid below contracted rate · average shortfall $510 per claim", source: "claims", createdAt: at(31) },
          { organizationId: org.id, opportunityId: payer.id, kind: "DOCUMENT", summary: "Payer agreement fee schedule (effective Jan 1) — contracted allowed amounts by code", source: "contracts", createdAt: at(30) },
          { organizationId: org.id, opportunityId: payer.id, kind: "FACT", summary: "First appeal batch: $45,000 received and matched to remittance advice", source: "claims", createdAt: at(5) },
        ],
      });
      await trail("Opportunity", payer.id, payer.identifiedAt, [
        ["IDENTIFIED", "UNDER_REVIEW", demoUser.id, "Evidence checked against the payer agreement", 29],
        ["UNDER_REVIEW", "APPROVED", manager.id, "Appeal approved — within contract terms", 27],
        ["APPROVED", "IN_RECOVERY", demoOwner.id, "First appeal batch submitted to payer", 26],
      ]);
      await prisma.approvalRequest.create({
        data: {
          organizationId: org.id,
          type: "RECOVERY_PLAN",
          title: "Appeal underpaid claims — Payer underpayment batch",
          description: "Submit appeals for claims paid below the contracted fee schedule. Your team submits; Kaivaryn records the decision only.",
          status: "APPROVED",
          payloadJson: JSON.stringify({ opportunityId: payer.id, amount: 210000, executesExternally: false }),
          requestedById: demoOwner.id,
          decidedById: manager.id,
          decidedAt: at(27),
          decisionNote: "Evidence reviewed; appeal is within contract terms.",
          createdAt: at(28),
        },
      });
      await prisma.task.create({
        data: { organizationId: org.id, title: "Submit second appeal batch (remaining 324 claims)", entityType: "Opportunity", entityId: payer.id, status: "OPEN", dueAt: at(-5), assigneeId: demoOwner.id, createdById: manager.id, createdAt: at(5) },
      });
      await prisma.opportunityNote.create({
        data: { opportunityId: payer.id, authorId: demoOwner.id, body: "First batch paid in full. $45,000 recovered and verified against remittance. Second batch goes out this week.", createdAt: at(5, 15) },
      });
    }

    // RR — Missed change-order revenue: owned, waiting on an approval the presenter can decide live.
    const changeOrders = await prisma.opportunity.findFirst({ where: { organizationId: org.id, title: "Missed change-order revenue" } });
    if (changeOrders) {
      await prisma.opportunity.update({ where: { id: changeOrders.id }, data: { assigneeId: manager.id } });
      await prisma.evidence.create({
        data: { organizationId: org.id, opportunityId: changeOrders.id, kind: "METRIC", summary: "14 approved change orders delivered with no matching invoice line", source: "project_mgmt", createdAt: at(16) },
      });
      await trail("Opportunity", changeOrders.id, changeOrders.identifiedAt, [["IDENTIFIED", "UNDER_REVIEW", demoUser.id, "Matched delivered scope to invoices; owner assigned", 15]]);
      await prisma.approvalRequest.create({
        data: {
          organizationId: org.id,
          type: "RECOVERY_PLAN",
          title: "Bill delivered change orders — Missed change-order revenue",
          description: "Issue invoices for 14 delivered change orders. Approving records the decision; your billing team issues the invoices.",
          status: "PENDING",
          payloadJson: JSON.stringify({ opportunityId: changeOrders.id, amount: 95500, executesExternally: false }),
          requestedById: manager.id,
          createdAt: at(2),
        },
      });
    }

    // OE — Duplicate data entry: approved automation, savings realized so far recorded.
    const dupEntry = await prisma.inefficiency.findFirst({ where: { organizationId: org.id, title: "Duplicate data entry across ERP and CRM" } });
    if (dupEntry) {
      await prisma.inefficiency.update({
        where: { id: dupEntry.id },
        data: {
          description: "Customer updates are keyed into the ERP and again into the CRM. An approved sync now covers billing addresses; contacts are next.",
          realizedHoursWeekly: 6,
        },
      });
      await prisma.evidence.createMany({
        data: [
          { organizationId: org.id, inefficiencyId: dupEntry.id, kind: "METRIC", summary: "Time study: 40 hours a week re-keying customer updates across three analysts", source: "interview", createdAt: at(24) },
          { organizationId: org.id, inefficiencyId: dupEntry.id, kind: "FACT", summary: "Billing-address sync live; re-keying down 6 hours a week, measured over four weeks", source: "interview", createdAt: at(9) },
        ],
      });
      await trail("Inefficiency", dupEntry.id, dupEntry.identifiedAt, [
        ["IDENTIFIED", "ANALYZING", demoUser.id, "Time study confirmed; owner assigned", 22],
        ["ANALYZING", "APPROVED", demoOwner.id, "Sync automation approved", 20],
        ["APPROVED", "IMPLEMENTING", demoUser.id, "Phase 1 (billing addresses) live", 12],
      ]);
      await prisma.approvalRequest.create({
        data: {
          organizationId: org.id,
          type: "AUTOMATION_CANDIDATE",
          title: "Automate ERP–CRM customer sync — Duplicate data entry",
          description: "Replace manual re-keying with a scheduled sync, in two phases. Your IT team implements; Kaivaryn records the decision only.",
          status: "APPROVED",
          payloadJson: JSON.stringify({ inefficiencyId: dupEntry.id, projectedSavings: 120000, executesExternally: false }),
          requestedById: demoUser.id,
          decidedById: demoOwner.id,
          decidedAt: at(20),
          decisionNote: "Approved in two phases. Measure hours saved after each.",
          createdAt: at(21),
        },
      });
      await prisma.task.create({
        data: { organizationId: org.id, title: "Phase 2: extend sync to customer contacts", entityType: "Inefficiency", entityId: dupEntry.id, status: "OPEN", dueAt: at(-10), assigneeId: demoUser.id, createdById: demoOwner.id, createdAt: at(9) },
      });
      await prisma.inefficiencyNote.create({
        data: { inefficiencyId: dupEntry.id, authorId: demoUser.id, body: "Phase 1 recorded: $15,000 annualized savings realized, 6 hours a week back. Phase 2 starts next sprint.", createdAt: at(9, 15) },
      });
    }

    // OE — Exception queue backlog: a completed, verified example.
    const backlog = await prisma.inefficiency.findFirst({ where: { organizationId: org.id, title: "Exception queue backlog" } });
    if (backlog) {
      await prisma.inefficiency.update({ where: { id: backlog.id }, data: { assigneeId: manager.id, realizedHoursWeekly: 13 } });
      await prisma.evidence.create({
        data: { organizationId: org.id, inefficiencyId: backlog.id, kind: "FACT", summary: "Exceptions now owned on arrival; median age down from 11 days to 3", source: "ticket_system", createdAt: at(20) },
      });
      await trail("Inefficiency", backlog.id, backlog.identifiedAt, [
        ["IDENTIFIED", "IMPLEMENTING", manager.id, "Ownership rule and daily triage introduced", 30],
        ["IMPLEMENTING", "VERIFIED", demoOwner.id, "Savings confirmed against four weeks of queue data", 20],
      ]);
    }

    // Link the existing invoice-reconciliation approval to its inefficiency so it opens in context.
    const recon = await prisma.inefficiency.findFirst({ where: { organizationId: org.id, title: "Manual invoice reconciliation" } });
    if (recon) {
      const rpa = await prisma.approvalRequest.findFirst({ where: { organizationId: org.id, title: "Propose RPA for invoice reconciliation" } });
      if (rpa) {
        await prisma.approvalRequest.update({
          where: { id: rpa.id },
          data: { payloadJson: JSON.stringify({ inefficiencyId: recon.id, inefficiencyTitle: recon.title, proposedAction: "document_only", executesExternally: false }) },
        });
      }
    }
  }

  await prisma.onboardingProgress.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: demoUser.id } },
    update: {
      currentStep: 4,
      completedSteps: JSON.stringify(["welcome", "products", "integrations", "team", "done"]),
      completedAt: new Date(),
    },
    create: {
      organizationId: org.id,
      userId: demoUser.id,
      currentStep: 4,
      completedSteps: JSON.stringify(["welcome", "products", "integrations", "team", "done"]),
      completedAt: new Date(),
    },
  });

  // Run detection to interconnect source data → opportunities/findings
  const detection = await runDetectionEngines(org.id);
  console.log("Detection:", detection.rulesFired.join(", ") || "(none)", "insufficient:", detection.insufficient.length);

  await prisma.notification.create({
    data: {
      organizationId: org.id,
      userId: demoUser.id,
      title: "Welcome to Action Center",
      body: "Review critical RR/OE items and pending approvals.",
      href: "/app/action-center",
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      actorId: admin.id,
      action: "seed.completed",
      entityType: "Organization",
      entityId: org.id,
      metadataJson: JSON.stringify({ note: "DEMO enterprise seed", detection }),
    },
  });

  // silence unused dept vars
  void sales;

  // Operating layer demo (renovated 720 SI): system playbooks, standing orders, an initiative,
  // and one REAL playbook run (executes nine-return cycles + digest + recall on the seeded data).
  {
    for (const id of [org.id, other.id]) await ensureSystemPlaybooks(id);
    const opCtx = { organizationId: org.id, userId: demoOwner.id, role: "OWNER" };
    await createStandingOrder(opCtx, { directive: "Every day executive digest", title: "Daily executive digest" });
    const sweep = await findPlaybook(opCtx, "revenue-leakage-sweep");
    await createStandingOrder(opCtx, { directive: "Every week run playbook revenue-leakage-sweep", title: "Weekly revenue leakage sweep", kind: "PLAYBOOK", playbookId: sweep?.id ?? null });
    await createStandingOrder(opCtx, { directive: "Every hour health check", title: "Hourly health check" });
    const ini = await createInitiative(opCtx, {
      name: "Q4 billing leakage cleanup",
      description: "Demo initiative grouping the highest-scoring revenue items. Amounts are seeded demo estimates, not client results.",
      product: "REVENUE_RECOVERY",
    });
    const topOpps = await prisma.opportunity.findMany({ where: { organizationId: org.id }, orderBy: { score: "desc" }, take: 3, select: { id: true } });
    for (const o of topOpps) await linkToInitiative(opCtx, ini.id, "OPPORTUNITY", o.id);
    if (sweep) await linkToInitiative(opCtx, ini.id, "PLAYBOOK", sweep.id);
    const { run } = await runPlaybook(opCtx, "executive-weekly-review", { initiativeId: ini.id });
    await runHealthCheck(opCtx, "MANUAL");
    console.log(`Operating layer: weekly review run ${run.status}`);
  }

  // Stable CHIEF live demo agent — same-domain /a/internal-status
  {
    const slug = "internal-status";
    const bundle = generateWebBundle({
      runtime: "static-site",
      instruction: "Build a live internal status page for Kaivaryn platform health",
      slug,
      titleHint: "Kaivaryn Internal Status",
    });
    const sourceCode = webAgentRunnerSource("static-site", bundle.title);
    const base = publicBaseUrl();
    const agent = await prisma.agentDefinition.upsert({
      where: { slug },
      update: {
        name: "Kaivaryn Internal Status Page",
        description: "CHIEF-manufactured live status microsite (seeded demo)",
        kind: "STATIC_SITE",
        status: "REGISTERED",
        ownerRole: "CEO",
        capabilitiesJson: JSON.stringify({ runtime: "static-site", deployAdapter: "same-domain" }),
      },
      create: {
        slug,
        name: "Kaivaryn Internal Status Page",
        description: "CHIEF-manufactured live status microsite (seeded demo)",
        kind: "STATIC_SITE",
        status: "REGISTERED",
        ownerRole: "CEO",
        capabilitiesJson: JSON.stringify({ runtime: "static-site", deployAdapter: "same-domain" }),
        createdById: curtis.id,
      },
    });
    let version = await prisma.agentVersion.findFirst({ where: { agentId: agent.id, version: 1 } });
    if (!version) {
      version = await prisma.agentVersion.create({
        data: {
          agentId: agent.id,
          version: 1,
          changelog: "Seeded live status page",
          status: "APPROVED",
          packagePath: `data/agents/${slug}/v1`,
          packageJson: JSON.stringify({ slug, runtime: "static-site", entry: "web/index.html" }),
          sourceCode,
          webBundleJson: JSON.stringify(bundle),
          runtime: "static-site",
          architectureJson: JSON.stringify({ runtime: "static-site", deployAdapter: "same-domain" }),
          toolsJson: JSON.stringify([{ toolId: "platform.health.read", scope: "READ" }]),
          createdById: curtis.id,
        },
      });
    } else {
      version = await prisma.agentVersion.update({
        where: { id: version.id },
        data: {
          status: "APPROVED",
          sourceCode,
          webBundleJson: JSON.stringify(bundle),
          runtime: "static-site",
        },
      });
    }
    await prisma.agentDeployment.updateMany({
      where: { agentId: agent.id, environment: "PRODUCTION", status: "ACTIVE" },
      data: { status: "ROLLED_BACK", rolledBackAt: new Date() },
    });
    await prisma.agentDeployment.create({
      data: {
        agentId: agent.id,
        versionId: version.id,
        environment: "PRODUCTION",
        status: "ACTIVE",
        approvedById: curtis.id,
        activatedAt: new Date(),
        notes: "Seeded CHIEF live demo agent",
        liveUrl: `${base}/a/${slug}`,
        healthUrl: `${base}/api/a/${slug}/health`,
        healthStatus: "OK",
        healthCheckedAt: new Date(),
        adapter: "same-domain",
      },
    });
    console.log(`  Live agent:  ${base}/a/${slug}`);
  }

  console.log("Seed complete.");
  console.log(`  Super admin: admin@kaivaryn.com / ${process.env.NODE_ENV === "production" ? "[BOOTSTRAP_ADMIN_PASSWORD env]" : "KaivarynAdmin!2026"}`);
  console.log("  CEO:         curtis@kaivaryn.com / [see BOOTSTRAP_CEO_PASSWORD or seed fallback]");
  console.log("  CSEO:        don@kaivaryn.com / [see BOOTSTRAP_CSEO_PASSWORD or seed fallback]");
  console.log("  Demo user:   demo@kaivaryn.com / DemoClient!2026");
  console.log("  Demo org:    Acme Industries (acme-demo, isDemo)");
  console.log("  Other org:   Other Co (TEST) — isolation foil");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
