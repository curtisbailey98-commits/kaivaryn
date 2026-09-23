import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordStripePayment } from "@/lib/acquisition";

export const runtime = "nodejs";

function verifyStripeSignature(payload: string, signatureHeader: string, secret: string, toleranceSeconds = 300) {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || !signatures.length) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
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

type StripeCheckoutSession = {
  id?: string;
  client_reference_id?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  customer?: string | null;
  subscription?: string | null;
  payment_status?: string | null;
};

type StripeEvent = { id: string; type: string; data?: { object?: StripeCheckoutSession } };

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature || !verifyStripeSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try { event = JSON.parse(payload) as StripeEvent; } catch { return NextResponse.json({ error: "Invalid event JSON" }, { status: 400 }); }

  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    const session = event.data?.object;
    const reference = session?.client_reference_id;
    const paid = event.type === "checkout.session.async_payment_succeeded" || session?.payment_status === "paid" || session?.payment_status == null;
    if (reference && paid) {
      // Current links use the private checkout token. Account-id lookup remains only
      // for backwards compatibility with a previously issued post-demo link.
      const account = await prisma.acquisitionAccount.findFirst({
        where: { OR: [{ checkoutToken: reference }, { id: reference }] },
        select: { id: true },
      });
      if (!account) return NextResponse.json({ error: "Unknown Kaivaryn checkout reference" }, { status: 400 });
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
    }
  }

  return NextResponse.json({ received: true });
}
