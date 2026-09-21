# Kaivaryn ← 720 SI reuse map (Phase 0 audit)

Audited: `/workspace/720-si` (app monorepo + deploy). Strategy: **Reuse → Refactor → Upgrade → Integrate**. Keep Kaivaryn Next.js App Router + Prisma/SQLite as product shell; absorb SI *patterns and portable modules* into `packages/` / `src/lib` — do **not** require Postgres+Redis+worker to ship Kaivaryn on free Render.

## What 720 SI is
- Monorepo: `packages/shared`, `packages/core`, `services/api` (Express), `services/worker`, `services/web` (Next PWA)
- Postgres migrations `001`–`011`; Redis queues; hash-chained audit; approval gates; cognition cycles; Command; Inbox; Jobs; Connectors (boolean honesty); Agents lite; Render image deploy (`720siv5/720-si:v5`)

## Reuse decisions

| SI capability | Location | Kaivaryn action |
|---|---|---|
| **Glass / OS CSS tokens** | `services/web/app/globals.css` (`--bg`, `--panel`, `--accent`, `--glass-*`, spacing, radii) | **COPY** token set into Kaivaryn `globals.css` (amber accent for brand vs SI red) |
| **Approvals engine** | `approvals` table + `decideApproval` + step-up for critical gates; UI `/approvals` | **REFACTOR** into Prisma `ApprovalRequest` + server actions mirroring decide/step-up; no external auto-execute |
| **Action requests** | `action_requests.ts` — record only, owner fulfills | **UPGRADE** → Executive Action Center `/app/action-center` (queue of gated actions + RR/OE priorities) |
| **Audit** | Hash-chained `audit_logs` (PG advisory lock) | **SIMPLIFY** for SQLite: append-only `AuditLog` (already); optional prevHash later |
| **Connectors honesty** | `GET /v1/connectors` — booleans only, never secrets | **COPY** pattern → `/app/integrations` + `IntegrationConnection` statuses |
| **Anti-fabrication / LLM** | `llm.ts` stub; `meta.ts` `rejected_insufficient_evidence` | **INTEGRATE** into `src/lib/intelligence.ts` (`INSUFFICIENT_DATA` \| `FINDING`) |
| **Health** | Component matrix postgres/redis/api | **ADAPT** → `/api/health` db + service (no Redis required on free Kaivaryn) |
| **Auth** | HMAC cookie `si_session` (single-owner) | **UPGRADE** → NextAuth credentials + multi-tenant Membership (Kaivaryn needs orgs/roles) |
| **Idempotency** | Middleware + `idempotency_keys` | **DEFER** light: use for Stripe webhook later; not blocking MVP |
| **Jobs / queues** | BullMQ-style Redis `queue.ts` / `jobs.ts` | **SKELETON**: in-process job log table optional; no Redis on free path |
| **Cycles / Command / Inbox / Agents** | Core SI OS | **REFERENCE only** — not product surface for Kaivaryn consulting platform; Action Center covers operator queue |
| **Build/GitHub ship** | `build_github.ts`, Live Products | **REUSE deploy scripts patterns** for Kaivaryn Docker/Render; keep SI Render deploy intact |
| **Stripe** | Payment Link paste; secret flag separate | **USE** fixed link `https://buy.stripe.com/14AaEZgJsdDNeTFePLeUU01` in `PricingConfig` |
| **Dockerfile / render.yaml** | Multi-stage node20, image runtime | **ADAPT** single Next web service + SQLite volume or file DB |
| **PWA chrome** | OsDock, status bar, tiles | **LIGHT PORT**: AppShell discipline; optional dock later |

## Do NOT absorb (keep SI deploy alone)
- Full cognition cycle worker, nest levels, META81, Redis dependency, SI Postgres schema as Kaivaryn primary DB
- Destroying/reusing SI Render services (`si-api`, `si-web`, `si-postgres`) for Kaivaryn

## Packages layout (Kaivaryn)
```
/workspace/kaivaryn/
  packages/si-patterns/   # copied/adapted portable TS (tokens doc, approval helpers, connector honesty)
  src/lib/intelligence.ts # anti-fabrication (done)
  src/lib/audit.ts        # append audit (done; SI-inspired)
  prisma/schema.prisma    # multi-tenant Kaivaryn domain
```

## Demo pipeline (Kaivaryn-specific upgrade)
`NEW → CONTACTED → QUALIFIED → SCHEDULED → DEMO_COMPLETED → PAYMENT_PENDING → CLOSED_WON | CLOSED_LOST`

## Priority
Kaivaryn production > copying SI wholesale. Copy patterns aggressively; ship RR + OE + public site + admin + Stripe.
