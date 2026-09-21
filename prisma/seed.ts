import { PrismaClient } from "@prisma/client";
import { Role, Product, OpportunityStatus, OpportunityPriority, InefficiencyStatus, InefficiencyPriority, IntegrationStatus } from "../src/lib/enums";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const STRIPE = process.env.STRIPE_PAYMENT_LINK || "https://buy.stripe.com/14AaEZgJsdDNeTFePLeUU01";

async function main() {
  console.log("Seeding Kaivaryn…");

  await prisma.pricingConfig.upsert({
    where: { key: "default" },
    update: {
      introductorySeats: 10,
      introductoryPriceCents: 1_000_000,
      standardPriceCents: 2_000_000,
      stripePaymentLink: STRIPE,
    },
    create: {
      key: "default",
      introductorySeats: 10,
      introductoryPriceCents: 1_000_000,
      standardPriceCents: 2_000_000,
      currency: "USD",
      stripePaymentLink: STRIPE,
    },
  });

  const adminHash = await hash("KaivarynAdmin!2026", 12);
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

  const demoHash = await hash("DemoClient!2026", 12);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@kaivaryn.com" },
    update: { passwordHash: demoHash, name: "Demo Analyst" },
    create: {
      email: "demo@kaivaryn.com",
      name: "Demo Analyst",
      passwordHash: demoHash,
      role: Role.VIEWER,
    },
  });

  const demoOwnerHash = await hash("DemoClient!2026", 12);
  const demoOwner = await prisma.user.upsert({
    where: { email: "owner@acme-demo.kaivaryn.com" },
    update: { passwordHash: demoOwnerHash, name: "Demo Owner" },
    create: {
      email: "owner@acme-demo.kaivaryn.com",
      name: "Demo Owner",
      passwordHash: demoOwnerHash,
      role: Role.VIEWER,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "acme-demo" },
    update: { name: "Acme Demo (DEMO)", isDemo: true },
    create: { name: "Acme Demo (DEMO)", slug: "acme-demo", isDemo: true },
  });

  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: demoUser.id } },
    update: { role: Role.ANALYST },
    create: { organizationId: org.id, userId: demoUser.id, role: Role.ANALYST },
  });
  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: demoOwner.id } },
    update: { role: Role.OWNER },
    create: { organizationId: org.id, userId: demoOwner.id, role: Role.OWNER },
  });

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

  await prisma.opportunityNote.deleteMany({
    where: { opportunity: { organizationId: org.id } },
  });
  await prisma.opportunity.deleteMany({ where: { organizationId: org.id } });

  const opportunities = [
    {
      title: "[DEMO] Underbilled contract services — Q3",
      description: "DEMO: Variance between contracted rates and invoiced amounts for managed services.",
      source: "billing_export",
      department: "Finance",
      type: "underbilling",
      status: OpportunityStatus.NEW,
      priority: OpportunityPriority.CRITICAL,
      estimatedAmount: 182000,
      recoveredAmount: 0,
    },
    {
      title: "[DEMO] Uncollected late fees",
      description: "DEMO: Eligible late fees not applied per policy.",
      source: "ar_aging",
      department: "Collections",
      type: "fee_leakage",
      status: OpportunityStatus.IN_PROGRESS,
      priority: OpportunityPriority.HIGH,
      estimatedAmount: 64000,
      recoveredAmount: 12000,
      assigneeId: demoUser.id,
    },
    {
      title: "[DEMO] Missed change-order revenue",
      description: "DEMO: Scope changes delivered without corresponding invoices.",
      source: "project_mgmt",
      department: "Delivery",
      type: "change_order",
      status: OpportunityStatus.NEW,
      priority: OpportunityPriority.HIGH,
      estimatedAmount: 95500,
      recoveredAmount: 0,
    },
    {
      title: "[DEMO] Duplicate discount applied",
      description: "DEMO: Stacked discounts beyond authorized matrix.",
      source: "crm",
      department: "Sales Ops",
      type: "discount_abuse",
      status: OpportunityStatus.RECOVERED,
      priority: OpportunityPriority.MEDIUM,
      estimatedAmount: 22000,
      recoveredAmount: 22000,
      recoveredAt: new Date(),
      assigneeId: demoUser.id,
    },
    {
      title: "[DEMO] Stale credit memos",
      description: "DEMO: Open credits with no matching activity — review for reclaim.",
      source: "gl",
      department: "Accounting",
      type: "credit_memo",
      status: OpportunityStatus.DISMISSED,
      priority: OpportunityPriority.LOW,
      estimatedAmount: 4800,
      recoveredAmount: 0,
    },
    {
      title: "[DEMO] Payer underpayment batch",
      description: "DEMO: Allowed amount below contracted fee schedule.",
      source: "claims",
      department: "Revenue Cycle",
      type: "underpayment",
      status: OpportunityStatus.IN_PROGRESS,
      priority: OpportunityPriority.CRITICAL,
      estimatedAmount: 210000,
      recoveredAmount: 45000,
      assigneeId: demoOwner.id,
    },
  ];

  for (const o of opportunities) {
    await prisma.opportunity.create({ data: { organizationId: org.id, ...o } });
  }

  await prisma.inefficiencyNote.deleteMany({
    where: { inefficiency: { organizationId: org.id } },
  });
  await prisma.inefficiency.deleteMany({ where: { organizationId: org.id } });

  const inefficiencies = [
    {
      title: "[DEMO] Manual invoice reconciliation",
      description: "DEMO: Analysts reconcile invoices in spreadsheets weekly.",
      source: "time_study",
      department: "Finance",
      type: "manual_process",
      status: InefficiencyStatus.NEW,
      priority: InefficiencyPriority.HIGH,
      estimatedWasteAnnual: 78000,
      recoveredAnnual: 0,
      hoursWastedWeekly: 24,
      automationCandidate: true,
    },
    {
      title: "[DEMO] Duplicate data entry across ERP and CRM",
      description: "DEMO: Same customer updates entered twice.",
      source: "interview",
      department: "Ops",
      type: "rework",
      status: InefficiencyStatus.IN_PROGRESS,
      priority: InefficiencyPriority.CRITICAL,
      estimatedWasteAnnual: 120000,
      recoveredAnnual: 15000,
      hoursWastedWeekly: 40,
      automationCandidate: true,
      assigneeId: demoUser.id,
    },
    {
      title: "[DEMO] Ad-hoc report generation",
      description: "DEMO: Leadership packs assembled manually each month.",
      source: "observation",
      department: "Strategy",
      type: "reporting",
      status: InefficiencyStatus.NEW,
      priority: InefficiencyPriority.MEDIUM,
      estimatedWasteAnnual: 36000,
      recoveredAnnual: 0,
      hoursWastedWeekly: 12,
      automationCandidate: false,
    },
    {
      title: "[DEMO] Exception queue backlog",
      description: "DEMO: Exceptions age beyond SLA without owner.",
      source: "ticket_system",
      department: "Support",
      type: "queue_delay",
      status: InefficiencyStatus.RESOLVED,
      priority: InefficiencyPriority.HIGH,
      estimatedWasteAnnual: 54000,
      recoveredAnnual: 40000,
      hoursWastedWeekly: 18,
      automationCandidate: false,
      resolvedAt: new Date(),
    },
  ];

  for (const i of inefficiencies) {
    await prisma.inefficiency.create({ data: { organizationId: org.id, ...i } });
  }

  // Sample approval (gated — not auto-executed)
  await prisma.approvalRequest.deleteMany({ where: { organizationId: org.id } });
  await prisma.approvalRequest.create({
    data: {
      organizationId: org.id,
      type: "AUTOMATION_CANDIDATE",
      title: "[DEMO] Propose RPA for invoice reconciliation",
      description:
        "DEMO: Candidate only. No external automation will run without explicit approval.",
      status: "PENDING",
      payloadJson: JSON.stringify({
        inefficiencyTitle: "Manual invoice reconciliation",
        proposedAction: "document_only",
        executesExternally: false,
      }),
      requestedById: demoUser.id,
    },
  });

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

  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      actorId: admin.id,
      action: "seed.completed",
      entityType: "Organization",
      entityId: org.id,
      metadataJson: JSON.stringify({ note: "DEMO seed data loaded" }),
    },
  });

  console.log("Seed complete.");
  console.log("  Super admin: admin@kaivaryn.com / KaivarynAdmin!2026");
  console.log("  Demo user:   demo@kaivaryn.com / DemoClient!2026");
  console.log("  Demo org:    Acme Demo (DEMO)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
