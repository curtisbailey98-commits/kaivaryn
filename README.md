# Kaivaryn LLC

Enterprise AI consulting platform: public site + **Revenue Recovery** + **Operations Efficiency** + **Client Acquisition Intelligence** + admin console.

Aesthetic: executive intelligence terminal. Demo data is labeled **DEMO**.

## Stack

- Next.js 14 App Router, TypeScript, Tailwind
- Prisma + persistent PostgreSQL (Render web service + managed Postgres such as Supabase/Neon/Render Postgres)
- NextAuth credentials (bcrypt + JWT)
- Patterns reused from [720 SI](../720-si): glass/OS tokens, approval step-up, connector honesty, anti-fabrication intelligence (`INSUFFICIENT_DATA`), health matrix — see `REUSE_720_SI.md`

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open http://localhost:3000

## Seed credentials

Local development keeps the legacy demo credentials. **Production no longer accepts a committed default super-admin password.** Render generates `BOOTSTRAP_ADMIN_PASSWORD`; retrieve or rotate it in the Render environment settings.

| Role | Email | Password |
|------|-------|----------|
| Super admin | `admin@kaivaryn.com` | `BOOTSTRAP_ADMIN_PASSWORD` env in production |
| Demo analyst | `demo@kaivaryn.com` | `DemoClient!2026` (demo-only account) |

Demo org: **Acme Demo (DEMO)** with Revenue Recovery + Operations Efficiency entitlements.

## Pricing

Stored in `PricingConfig` (not hardcoded):

- First 10 clients: **$10,000 / mo**
- Thereafter: **$20,000 / mo**
- Stripe Payment Link: configuration-backed and **post-demo gated**. The current default is `https://buy.stripe.com/14AaEZgJsdDNeTFePLeUU01`.

## Key routes

- Public: `/`, `/solutions/*`, `/how-it-works`, `/intelligence`, `/pricing`, `/demo`, `/company`, `/contact`
- App: `/app`, `/app/action-center`, `/app/revenue`, `/app/operations`, `/app/integrations`, `/app/approvals`, `/app/onboarding`
- Admin (SUPER_ADMIN): `/admin/*`
- Acquisition command center: `/admin/acquisition`
- Private post-demo checkout gate: `/engage/[token]`
- Intent provider ingestion: `POST /api/acquisition/ingest`
- Stripe verification: `POST /api/stripe/webhook`
- Health: `GET /api/health`

See `ACQUISITION_ENGINE.md` for the end-to-end acquisition, reverse-selling, Stripe, and onboarding architecture.

## Live

- **App:** https://kaivaryn.onrender.com  
- **Health:** https://kaivaryn.onrender.com/api/health  
- **GitHub:** https://github.com/curtisbailey98-commits/kaivaryn  

Free tier sleeps when idle — first request after idle may take ~30–60s.

## Deploy (Render + persistent PostgreSQL)

1. Provision a persistent PostgreSQL database (Supabase, Neon, Render Postgres, etc.).
2. Set the Render `DATABASE_URL` secret to that PostgreSQL connection string. Do **not** use a `file:` SQLite URL in production.
3. Connect this repo or use `render.yaml`.
4. Set `NEXTAUTH_URL` to the public HTTPS URL after first deploy.
5. `NEXTAUTH_SECRET` and `BOOTSTRAP_ADMIN_PASSWORD` are secret-managed.
6. Configure `STRIPE_WEBHOOK_SECRET` and `ACQUISITION_INGEST_TOKEN` before live acquisition/payment use.
7. Optional first concrete provider: configure `CLAY_WEBHOOK_SECRET`, then send Clay webhook rows to `POST /api/acquisition/providers/clay`.
8. Configure the Stripe Payment Link completion redirect to `https://kaivaryn.onrender.com/activate`.
9. Run `npm run test:readiness` with production env values before cutover.

```bash
npm run build   # must pass
```

Docker: `docker build -t kaivaryn .` then prune: `docker builder prune -af && docker image prune -af`

## Security notes

- Tenant isolation: every product query scopes by `organizationId` from session membership
- SUPER_ADMIN cross-tenant only under `/admin`
- Password reset: token flow; email stubbed until SMTP (`awaiting credentials` — link logged)
- Stripe success is accepted only from a valid server-side webhook signature; browser redirects cannot activate entitlements
- Acquisition intent ingestion is token-protected and stores source/evidence instead of inventing private search activity
- Clay has a concrete webhook adapter, but it stays disabled until `CLAY_WEBHOOK_SECRET` is configured
- Production persistence requires PostgreSQL; the app no longer treats an ephemeral SQLite file as production-ready
- Approvals never auto-execute external actions
- Integrations report honest statuses only

## SMTP

Unset → password reset links logged server-side. Set `SMTP_*` when credentials available.
