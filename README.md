# Kaivaryn LLC

Enterprise AI consulting platform: public site + **Revenue Recovery** + **Operations Efficiency** + admin console.

Aesthetic: executive intelligence terminal. Demo data is labeled **DEMO**.

## Stack

- Next.js 14 App Router, TypeScript, Tailwind
- Prisma + SQLite (single free Render web service; no paid DB)
- NextAuth credentials (bcrypt + JWT)
- Patterns reused from [720 SI](../720-si): glass/OS tokens, approval step-up, connector honesty, anti-fabrication intelligence (`INSUFFICIENT_DATA`), health matrix — see `REUSE_720_SI.md`

## Quick start

```bash
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open http://localhost:3000

## Seed credentials (change in production)

| Role | Email | Password |
|------|-------|----------|
| Super admin | `admin@kaivaryn.com` | `KaivarynAdmin!2026` |
| Demo analyst | `demo@kaivaryn.com` | `DemoClient!2026` |

Demo org: **Acme Demo (DEMO)** with Revenue Recovery + Operations Efficiency entitlements.

## Pricing

Stored in `PricingConfig` (not hardcoded):

- First 10 clients: **$10,000 / mo**
- Thereafter: **$20,000 / mo**
- Stripe Payment Link: `https://buy.stripe.com/14AaEZgJsdDNeTFePLeUU01`

## Key routes

- Public: `/`, `/solutions/*`, `/how-it-works`, `/intelligence`, `/pricing`, `/demo`, `/company`, `/contact`
- App: `/app`, `/app/action-center`, `/app/revenue`, `/app/operations`, `/app/integrations`, `/app/approvals`, `/app/onboarding`
- Admin (SUPER_ADMIN): `/admin/*`
- Health: `GET /api/health`

## Live

- **App:** https://kaivaryn.onrender.com  
- **Health:** https://kaivaryn.onrender.com/api/health  
- **GitHub:** https://github.com/curtisbailey98-commits/kaivaryn  

Free tier sleeps when idle — first request after idle may take ~30–60s.

## Deploy (Render free)

1. Connect this repo or use `render.yaml` blueprint
2. Set `NEXTAUTH_URL` to the public HTTPS URL after first deploy
3. `NEXTAUTH_SECRET` auto-generated via blueprint
4. SQLite file path: `file:./data/kaivaryn.db` (ephemeral on free tier — re-seeds on boot)

```bash
npm run build   # must pass
```

Docker: `docker build -t kaivaryn .` then prune: `docker builder prune -af && docker image prune -af`

## Security notes

- Tenant isolation: every product query scopes by `organizationId` from session membership
- SUPER_ADMIN cross-tenant only under `/admin`
- Password reset: token flow; email stubbed until SMTP (`awaiting credentials` — link logged)
- Approvals never auto-execute external actions
- Integrations report honest statuses only

## SMTP

Unset → password reset links logged server-side. Set `SMTP_*` when credentials available.
