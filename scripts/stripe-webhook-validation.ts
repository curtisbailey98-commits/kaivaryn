import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { findOrCreateAcquisitionAccount, markDemoCompleted } from "../src/lib/acquisition";
import { handleStripeWebhook, KAIVARYN_PAYMENT_LINK_IDS_DEFAULT } from "../src/lib/stripe-webhook";

const SECRET = `whsec_validation_${randomBytes(12).toString("hex")}`;

function sign(payload: string, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`;
}

function checkoutEvent(id: string, session: Record<string, unknown>, type = "checkout.session.completed") {
  return JSON.stringify({ id, type, data: { object: { id: `cs_${id}`, payment_status: "paid", amount_total: 1_000_000, currency: "usd", ...session } } });
}

async function main() {
  const suffix = Date.now().toString(36);
  const paymentEventsBefore = await prisma.paymentEvent.count();

  // Configuration + strict signature verification.
  const anyPayload = checkoutEvent(`evt_sig_${suffix}`, { client_reference_id: "x" });
  assert.equal((await handleStripeWebhook(anyPayload, sign(anyPayload), undefined)).status, 503, "Missing secret must report not configured");
  assert.equal((await handleStripeWebhook(anyPayload, null, SECRET)).status, 400, "Unsigned request must be rejected");
  assert.equal((await handleStripeWebhook(anyPayload, "t=1,v1=deadbeef", SECRET)).status, 400, "Forged signature must be rejected");
  assert.equal((await handleStripeWebhook(anyPayload, sign(anyPayload, "whsec_wrong"), SECRET)).status, 400, "Signature with the wrong secret must be rejected");
  assert.equal((await handleStripeWebhook(anyPayload, sign(anyPayload, SECRET, Math.floor(Date.now() / 1000) - 3600), SECRET)).status, 400, "Stale signature must be rejected");
  assert.equal((await handleStripeWebhook("{not json", sign("{not json"), SECRET)).status, 400, "Invalid JSON must be rejected");

  // Foreign / unrecognised traffic on the shared Stripe account is acknowledged and ignored.
  const cases: Array<[string, string, string]> = [
    ["Benchline checkout (other payment link, foreign reference)", checkoutEvent(`evt_bl_${suffix}`, { payment_link: "plink_benchline_other", client_reference_id: `bl_${suffix}` }), "unknown_reference"],
    ["Benchline checkout tagged by metadata", checkoutEvent(`evt_blm_${suffix}`, { metadata: { business: "benchline" }, client_reference_id: `bl_${suffix}` }), "other_business"],
    ["Kaivaryn link with unknown reference", checkoutEvent(`evt_kunk_${suffix}`, { payment_link: KAIVARYN_PAYMENT_LINK_IDS_DEFAULT[0], client_reference_id: randomBytes(24).toString("hex") }), "unknown_reference"],
    ["Checkout without reference", checkoutEvent(`evt_noref_${suffix}`, {}), "no_reference"],
    ["Unhandled event type", JSON.stringify({ id: `evt_inv_${suffix}`, type: "invoice.paid", data: { object: {} } }), "unhandled_event_type"],
  ];
  for (const [label, payload, reason] of cases) {
    const result = await handleStripeWebhook(payload, sign(payload), SECRET);
    assert.equal(result.status, 200, `${label}: should be acknowledged with 200`);
    assert.equal(result.body.ignored, true, `${label}: should be ignored`);
    assert.equal(result.body.reason, reason, `${label}: reason`);
  }
  assert.equal(await prisma.paymentEvent.count(), paymentEventsBefore, "Ignored events must not write PaymentEvents");

  // Genuine Kaivaryn checkout still provisions.
  const account = await findOrCreateAcquisitionAccount({
    company: `[VALIDATION] Stripe Webhook Co ${suffix}`,
    domain: `stripe-webhook-${suffix}.example`,
    companySize: "201-500",
    source: "VALIDATION",
    primaryName: "Validation Buyer",
    primaryEmail: `buyer-${suffix}@example.com`,
    primaryTitle: "Chief Operating Officer",
    selectedProduct: "BOTH",
  });
  let provisionedOrgId: string | null = null;
  try {
    const ready = await markDemoCompleted(account.id);
    assert(ready.checkoutToken);

    const pending = checkoutEvent(`evt_pending_${suffix}`, { payment_link: KAIVARYN_PAYMENT_LINK_IDS_DEFAULT[0], client_reference_id: ready.checkoutToken, payment_status: "unpaid" });
    const pendingResult = await handleStripeWebhook(pending, sign(pending), SECRET);
    assert.equal(pendingResult.status, 200);
    assert.equal(pendingResult.body.pending, true, "Unpaid async checkout should wait for async_payment_succeeded");

    const genuine = checkoutEvent(`evt_genuine_${suffix}`, { payment_link: KAIVARYN_PAYMENT_LINK_IDS_DEFAULT[0], client_reference_id: ready.checkoutToken, customer: `cus_${suffix}` });
    const genuineResult = await handleStripeWebhook(genuine, sign(genuine), SECRET);
    assert.equal(genuineResult.status, 200);
    assert.equal(genuineResult.body.recorded, true, "Genuine Kaivaryn checkout must be recorded");
    // Duplicate delivery stays idempotent.
    assert.equal((await handleStripeWebhook(genuine, sign(genuine), SECRET)).body.recorded, true);

    const stored = await prisma.acquisitionAccount.findUnique({ where: { id: account.id }, include: { paymentEvents: true } });
    assert(stored);
    assert.equal(stored.paymentStatus, "PAID");
    assert.equal(stored.paymentEvents.length, 1, "Duplicate delivery should create one PaymentEvent");
    assert(stored.onboardingOrganizationId, "Paid Kaivaryn checkout should provision onboarding");
    provisionedOrgId = stored.onboardingOrganizationId;
    console.log("Stripe webhook validation passed", { ignoredCases: cases.length, accountId: account.id });
  } finally {
    await prisma.acquisitionAccount.delete({ where: { id: account.id } }).catch(() => undefined);
    if (provisionedOrgId) await prisma.organization.delete({ where: { id: provisionedOrgId } }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
