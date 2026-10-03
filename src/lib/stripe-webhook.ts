import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { recordStripePayment } from "@/lib/acquisition";

/**
 * Kaivaryn shares its Stripe account with other businesses (e.g. Benchline), so this
 * endpoint receives every checkout on the account. It must only act on checkouts that
 * belong to Kaivaryn and acknowledge everything else with 200 so Stripe does not retry
 * (and eventually disable) the endpoint because of another business's traffic.
 */
export const KAIVARYN_PAYMENT_LINK_IDS_DEFAULT = ["plink_1UIDxlRwMXUzZ4QMlyCUwFQO"];

export const HANDLED_CHECKOUT_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded"] as const;

export function kaivarynPaymentLinkIds(env: string | undefined = process.env.STRIPE_PAYMENT_LINK_IDS) {
  const extra = (env || "").split(",").map((id) => id.trim()).filter(Boolean);
  return new Set([...KAIVARYN_PAYMENT_LINK_IDS_DEFAULT, ...extra]);
}

export function verifyStripeSignature(payload: string, signatureHeader: string, secret: string, toleranceSeconds = 300, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || !signatures.length) return false;
  const age = Math.abs(nowSeconds - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return signatures.some((signature) => {
    try {
      const provided = Buffer.from(signature, "hex");
      return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
    } catch {
      return false;
    }
  });
}

export type StripeCheckoutSession = {
  id?: string;
  client_reference_id?: string | null;
  payment_link?: string | null;
  metadata?: Record<string, string> | null;
  amount_total?: number | null;
  currency?: string | null;
  customer?: string | null;
  subscription?: string | null;
  payment_status?: string | null;
};

export type StripeEvent = { id: string; type: string; data?: { object?: StripeCheckoutSession } };

export type WebhookResult = { status: number; body: Record<string, unknown> };

function ignored(reason: string, extra?: Record<string, unknown>): WebhookResult {
  return { status: 200, body: { received: true, ignored: true, reason, ...extra } };
}

export async function handleStripeWebhook(payload: string, signature: string | null, secret: string | undefined): Promise<WebhookResult> {
  if (!secret) return { status: 503, body: { error: "Stripe webhook is not configured." } };
  // Signature verification stays strict: nothing below runs for unsigned/forged requests.
  if (!signature || !verifyStripeSignature(payload, signature, secret)) {
    return { status: 400, body: { error: "Invalid Stripe signature" } };
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return { status: 400, body: { error: "Invalid event JSON" } };
  }

  if (!(HANDLED_CHECKOUT_EVENTS as readonly string[]).includes(event.type)) return ignored("unhandled_event_type");

  const session = event.data?.object;
  // Other businesses on the shared account tag their sessions (Benchline sets
  // metadata.source="benchline"); anything tagged for another business is ignored.
  const tags = [session?.metadata?.business, session?.metadata?.source].filter((tag): tag is string => Boolean(tag));
  if (tags.some((tag) => tag.toLowerCase() !== "kaivaryn")) return ignored("other_business");

  const reference = session?.client_reference_id;
  const kaivarynLink = Boolean(session?.payment_link && kaivarynPaymentLinkIds().has(session.payment_link));
  if (!reference) {
    if (kaivarynLink) console.warn(`[stripe-webhook] Kaivaryn payment link checkout ${session?.id ?? "?"} has no client_reference_id; not provisioned (event ${event.id}).`);
    return ignored("no_reference");
  }

  // A Kaivaryn checkout is identified by its private checkout token (minted in
  // markDemoCompleted and passed as client_reference_id by buildCheckoutLink).
  // Account-id lookup remains only for backwards compatibility with a previously
  // issued post-demo link.
  const account = await prisma.acquisitionAccount.findFirst({
    where: { OR: [{ checkoutToken: reference }, { id: reference }] },
    select: { id: true },
  });
  if (!account) {
    if (kaivarynLink) console.warn(`[stripe-webhook] Kaivaryn payment link checkout ${session?.id ?? "?"} has an unrecognised client_reference_id; not provisioned (event ${event.id}).`);
    return ignored("unknown_reference");
  }

  const paid = event.type === "checkout.session.async_payment_succeeded" || session?.payment_status === "paid" || session?.payment_status == null;
  if (!paid) return { status: 200, body: { received: true, pending: true } };

  await recordStripePayment({
    accountId: account.id,
    eventId: event.id,
    type: event.type,
    amountCents: session?.amount_total,
    currency: session?.currency,
    stripeCustomerId: session?.customer,
    stripeSubscriptionId: session?.subscription,
    stripeRef: session?.id,
  });
  return { status: 200, body: { received: true, recorded: true } };
}
