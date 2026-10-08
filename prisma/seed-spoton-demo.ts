/**
 * "SpotOn Demo Restaurant" — example workspace for demos with businesses that already run SpotOn.
 *
 * SAMPLE DATA ONLY (isDemo = true → every page shows the "Example workspace" tag). Not a real restaurant,
 * not client results. Rebuilt on every boot like the Acme demo; touches only the org with slug "spoton-demo"
 * and its two demo users.
 *
 * Flow mirrors a real merchant: a SpotOn "Orders Per Day" CSV is imported through the same importer the
 * Integrations page uses → detection turns it into estimates → a few items carry recorded outcomes
 * (recorded by the demo GM, verified by the demo owner) so the Money recovered tracker has a trail.
 * Every dollar shown is either computed from the imported sample file or stated with its own arithmetic.
 *
 * Login: spoton-demo@kaivaryn.com. The password comes ONLY from SPOTON_DEMO_PASSWORD (never committed).
 * Without it the user exists but cannot sign in (random password).
 */
import type { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { scoreWorkItem } from "../src/lib/scoring";
import { runDetectionEngines } from "../src/lib/detection";
import { runSpotOnImport } from "../src/lib/integrations/spoton/import";
import { buildSpotOnDemoDays, spotOnDemoCsv, SPOTON_DEMO_DAYS, nyDate } from "../src/lib/integrations/spoton/demo-data";
import { getSpotOnSummary } from "../src/lib/integrations/spoton/summary";
import { ensureSystemPlaybooks, runPlaybook, createStandingOrder, findPlaybook } from "../src/lib/operate";
import { addRestaurantPlaybook } from "../src/lib/industry/context";

export const SPOTON_DEMO_SLUG = "spoton-demo";
export const SPOTON_DEMO_ORG_NAME = "SpotOn Demo Restaurant";
export const SPOTON_DEMO_OWNER_EMAIL = "spoton-demo@kaivaryn.com";
export const SPOTON_DEMO_GM_EMAIL = "gm@spoton-demo.kaivaryn.com";

const r2 = (n: number) => Math.round(n * 100) / 100;
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function seedSpotOnDemo(prisma: PrismaClient, opts: { wipeOrg: (orgId: string) => Promise<void>; log?: (m: string) => void }) {
  const log = opts.log ?? ((m: string) => console.log(m));
  const pw = process.env.SPOTON_DEMO_PASSWORD?.trim();
  const ownerHash = await hash(pw && pw.length >= 12 ? pw : randomBytes(24).toString("base64url"), 12);
  const gmHash = await hash(randomBytes(24).toString("base64url"), 12);

  const owner = await prisma.user.upsert({
    where: { email: SPOTON_DEMO_OWNER_EMAIL },
    update: { name: "Taylor Brooks (demo owner)", ...(pw && pw.length >= 12 ? { passwordHash: ownerHash } : {}) },
    create: { email: SPOTON_DEMO_OWNER_EMAIL, name: "Taylor Brooks (demo owner)", passwordHash: ownerHash, role: "VIEWER" },
  });
  const gm = await prisma.user.upsert({
    where: { email: SPOTON_DEMO_GM_EMAIL },
    update: { name: "Dana Ruiz (demo GM)" },
    create: { email: SPOTON_DEMO_GM_EMAIL, name: "Dana Ruiz (demo GM)", passwordHash: gmHash, role: "VIEWER" },
  });

  const org = await prisma.organization.upsert({
    where: { slug: SPOTON_DEMO_SLUG },
    update: { name: SPOTON_DEMO_ORG_NAME, isDemo: true },
    create: { name: SPOTON_DEMO_ORG_NAME, slug: SPOTON_DEMO_SLUG, isDemo: true },
  });
  await opts.wipeOrg(org.id);
  await prisma.integrationConnection.deleteMany({ where: { organizationId: org.id } });

  for (const [userId, role] of [[owner.id, "OWNER"], [gm.id, "MANAGER"]] as const) {
    await prisma.membership.upsert({ where: { organizationId_userId: { organizationId: org.id, userId } }, update: { role }, create: { organizationId: org.id, userId, role } });
  }
  for (const product of ["REVENUE_RECOVERY", "OPERATIONS_EFFICIENCY"]) {
    await prisma.entitlement.upsert({ where: { organizationId_product: { organizationId: org.id, product } }, update: { active: true }, create: { organizationId: org.id, product, active: true } });
  }
  const settingsJson = JSON.stringify({ consumerDetections: false, vertical: "restaurant" });
  // Restaurant-sized thresholds (the defaults are sized for larger companies): what counts as high value, and
  // how much a manager may record before an owner has to approve.
  const thresholds = { highValueThreshold: 5000, managerApprovalLimit: 5000, adminApprovalLimit: 15000, requireApprovalAbove: 10000 };
  await prisma.orgSettings.upsert({ where: { organizationId: org.id }, update: { settingsJson, ...thresholds }, create: { organizationId: org.id, settingsJson, ...thresholds } });
  const settings = await prisma.orgSettings.findUniqueOrThrow({ where: { organizationId: org.id } });

  // Onboarding answers: restaurant, full-service, on SpotOn; delivery via DoorDash + Uber Eats (selected ≠ connected).
  const onboardingData = JSON.stringify({
    welcome: { industry: "restaurant", restaurantTypes: ["full_service"] },
    products: { products: ["REVENUE_RECOVERY", "OPERATIONS_EFFICIENCY"] },
    integrations: { integrations: ["pos_spoton", "doordash", "ubereats"] },
  });
  for (const userId of [owner.id, gm.id]) {
    await prisma.onboardingProgress.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId } },
      update: { currentStep: 4, completedSteps: JSON.stringify(["welcome", "products", "integrations", "team", "done"]), completedAt: new Date(), dataJson: onboardingData },
      create: { organizationId: org.id, userId, currentStep: 4, completedSteps: JSON.stringify(["welcome", "products", "integrations", "team", "done"]), completedAt: new Date(), dataJson: onboardingData },
    });
  }

  // 1) Import the sample SpotOn export through the real importer.
  // Story: the weekly SpotOn export was imported 4 days ago and covers the 90 days before that.
  const IMPORT_AGO = 4;
  // h:00 New York time n days ago, whatever timezone the server runs in (Render runs in UTC).
  const daysAgo = (n: number, h = 10) => {
    const ymd = nyDate(new Date(Date.now() - n * 86_400_000));
    const guess = new Date(`${ymd}T${String(h).padStart(2, "0")}:00:00Z`);
    const offset = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" })).getTime() - new Date(guess.toLocaleString("en-US", { timeZone: "America/New_York" })).getTime();
    return new Date(guess.getTime() + offset);
  };
  const days = buildSpotOnDemoDays(new Date(Date.now() - (IMPORT_AGO - 1) * 86_400_000), SPOTON_DEMO_DAYS);
  const imp = await runSpotOnImport({ organizationId: org.id, userId: owner.id, text: spotOnDemoCsv(days), fileName: `SpotOn Orders Per Day — ${days[0]!.date} to ${days[days.length - 1]!.date} (SAMPLE).csv`, source: "DEMO_SEED" });
  if (imp.errors.length || imp.created === 0) throw new Error(`SpotOn demo import failed: ${JSON.stringify(imp.errors.slice(0, 3))}`);
  await prisma.importJob.update({ where: { id: imp.jobId }, data: { createdAt: daysAgo(IMPORT_AGO, 9), startedAt: daysAgo(IMPORT_AGO, 9), finishedAt: daysAgo(IMPORT_AGO, 9) } });
  await prisma.transaction.updateMany({ where: { organizationId: org.id, source: "spoton_export" }, data: { importedAt: daysAgo(IMPORT_AGO, 9), lastSyncAt: daysAgo(IMPORT_AGO, 9) } });

  // 2) Detection turns the imported sales into estimates (comps/discounts, voids).
  const detection = await runDetectionEngines(org.id);
  const summary = await getSpotOnSummary(org.id);
  const avgCheck = summary?.averageCheck ?? 0;

  const history = async (entityType: "Opportunity" | "Inefficiency", entityId: string, steps: Array<[string | null, string, string, string, Date]>) => {
    for (const [fromStatus, toStatus, actorId, note, createdAt] of steps) {
      await prisma.statusHistory.create({ data: { organizationId: org.id, entityType, entityId, fromStatus, toStatus, actorId, note, createdAt } });
    }
  };

  // Detection ran "now"; place the import + detection 4 days back so the follow-up activity reads in order.
  const backdateDetected = async (opportunityId: string, at: Date) => {
    await prisma.opportunity.update({ where: { id: opportunityId }, data: { identifiedAt: at, createdAt: at } });
    await prisma.statusHistory.updateMany({ where: { organizationId: org.id, entityType: "Opportunity", entityId: opportunityId }, data: { createdAt: at } });
    await prisma.evidence.updateMany({ where: { organizationId: org.id, opportunityId }, data: { createdAt: at } });
    await prisma.finding.updateMany({ where: { organizationId: org.id, opportunityId }, data: { createdAt: at } });
  };

  // Detected items: give them owners and a next step.
  const comps = await prisma.opportunity.findFirst({ where: { organizationId: org.id, type: "spoton_comps_discounts" } });
  const voids = await prisma.opportunity.findFirst({ where: { organizationId: org.id, type: "spoton_voids" } });
  if (comps) {
    const at = daysAgo(3);
    await backdateDetected(comps.id, daysAgo(IMPORT_AGO));
    await prisma.opportunity.update({ where: { id: comps.id }, data: { status: "UNDER_REVIEW", assigneeId: gm.id } });
    await history("Opportunity", comps.id, [["IDENTIFIED", "UNDER_REVIEW", gm.id, "Checking comps by shift with the closing team", at]]);
    await prisma.approvalRequest.create({
      data: {
        organizationId: org.id, type: "RECOVERY_PLAN", status: "PENDING",
        title: "Comp policy: manager PIN on comps over $25 + weekly comp review",
        description: "Proposal: comps over $25 need a manager PIN in SpotOn, and the GM reviews last week's comps every Monday. Approving records the decision; your team changes the SpotOn setting.",
        payloadJson: JSON.stringify({ opportunityId: comps.id, amount: comps.potentialAmount, executesExternally: false }),
        requestedById: gm.id, createdAt: daysAgo(2),
      },
    });
    await prisma.opportunityNote.create({ data: { opportunityId: comps.id, authorId: gm.id, body: "Most of the jump is on the closing shift. Proposed a manager PIN for larger comps — waiting on owner approval.", createdAt: daysAgo(2, 15) } });
  }
  if (voids) {
    await backdateDetected(voids.id, daysAgo(IMPORT_AGO));
    await prisma.opportunity.update({ where: { id: voids.id }, data: { assigneeId: gm.id } });
    await prisma.task.create({ data: { organizationId: org.id, title: "Pull SpotOn's Order Item List (voided items) for the last 30 days and review void reasons with the GM", entityType: "Opportunity", entityId: voids.id, status: "OPEN", dueAt: daysAgo(-3), assigneeId: gm.id, createdById: owner.id, createdAt: daysAgo(3) } });
  }

  // Additional items with their own stated arithmetic (sample).
  const mkOpp = async (o: { title: string; description: string; evidence: string[]; source: string; type: string; status: string; amount: number; recovered?: number; verified?: boolean; identifiedAgo: number; recoveredAgo?: number; priority?: string }) => {
    const identifiedAt = daysAgo(o.identifiedAgo);
    const scored = scoreWorkItem({ amount: o.amount, ageDays: o.identifiedAgo, priorityHint: o.priority, evidenceCount: o.evidence.length, settings });
    const recoveredAt = o.recoveredAgo != null ? daysAgo(o.recoveredAgo, 14) : null;
    const created = await prisma.opportunity.create({
      data: {
        organizationId: org.id, title: o.title, description: o.description, source: o.source, sourceId: `spoton-demo:${o.type}`, department: "Restaurant operations", type: o.type,
        status: o.status, priority: scored.priority, score: scored.score, scoreFactorsJson: JSON.stringify(scored.factors),
        potentialAmount: o.amount, estimatedAmount: o.amount, approvedAmount: o.recovered ? o.amount : 0, inProgressAmount: 0,
        recoveredAmount: o.recovered ?? 0, verifiedAmount: o.verified ? o.recovered ?? 0 : 0, assigneeId: gm.id,
        identifiedAt, recoveredAt, verifiedAt: o.verified ? daysAgo((o.recoveredAgo ?? 1) - 1) : null, createdAt: identifiedAt,
      },
    });
    for (const e of o.evidence) await prisma.evidence.create({ data: { organizationId: org.id, opportunityId: created.id, kind: "FACT", summary: e, source: o.source, createdAt: identifiedAt } });
    return created;
  };

  const missedCalls = 58;
  const likelyOrders = Math.round(missedCalls / 3);
  const callsEstimate = Math.round(likelyOrders * avgCheck);
  const calls = await mkOpp({
    title: "Unanswered calls during the dinner rush (last 30 days)",
    description: `${missedCalls} calls rang out between 5 and 8 pm in the last 30 days (sample phone log). If 1 in 3 was an order or booking, that's ${likelyOrders} orders × ${usd(avgCheck)} average check from your SpotOn export ≈ ${usd(callsEstimate)}. An estimate, not money recovered.`,
    evidence: [`Sample phone log: ${missedCalls} unanswered calls, 5–8 pm, last 30 days`, `Average check ${usd(avgCheck)} = net sales ÷ orders in the SpotOn export (last 30 days)`],
    source: "phone_log_sample", type: "unanswered_calls", status: "IDENTIFIED", amount: callsEstimate, identifiedAgo: 3, priority: "HIGH",
  });
  await history("Opportunity", calls.id, [[null, "IDENTIFIED", owner.id, "Found from the phone log and SpotOn average check", daysAgo(3)]]);
  await prisma.task.create({ data: { organizationId: org.id, title: "Decide how rush-hour calls get answered — a host on the phone, or a voice agent", entityType: "Opportunity", entityId: calls.id, status: "OPEN", dueAt: daysAgo(-5), assigneeId: owner.id, createdById: gm.id, createdAt: daysAgo(2) } });

  const delivery = await mkOpp({
    title: "Delivery missing-item charges never disputed",
    description: "38 missing-item adjustments on delivery orders over 60 days ($1,140 total) were accepted without a dispute, although the kitchen marked the orders complete. Disputes filed for the eligible ones.",
    evidence: ["Sample delivery statements: 38 missing-item adjustments, $1,140", "29 were still inside the dispute window when found"],
    source: "delivery_statement_sample", type: "delivery_charges", status: "VERIFIED", amount: 1140, recovered: 865, verified: true, identifiedAgo: 41, recoveredAgo: 20,
  });
  await history("Opportunity", delivery.id, [
    [null, "IDENTIFIED", owner.id, "Found in delivery statements", daysAgo(41)],
    ["IDENTIFIED", "APPROVED", owner.id, "Dispute the eligible adjustments", daysAgo(39)],
    ["APPROVED", "IN_RECOVERY", gm.id, "29 disputes filed", daysAgo(38)],
    ["IN_RECOVERY", "RECOVERED", gm.id, "Recorded recovery 865", daysAgo(20, 14)],
    ["RECOVERED", "VERIFIED", owner.id, "Verified recovery 865", daysAgo(19)],
  ]);
  await prisma.approvalRequest.create({ data: { organizationId: org.id, type: "RECOVERY_PLAN", status: "APPROVED", title: "Dispute eligible delivery missing-item charges", description: "Your team files the disputes in each delivery platform; Kaivaryn records the decision and the outcome.", payloadJson: JSON.stringify({ opportunityId: delivery.id, amount: 1140, executesExternally: false }), requestedById: gm.id, decidedById: owner.id, decidedAt: daysAgo(39), decisionNote: "Go ahead — file every one still inside the window.", createdAt: daysAgo(40) } });
  await prisma.opportunityNote.create({ data: { opportunityId: delivery.id, authorId: gm.id, body: "21 of 29 disputes paid: $865 back, matched to the payout statements. The other 8 were declined.", createdAt: daysAgo(20, 15) } });

  const eventBal = await mkOpp({
    title: "Private-event balance never charged",
    description: "A private dinner was paid by deposit only; the $1,480 balance on the event check was never charged. Card on file charged with the client's OK.",
    evidence: ["Event check shows deposit applied, balance $1,480 open", "Client confirmed by email; balance charged"],
    source: "event_check_sample", type: "event_balance", status: "RECOVERED", amount: 1480, recovered: 1480, identifiedAgo: 27, recoveredAgo: 21,
  });
  await history("Opportunity", eventBal.id, [
    [null, "IDENTIFIED", owner.id, "Found reviewing open event checks", daysAgo(27)],
    ["IDENTIFIED", "RECOVERED", gm.id, "Recorded recovery 1480", daysAgo(21, 14)],
  ]);

  // Operations efficiency (annual run-rate, never added to cash).
  const mkIneff = async (o: { title: string; description: string; evidence: string; type: string; status: string; waste: number; realized?: number; hours: number; realizedHours?: number; auto?: boolean; identifiedAgo: number; resolvedAgo?: number; priority?: string }) => {
    const identifiedAt = daysAgo(o.identifiedAgo);
    const scored = scoreWorkItem({ amount: o.waste, ageDays: o.identifiedAgo, priorityHint: o.priority, evidenceCount: 1, settings });
    const created = await prisma.inefficiency.create({
      data: {
        organizationId: org.id, title: o.title, description: o.description, source: "sample_review", sourceId: `spoton-demo:${o.type}`, department: "Restaurant operations", type: o.type,
        status: o.status, priority: scored.priority, score: scored.score, scoreFactorsJson: JSON.stringify(scored.factors),
        estimatedWasteAnnual: o.waste, projectedSavings: o.waste, recoveredAnnual: o.realized ?? 0, realizedSavings: o.realized ?? 0,
        hoursWastedWeekly: o.hours, projectedHoursWeekly: o.hours, realizedHoursWeekly: o.realizedHours ?? null, automationCandidate: o.auto ?? false, assigneeId: gm.id,
        identifiedAt, resolvedAt: o.resolvedAgo != null ? daysAgo(o.resolvedAgo, 14) : null, createdAt: identifiedAt,
      },
    });
    await prisma.evidence.create({ data: { organizationId: org.id, inefficiencyId: created.id, kind: "METRIC", summary: o.evidence, source: "sample_review", createdAt: identifiedAt } });
    return created;
  };
  const labor = await mkIneff({
    title: "Over-staffed weekday afternoons (Mon–Thu, 2–4 pm)",
    description: "One more server on the floor than sales need on Monday–Thursday afternoons. Projected: 4 afternoons × 2 hours × $15.50 × 52 weeks ≈ $6,448 a year. Tuesday and Wednesday are already changed (2 × 2 × $15.50 × 52 ≈ $3,224 a year).",
    evidence: "Sample labor export vs SpotOn hourly sales: 2–4 pm weekdays average under 9 orders an hour with 4 servers clocked in",
    type: "labor_vs_sales", status: "IMPLEMENTING", waste: 6448, realized: 3224, hours: 8, realizedHours: 4, identifiedAgo: 33, resolvedAgo: 12, priority: "HIGH",
  });
  await history("Inefficiency", labor.id, [
    [null, "IDENTIFIED", owner.id, "Labor vs sales by hour", daysAgo(33)],
    ["IDENTIFIED", "APPROVED", owner.id, "Cut one afternoon server shift Mon–Thu", daysAgo(30)],
    ["APPROVED", "IMPLEMENTING", gm.id, "Tue + Wed schedule changed", daysAgo(26)],
    ["IMPLEMENTING", "REALIZED", gm.id, "Recorded savings 3224", daysAgo(12, 14)],
  ]);
  await prisma.inefficiency.update({ where: { id: labor.id }, data: { status: "IMPLEMENTING" } });
  await prisma.task.create({ data: { organizationId: org.id, title: "Apply the same afternoon schedule change to Monday and Thursday", entityType: "Inefficiency", entityId: labor.id, status: "OPEN", dueAt: daysAgo(-6), assigneeId: gm.id, createdById: owner.id, createdAt: daysAgo(12) } });

  const recap = await mkIneff({
    title: "Nightly sales recap typed into a spreadsheet",
    description: "The closing manager copies SpotOn numbers into a spreadsheet every night: about 45 minutes × 7 nights ≈ 5.25 hours a week × $24/hour × 52 ≈ $6,552 a year. A daily digest from the SpotOn export would replace it.",
    evidence: "Sample time check: 45 minutes per close, every night",
    type: "manual_reporting", status: "IDENTIFIED", waste: 6552, hours: 5.25, auto: true, identifiedAgo: 9,
  });
  await history("Inefficiency", recap.id, [[null, "IDENTIFIED", owner.id, "Found in a closing-routine review", daysAgo(9)]]);
  await prisma.approvalRequest.create({ data: { organizationId: org.id, type: "AUTOMATION_CANDIDATE", status: "PENDING", title: "Replace the nightly recap spreadsheet with Kaivaryn's daily digest", description: "Proposal only. Nothing runs without approval.", payloadJson: JSON.stringify({ inefficiencyId: recap.id, projectedSavings: 6552, proposedAction: "document_only", executesExternally: false }), requestedById: gm.id, createdAt: daysAgo(1) } });

  // Playbooks, a weekly standing order, and one real run (writes a run + briefing into the Inbox).
  const ctx = { organizationId: org.id, userId: owner.id, role: "OWNER" };
  await ensureSystemPlaybooks(org.id);
  for (const slug of ["restaurant-comps-voids-discounts", "restaurant-refund-anomalies", "restaurant-unanswered-calls", "restaurant-labor-vs-sales", "restaurant-reporting"]) {
    try { await addRestaurantPlaybook(ctx, slug); } catch (e) { log(`  SpotOn demo: playbook ${slug} skipped (${(e as Error).message})`); }
  }
  const compsPb = await findPlaybook(ctx, "restaurant-comps-voids-discounts");
  await createStandingOrder(ctx, { directive: "Every week run playbook restaurant-comps-voids-discounts", title: "Weekly comps, voids & discounts check", kind: "PLAYBOOK", playbookId: compsPb?.id ?? null });
  await createStandingOrder(ctx, { directive: "Every day executive digest", title: "Daily owner digest" });
  try { if (compsPb) await runPlaybook(ctx, compsPb.id); } catch (e) { log(`  SpotOn demo: playbook run skipped (${(e as Error).message})`); }
  // The run's follow-up task goes to the GM, like a manager would assign it.
  await prisma.task.updateMany({ where: { organizationId: org.id, assigneeId: null, status: "OPEN" }, data: { assigneeId: gm.id } });

  await prisma.notification.createMany({
    data: [
      { organizationId: org.id, userId: owner.id, title: "SpotOn sales imported", body: `${SPOTON_DEMO_DAYS} days of sales from your SpotOn Orders Per Day export (sample data).`, href: "/app/integrations#spoton", createdAt: daysAgo(IMPORT_AGO, 9) },
      { organizationId: org.id, userId: owner.id, title: "Comps & voids are running above your usual rate", body: "New estimates from your SpotOn data are waiting in Revenue Recovery.", href: "/app/revenue", createdAt: daysAgo(IMPORT_AGO, 10) },
    ],
  });
  await prisma.auditLog.create({ data: { organizationId: org.id, actorId: owner.id, action: "seed.spoton_demo", entityType: "Organization", entityId: org.id, metadataJson: JSON.stringify({ note: "SpotOn demo seed (sample data)", imported: imp.created, rulesFired: detection.rulesFired }) } });

  log(`  SpotOn demo: ${SPOTON_DEMO_ORG_NAME} (${SPOTON_DEMO_SLUG}) · ${imp.created} SpotOn rows · rules ${detection.rulesFired.filter((r) => r.startsWith("spoton_")).join(", ") || "(none)"} · login ${SPOTON_DEMO_OWNER_EMAIL} ${pw && pw.length >= 12 ? "[SPOTON_DEMO_PASSWORD]" : "(sign-in disabled: SPOTON_DEMO_PASSWORD not set)"}`);
  return { orgId: org.id, imported: imp.created, rulesFired: detection.rulesFired };
}
