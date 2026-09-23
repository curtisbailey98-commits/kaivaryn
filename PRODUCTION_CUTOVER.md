# Kaivaryn production cutover

This build is production-oriented around persistent PostgreSQL, post-demo Stripe verification, and a concrete Clay webhook adapter.

## 1. Persistent database

Create a persistent PostgreSQL database (Supabase, Neon, Render Postgres, etc.) and set Render `DATABASE_URL` to its server connection string.

The application now expects a PostgreSQL URL; ephemeral `file:` SQLite storage is no longer the production configuration.

Before first launch:

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

## 2. Render environment

Required:

```text
DATABASE_URL
NEXTAUTH_URL=https://kaivaryn.onrender.com
NEXTAUTH_SECRET
BOOTSTRAP_ADMIN_PASSWORD
STRIPE_PAYMENT_LINK=https://buy.stripe.com/14AaEZgJsdDNeTFePLeUU01
STRIPE_WEBHOOK_SECRET
ACQUISITION_INGEST_TOKEN
```

Optional concrete intent/enrichment bridge:

```text
CLAY_WEBHOOK_SECRET
```

Never put the secret values in GitHub.

## 3. Stripe

Create or verify the webhook endpoint:

```text
https://kaivaryn.onrender.com/api/stripe/webhook
```

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

Set the Payment Link after-payment redirect to:

```text
https://kaivaryn.onrender.com/activate
```

The acquisition engine now uses the private checkout token as `client_reference_id`. A payment cannot provision a client unless the corresponding acquisition account has a completed demo and an unlocked checkout.

## 4. Clay -> Kaivaryn

Configure Clay to POST to:

```text
https://kaivaryn.onrender.com/api/acquisition/providers/clay
```

Send either:

```http
Authorization: Bearer <CLAY_WEBHOOK_SECRET>
```

or:

```http
x-clay-webhook-secret: <CLAY_WEBHOOK_SECRET>
```

Canonical example payload:

```json
{
  "company": "Example Co",
  "domain": "example.com",
  "website": "https://example.com",
  "industry": "Logistics",
  "company_size": "201-500",
  "estimated_revenue": 25000000,
  "location": "Charlotte, NC",
  "contact_name": "Jordan Example",
  "contact_email": "jordan@example.com",
  "contact_title": "COO",
  "contact_profile": "https://www.linkedin.com/in/example",
  "contact_verified": true,
  "signal_type": "AI_AUTOMATION_HIRING",
  "signal_category": "HIRING",
  "signal_source": "CLAY",
  "signal_source_url": "https://example.com/careers",
  "signal_evidence": "Company published a role owning AI workflow automation.",
  "signal_strength": 85,
  "signal_confidence": 90,
  "selected_product": "OPERATIONS_EFFICIENCY"
}
```

Clay rows are normalized into the same deduplication, pre-qualification, research, micro-audit, reverse-selling, demo, Stripe, and onboarding pipeline as other intent sources.

## 5. Validation before cutover

Run:

```bash
npm ci
npx prisma generate
npx prisma db push
npm run db:seed
npm run test:acquisition
npm run test:enterprise
npm run test:readiness
npm run build
```

Then verify:

```text
GET /api/health
/admin/health
/admin/acquisition
```

Expected acquisition vertical slice:

`intent -> prequalification -> micro-audit -> reverse-selling outreach -> response -> demo -> demo completed -> private Stripe checkout -> verified webhook -> onboarding -> active`

## 6. Important deployment note

Do not cut production over to this build until the PostgreSQL `DATABASE_URL` and Stripe webhook secret are configured. The code is deliberately explicit about those readiness states rather than silently pretending they exist.
