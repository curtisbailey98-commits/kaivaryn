# Kaivaryn Client Acquisition Intelligence Engine

Kaivaryn's internal acquisition system lives under `/admin/acquisition` and is designed around a high-value, demo-first sales motion:

`intent → resolution → pre-qualification → research → micro-audit → reverse selling → outreach → response intelligence → secondary qualification → demo → Stripe → verified payment → immediate onboarding`

## What is implemented

- Internal acquisition account model with durable domain deduplication.
- Decision-maker/contact records with authority scoring and source/verification state.
- Intent signal model with SHA-256 signal fingerprints to prevent duplicate ingestion.
- Provider-neutral intent ingestion API: `POST /api/acquisition/ingest`.
- Concrete Clay webhook adapter: `POST /api/acquisition/providers/clay` (disabled until `CLAY_WEBHOOK_SECRET` is set).
- Configurable-in-code V2 pre-qualification model (100 points):
  - ICP fit 25
  - Intent strength 25 (recency-decayed signal momentum + corroboration across distinct recent sources/categories)
  - Pain/opportunity 20
  - Economic value 15
  - Decision-maker access 10
  - Timing/urgency 5
- Account research store that keeps verified facts separate from analyst/model hypotheses.
- Evidence-backed micro-audit generation.
- Reverse-selling outreach generation that leads with observed evidence and an economic validation question rather than a generic pitch.
- Outreach state, opt-out state, inbound response capture, deterministic reply classification, response-specific next-action routing, and secondary qualification.
- Executive next-best-action directive that routes each account to enrichment, research, micro-audit, reverse selling, secondary qualification, demo, checkout, onboarding, or stop state.
- Demo lifecycle integration with existing `DemoRequest` records.
- Private post-demo engagement URLs under `/engage/[token]`.
- Existing Stripe Payment Link is exposed only after demo completion.
- Checkout includes `client_reference_id` so Stripe webhook events map back to the acquisition account.
- Server-side Stripe signature verification at `POST /api/stripe/webhook`.
- Idempotent payment event storage.
- Verified payment provisions an organization, entitlements, subscription record, and onboarding state.
- Registration with the same paid work email attaches the buyer to the provisioned workspace instead of creating a disconnected organization.
- Completing onboarding moves the acquisition account to `ACTIVE`.
- Acquisition command-center metrics, intent/industry summaries, reply rate, and demo-to-paid conversion.

## Honest provider status

The core acquisition workflow is live in Kaivaryn. Third-party intent/enrichment/email/calendar providers are **not fabricated**. Provider-neutral TypeScript contracts are in `src/lib/acquisition-providers.ts`, and the protected ingestion endpoint can accept legitimate provider or automation output today.

The application must never claim it can see private Google searches. Intent records should originate from first-party data, public evidence, permissioned sources, or an authorized third-party intent provider.

## Required environment variables

```env
STRIPE_PAYMENT_LINK=https://buy.stripe.com/...
STRIPE_WEBHOOK_SECRET=whsec_...
ACQUISITION_INGEST_TOKEN=long-random-secret
CLAY_WEBHOOK_SECRET=long-random-secret
BOOTSTRAP_ADMIN_PASSWORD=long-random-secret
```

`render.yaml` marks the non-public values as Render-managed or manually configured secrets.

## Stripe setup

1. Keep the existing Kaivaryn Payment Link in `STRIPE_PAYMENT_LINK`.
2. In Stripe Workbench / Webhooks, create an endpoint:
   - `https://kaivaryn.onrender.com/api/stripe/webhook`
3. Subscribe at minimum to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET` in Render.
5. Configure the Payment Link's after-payment redirect to:
   - `https://kaivaryn.onrender.com/activate`

A redirect does **not** mark a deal paid. The verified webhook is the source of truth.

## Intent ingestion API

Header:

```http
Authorization: Bearer <ACQUISITION_INGEST_TOKEN>
Content-Type: application/json
```

Example payload:

```json
{
  "company": "Example Co",
  "domain": "example.com",
  "industry": "Logistics",
  "companySize": "201-500",
  "contact": {
    "name": "Jordan Example",
    "email": "jordan@example.com",
    "title": "COO"
  },
  "signal": {
    "type": "AI_AUTOMATION_HIRING",
    "category": "HIRING",
    "source": "Company careers page",
    "sourceUrl": "https://example.com/careers",
    "evidence": "Published role describes ownership of AI workflow automation.",
    "strength": 85,
    "confidence": 90
  },
  "selectedProduct": "OPERATIONS_EFFICIENCY"
}
```

The endpoint resolves/deduplicates the account, fingerprints the signal, persists evidence, immediately produces a V2 pre-qualification snapshot, and returns a machine-readable `nextBestAction` directive.

## Validation

After dependencies are installed and the schema is pushed:

```bash
npm run test:acquisition
npm run test:enterprise
npm run build
```

## Production persistence

The Prisma datasource is PostgreSQL and `render.yaml` expects a secret-managed external `DATABASE_URL`. Use a persistent managed PostgreSQL service (for example Supabase, Neon, or Render Postgres). The application no longer advertises ephemeral SQLite as a production path.

Local development can start PostgreSQL with:

```bash
docker compose up -d postgres
```

Before cutover run:

```bash
npm run test:readiness
npm run test:acquisition
npm run test:enterprise
npm run build
```

## Clay webhook adapter

Map a Clay table's webhook columns to the canonical fields below and send them to:

`POST /api/acquisition/providers/clay`

Authenticate with either `Authorization: Bearer <CLAY_WEBHOOK_SECRET>` or `x-clay-webhook-secret`. Required fields are `company`, `signal_type`, and `signal_category`; optional company/contact/enrichment fields are preserved and the signal is immediately deduplicated and pre-qualified.
