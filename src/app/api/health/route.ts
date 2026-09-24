import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL || "";
  const postgres = /^postgres(ql)?:\/\//i.test(databaseUrl);
  try {
    await prisma.$queryRaw`SELECT 1`;
    const google = await prisma.acquisitionProviderConnection.findUnique({ where: { provider: "GOOGLE_WORKSPACE" } }).catch(() => null);
    const readiness = {
      databasePersistent: postgres,
      intentIngestConfigured: Boolean(process.env.ACQUISITION_INGEST_TOKEN),
      clayAdapterConfigured: Boolean(process.env.CLAY_WEBHOOK_SECRET),
      stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      stripePaymentLinkConfigured: Boolean(process.env.STRIPE_PAYMENT_LINK?.includes("buy.stripe.com")),
    };
    const execution = {
      googleOAuthClientConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      googleWorkspaceConnected: google?.status === "CONNECTED",
      gmailSyncTokenConfigured: Boolean(process.env.ACQUISITION_SYNC_TOKEN),
      automationTokenConfigured: Boolean(process.env.ACQUISITION_AUTOMATION_TOKEN),
      twilioConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
      aiCallModelConfigured: Boolean(process.env.OPENAI_API_KEY),
      dailyEmailLimit: Number(process.env.ACQUISITION_DAILY_EMAIL_LIMIT || "25"),
      callMaxTurns: Number(process.env.ACQUISITION_CALL_MAX_TURNS || "6"),
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
      acquisitionExecution: execution,
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
