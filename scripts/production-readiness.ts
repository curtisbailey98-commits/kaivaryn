const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
const databaseUrl = process.env.DATABASE_URL || "";
checks.push({ name: "Persistent PostgreSQL", ok: /^postgres(ql)?:\/\//i.test(databaseUrl), detail: /^postgres(ql)?:\/\//i.test(databaseUrl) ? "PostgreSQL URL detected." : "DATABASE_URL must use persistent PostgreSQL." });
checks.push({ name: "NextAuth URL", ok: Boolean(process.env.NEXTAUTH_URL), detail: process.env.NEXTAUTH_URL ? "Configured." : "NEXTAUTH_URL is missing." });
checks.push({ name: "NextAuth secret", ok: Boolean(process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length >= 24), detail: process.env.NEXTAUTH_SECRET ? "Configured." : "NEXTAUTH_SECRET is missing." });
checks.push({ name: "Bootstrap admin secret", ok: Boolean(process.env.BOOTSTRAP_ADMIN_PASSWORD && process.env.BOOTSTRAP_ADMIN_PASSWORD.length >= 16), detail: process.env.BOOTSTRAP_ADMIN_PASSWORD ? "Configured." : "BOOTSTRAP_ADMIN_PASSWORD is missing." });
checks.push({ name: "Stripe Payment Link", ok: /^https:\/\/buy\.stripe\.com\//.test(process.env.STRIPE_PAYMENT_LINK || ""), detail: process.env.STRIPE_PAYMENT_LINK ? "Configured." : "STRIPE_PAYMENT_LINK is missing." });
checks.push({ name: "Stripe webhook secret", ok: Boolean(process.env.STRIPE_WEBHOOK_SECRET), detail: process.env.STRIPE_WEBHOOK_SECRET ? "Configured." : "STRIPE_WEBHOOK_SECRET is missing." });
checks.push({ name: "Intent ingestion token", ok: Boolean(process.env.ACQUISITION_INGEST_TOKEN && process.env.ACQUISITION_INGEST_TOKEN.length >= 16), detail: process.env.ACQUISITION_INGEST_TOKEN ? "Configured." : "ACQUISITION_INGEST_TOKEN is missing." });

for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name}: ${check.detail}`);
const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`Production readiness failed: ${failed.length} required check(s) are not ready.`);
  process.exit(1);
}
console.log("Production readiness checks passed.");
