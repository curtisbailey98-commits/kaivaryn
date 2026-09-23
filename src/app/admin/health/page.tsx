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

  const rows: Array<[string, boolean | "warn", string]> = [
    ["API / app", true, "Application is rendering."],
    [`Database / Prisma (${latency}ms)`, db === "ok", db === "ok" ? "Query succeeded." : "Database query failed."],
    ["Stripe Payment Link", stripeLink, stripeLink ? "Configured for post-demo checkout." : "Missing payment link."],
    ["Stripe webhook verification", stripeWebhook, stripeWebhook ? "Server-side payment verification enabled." : "Set STRIPE_WEBHOOK_SECRET before treating checkout as production-ready."],
    ["Intent provider ingestion", intentIngest, intentIngest ? "Protected /api/acquisition/ingest endpoint enabled." : "Set ACQUISITION_INGEST_TOKEN before connecting intent providers."],
    ["Clay provider adapter", clay ? true : "warn", clay ? "Protected Clay webhook adapter is configured." : "Optional: set CLAY_WEBHOOK_SECRET to connect Clay as the first concrete provider."],
    ["Production persistence", postgres, postgres ? "Persistent PostgreSQL URL detected." : "DATABASE_URL must point to persistent PostgreSQL before relying on acquisition/payment records in production."],
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
