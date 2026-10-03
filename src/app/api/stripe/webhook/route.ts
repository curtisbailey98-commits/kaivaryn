import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/stripe-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  const result = await handleStripeWebhook(payload, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET);
  return NextResponse.json(result.body, { status: result.status });
}
