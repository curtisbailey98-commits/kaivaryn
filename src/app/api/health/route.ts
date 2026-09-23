import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL || "";
  const postgres = /^postgres(ql)?:\/\//i.test(databaseUrl);
  try {
    await prisma.$queryRaw`SELECT 1`;
    const readiness = {
      databasePersistent: postgres,
      intentIngestConfigured: Boolean(process.env.ACQUISITION_INGEST_TOKEN),
      clayAdapterConfigured: Boolean(process.env.CLAY_WEBHOOK_SECRET),
      stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      stripePaymentLinkConfigured: Boolean(process.env.STRIPE_PAYMENT_LINK?.includes("buy.stripe.com")),
    };
    return NextResponse.json({
      status: "ok",
      service: "kaivaryn",
      time: new Date().toISOString(),
      db: "ok",
      storageMode: postgres ? "postgresql" : databaseUrl ? "unsupported" : "unconfigured",
      productionReady: Object.entries(readiness)
        .filter(([key]) => key !== "clayAdapterConfigured")
        .every(([, value]) => value),
      acquisition: readiness,
    });
  } catch (e) {
    return NextResponse.json(
      {
        status: "degraded",
        service: "kaivaryn",
        time: new Date().toISOString(),
        db: "error",
        error: e instanceof Error ? e.message : "unknown",
      },
      { status: 503 }
    );
  }
}
