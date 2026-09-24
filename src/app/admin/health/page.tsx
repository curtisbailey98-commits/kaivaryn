import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { getPricingConfig } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function AdminHealthPage() {
  const started = Date.now();
  let db: "ok" | "error" = "ok";
  let err: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    db = "error";
    err = e instanceof Error ? e.message : "unknown";
  }
  const latency = Date.now() - started;
  const pricing = await getPricingConfig().catch(() => null);
  const stripeLink = Boolean(pricing?.stripePaymentLink?.includes("buy.stripe.com"));
  const stripeWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const intentIngest = Boolean(process.env.ACQUISITION_INGEST_TOKEN);
  const databaseUrl = process.env.DATABASE_URL || "";
  const postgres = /^postgres(ql)?:\/\//i.test(databaseUrl);
  const clay = Boolean(process.env.CLAY_WEBHOOK_SECRET);
  const googleConnection = await prisma.acquisitionProviderConnection.findUnique({ where: { provider: "GOOGLE_WORKSPACE" } }).catch(() => null);
  const googleClient = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const googleConnected = googleConnection?.status === "CONNECTED";
  const twilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
  const callModel = Boolean(process.env.OPENAI_API_KEY);
  const automation = Boolean(process.env.ACQUISITION_AUTOMATION_TOKEN);

  const rows: Array<[string, boolean | "warn", string]> = [
    ["API / app", true, "Application is rendering."],
    [`Database / Prisma (${latency}ms)`, db === "ok", db === "ok" ? "Query succeeded." : "Database query failed."],
    ["Stripe Payment Link", stripeLink, stripeLink ? "Configured for post-demo checkout." : "Missing payment link."],
    ["Stripe webhook verification", stripeWebhook, stripeWebhook ? "Server-side payment verification enabled." : "Set STRIPE_WEBHOOK_SECRET before treating checkout as production-ready."],
    ["Intent provider ingestion", intentIngest, intentIngest ? "Protected /api/acquisition/ingest endpoint enabled." : "Set ACQUISITION_INGEST_TOKEN before connecting intent providers."],
    ["Clay provider adapter", clay ? true : "warn", clay ? "Protected Clay webhook adapter is configured." : "Optional: set CLAY_WEBHOOK_SECRET to connect Clay as the first concrete provider."],
    ["Production persistence", postgres, postgres ? "Persistent PostgreSQL URL detected." : "DATABASE_URL must point to persistent PostgreSQL before relying on acquisition/payment records in production."],
    ["Google OAuth client", googleClient ? true : "warn", googleClient ? "Google Workspace OAuth client is configured." : "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to connect Gmail and Calendar."],
    ["Google Workspace acquisition account", googleConnected ? true : "warn", googleConnected ? `Connected as ${googleConnection?.accountLabel || "Google account"}.` : "Connect Gmail + Calendar from Acquisition → Execution."],
    ["Twilio call transport", twilio ? true : "warn", twilio ? "Outbound AI call transport is configured." : "Set Twilio credentials before voice execution."],
    ["AI call conversation model", callModel ? true : "warn", callModel ? `OpenAI call model enabled (${process.env.OPENAI_CALL_MODEL || "gpt-5.6-luna"}).` : "Without OPENAI_API_KEY the call agent uses deterministic fallback dialogue."],
    ["Acquisition automation token", automation ? true : "warn", automation ? "Protected execution tick is enabled." : "Set ACQUISITION_AUTOMATION_TOKEN for scheduled queue execution."],
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold">Health</h1>
      <p className="mt-1 text-xs text-neutral-500">Operational readiness without exposing secret values.</p>
      <ul className="mt-6 space-y-3 text-sm">
        {rows.map(([label, state, detail]) => (
          <li key={label} className="si-panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div><span>{label}</span><p className="mt-1 text-xs text-neutral-500">{detail}</p></div>
            <Badge tone={state === true ? "success" : state === "warn" ? "warning" : "danger"}>{state === true ? "ready" : state === "warn" ? "attention" : "not configured"}</Badge>
          </li>
        ))}
      </ul>
      {err ? <p className="mt-4 text-sm text-red-300">{err}</p> : null}
      <p className="mt-4 text-xs text-neutral-500">Also: GET /api/health · acquisition command center: /admin/acquisition</p>
    </div>
  );
}
