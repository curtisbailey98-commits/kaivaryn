import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  addIntentSignal,
  buildCheckoutLink,
  findOrCreateAcquisitionAccount,
  generateMicroAudit,
  markDemoCompleted,
  recordStripePayment,
  scoreAcquisitionAccount,
} from "../src/lib/acquisition";
import { clayWebhookSchema, mapClayContact, mapClaySignal } from "../src/lib/providers/clay";

async function main() {
  const suffix = Date.now().toString(36);
  const account = await findOrCreateAcquisitionAccount({
    company: `[VALIDATION] Intent Co ${suffix}`,
    domain: `validation-${suffix}.example`,
    companySize: "201-500",
    source: "VALIDATION",
    primaryName: "Validation Executive",
    primaryEmail: `exec-${suffix}@example.com`,
    primaryTitle: "Chief Operating Officer",
    selectedProduct: "BOTH",
  });

  let provisionedOrgId: string | null = null;
  try {
    const first = await addIntentSignal({
      accountId: account.id,
      type: "AI_AUTOMATION_HIRING",
      category: "HIRING",
      source: "VALIDATION",
      evidence: "Published role describing AI workflow automation ownership.",
      strength: 92,
      confidence: 95,
    });
    const duplicate = await addIntentSignal({
      accountId: account.id,
      type: "AI_AUTOMATION_HIRING",
      category: "HIRING",
      source: "VALIDATION",
      evidence: "Published role describing AI workflow automation ownership.",
      strength: 92,
      confidence: 95,
    });
    assert.equal(first.id, duplicate.id, "Intent signal fingerprint should deduplicate identical signals");

    const score = await scoreAcquisitionAccount(account.id);
    assert(score.total >= 55, `Expected meaningful qualification score, got ${score.total}`);
    assert(["PRIORITY", "NURTURE", "HOLD"].includes(score.band));

    const audit = await generateMicroAudit(account.id);
    assert(audit.reverseSellMessage.includes("economics"), "Reverse-selling draft should lead with validation of economics");

    const checkout = await markDemoCompleted(account.id);
    assert(checkout.checkoutToken, "Demo completion should mint a private checkout token");
    assert.equal(checkout.paymentStatus, "READY");
    assert.equal(checkout.stage, "CHECKOUT_READY");

    const checkoutUrl = await buildCheckoutLink(account.id);
    assert(checkoutUrl, "Completed demo should expose a checkout URL");
    assert.equal(new URL(checkoutUrl).searchParams.get("client_reference_id"), checkout.checkoutToken, "Stripe reference should use the private checkout token, not the database account id");

    const paymentEventId = `evt_validation_${suffix}`;
    await recordStripePayment({
      accountId: account.id,
      eventId: paymentEventId,
      type: "checkout.session.completed",
      amountCents: 1_000_000,
      currency: "usd",
      stripeCustomerId: `cus_${suffix}`,
      stripeRef: `cs_${suffix}`,
    });
    // Duplicate delivery must remain safe and must be allowed to resume provisioning.
    await recordStripePayment({
      accountId: account.id,
      eventId: paymentEventId,
      type: "checkout.session.completed",
      amountCents: 1_000_000,
      currency: "usd",
      stripeCustomerId: `cus_${suffix}`,
      stripeRef: `cs_${suffix}`,
    });

    const stored = await prisma.acquisitionAccount.findUnique({
      where: { id: account.id },
      include: {
        intentSignals: true,
        qualificationSnapshots: true,
        microAudits: true,
        outreachMessages: true,
        paymentEvents: true,
      },
    });
    assert(stored);
    assert.equal(stored.intentSignals.length, 1, "Deduplication should keep one signal");
    assert(stored.qualificationSnapshots.length >= 1, "Qualification evidence should be persisted");
    assert(stored.microAudits.length >= 1, "Micro-audit should be persisted");
    assert(stored.outreachMessages.length >= 1, "Reverse-selling outreach draft should be persisted");
    assert.equal(stored.paymentEvents.length, 1, "Duplicate Stripe webhook delivery should create one PaymentEvent");
    assert.equal(stored.paymentStatus, "PAID");
    assert(stored.onboardingOrganizationId, "Verified post-demo payment should provision an onboarding organization");
    provisionedOrgId = stored.onboardingOrganizationId;

    const clay = clayWebhookSchema.parse({
      company: "Clay Validation Co",
      domain: "clay-validation.example",
      contact_name: "Avery Buyer",
      contact_email: "avery@clay-validation.example",
      contact_title: "COO",
      signal_type: "AI_AUTOMATION_RESEARCH",
      signal_category: "RESEARCH",
      signal_evidence: "Public signal supplied by Clay workflow.",
      signal_strength: 84,
      signal_confidence: 91,
    });
    assert.equal(mapClaySignal(clay).source, "CLAY");
    assert.equal(mapClayContact(clay)?.email, "avery@clay-validation.example");

    console.log("Acquisition validation passed", {
      accountId: account.id,
      score: score.total,
      band: score.band,
      stage: stored.stage,
      paymentStatus: stored.paymentStatus,
    });
  } finally {
    await prisma.acquisitionAccount.delete({ where: { id: account.id } }).catch(() => undefined);
    if (provisionedOrgId) {
      await prisma.organization.delete({ where: { id: provisionedOrgId } }).catch(() => undefined);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
