# 720 SI → Kaivaryn renovation

**Status:** October 2026. Local commits on `main` (not pushed).
**Scope:** We took apart the single-owner 720 SI operating system (`si-api`, `si-web`, `worker`; image `720siv5/720-si:v5`) and rebuilt every capability worth keeping as a **tenant-scoped, role-gated Kaivaryn feature**, written in executive language. The live 720 SI Render services were **not touched**. This was a port at the source level only.

## Principles we kept

| Principle | How Kaivaryn enforces it |
|---|---|
| Tenant isolation | Every `Op*` model has a required `organizationId`. Every read and write filters by the org taken from the session (`opCtxFromSession`), never from client input. `scripts/operating-layer-validation.ts` includes cross-tenant checks. |
| RBAC | `requireOpPermission(ctx, "write")` or `"run_intelligence"` plus the existing `approve` permission, mapped onto Kaivaryn role ranks in `src/lib/rbac.ts`. Viewers can ask, check status, and read briefings. Analysis, plans, and playbooks need Analyst or above. Approvals need Manager or above. |
| No fabricated success | Runs record per-step evidence. Integrations that aren't connected are labeled as blockers. Empty memory says it is empty. |
| Deterministic, not generative | The command router uses keyword rules. The R1–R9 cycle, detection, briefings, and health checks are deterministic code over recorded data. **No LLM is called anywhere in the operating layer.** SI's `llm.ts` stub was not carried over. |
| Money honesty | Potential, recovered cash, projected savings, and realized savings stay separate in answers, briefings, and dashboards (`src/lib/money-glossary.ts`). |
| Human in the loop | Plans (`BUILD` route) and governance playbooks pause at an approval gate (`OPERATING_PLAN`). The approval decision resumes or cancels the run. Kaivaryn never executes actions in external systems on its own. |

## Capability map

Legend: **KEEP**: concept carried over largely as-is (re-implemented in Prisma/TS). **REBUILD**: redesigned for multi-tenant executive use. **MERGE**: folded into an existing Kaivaryn surface. **REMOVE**: dismantled, not carried over.

| 720 SI capability (source) | Decision | Kaivaryn destination |
|---|---|---|
| **Command hub** (`core/command.ts`, `web/app/command`). Routes think/observe→Cycles, build/do/ship→Build, status→Operate | REBUILD | `/app/command` + `src/lib/operate/router.ts` + `command.ts`. 12 routes: ANALYZE, ANSWER, BUILD, STATUS, DIGEST, RECALL, STANDING, PLAYBOOK, REQUEST, SEARCH, INITIATIVE, HELP. Every ask is stored in `OpCommand` with its route reason. API: `POST/GET /api/command`. A compact command bar is also embedded in the Action Center. |
| **V0 Continuity / Cycles** (`cycles.ts`, `web/app/cycles`, `stages`) | KEEP (already integrated) | Nine-return R1–R9 cycle inside Revenue Recovery + Operations Efficiency: `src/lib/si/*`, `/app/intelligence`, `GET/POST /api/si/cycles`. Witness-only `ZERO_STATE_NEXT`. Command `ANALYZE` runs it. |
| **Meta / Meta-invariant** (`meta.ts`, `web/app/meta`) | KEEP | `src/lib/si/meta.ts`: bounded META_RETURN 81→729 track; reports `pending_evidence` until there is enough history. |
| **V1 Learn**: prediction→outcome→lesson (`learn.ts`, `web/app/learn`) | REBUILD | `/app/learning` + `src/lib/learning.ts` (outcome-weighted, sample-size confidence). Command `RECALL` surfaces continuity state, lessons, and memory. SI's stub hash "embeddings" were **removed**. |
| **V2 Evolve**: controlled architecture evolution, sandbox/benchmark/red-team (`evolve.ts`, `web/app/evolve`) | REBUILD (narrowed) | Champion/challenger **method** registry (`src/lib/si/methods.ts`): a challenger is promoted only on measured outcomes. Self-modifying architecture evolution was **removed**. A client SaaS doesn't rewrite itself. |
| **V3 Build** (`build.ts`, `build_github.ts`, Live Products, `web/app/products`, `web/app/apps`) | MERGE + REMOVE | Business plans → command `BUILD` creates a governed action plan (tasks + approval gate). Sites/apps/agents → **CHIEF Agent Foundry** (`/executive/chief`, live at `/a/<slug>`), executives only. SI's autonomous GitHub code-shipping pipeline was **removed** from the client product. |
| **V4 Operate**: health, tick, components (`operate.ts`, `web/app/operate`) | REBUILD | `/app/operate` (Operate health): measured DB latency, engine freshness, overdue standing orders, failed runs, integration status, 14-day rollup (`OpHealthCheck`). APIs: `GET /api/operate/health`, `POST /api/operate/tick` (session = own org; Bearer `OPERATE_TICK_TOKEN` = platform cron, each org in its own tenant context). |
| **Standing orders** (`standing_orders.ts`, `web/app/orders`) | REBUILD | `OpStandingOrder`, cadence HOURLY/DAILY/WEEKLY, kinds ANALYZE/DIGEST/HEALTH/PLAYBOOK. Managed in `/app/automations`. Created from Command ("every day send me a digest"). APIs: `/api/standing-orders`, `/api/standing-orders/[id]`, `/api/standing-orders/run-due`. |
| **Recipes** (`recipes.ts`, `web/app/recipes`) | REBUILD | **Playbooks**: `/app/playbooks`, `OpPlaybook`. Six seeded system playbooks per org (revenue-leakage-sweep, operations-friction-sweep, executive-weekly-review, high-value-recovery-governance, automation-candidate-review, platform-health-check) plus tenant-saved ones. Runs create `OpRun` with step evidence. APIs: `/api/playbooks`, `/api/playbooks/[id]/run`. |
| **Jobs / queue** (`jobs.ts`, `queue.ts`, `redis.ts`; BullMQ/Redis) | REBUILD + REMOVE | `OpRun` run engine (`src/lib/operate/runs.ts`) runs in process (no Redis on free Render). Engine runs, import jobs, and operating runs are unified in `/app/automations#runs`. `/app/jobs` now redirects there. Redis/BullMQ was **removed**. APIs: `/api/runs`, `/api/runs/[id]`. |
| **Projects** (`projects.ts`, `web/app/projects`) | REBUILD | **Initiatives**: `/app/initiatives`, `/app/initiatives/[id]`, `OpInitiative` + `OpInitiativeLink`. Links opportunities, inefficiencies, runs, and playbooks under one named business initiative. APIs: `/api/initiatives`, `/api/initiatives/[id]`, `/api/initiatives/[id]/links`. |
| **Inbox** (`inbox.ts`, `web/app/inbox`) + **notify** (`notify.ts`) | REBUILD + MERGE | `/app/inbox`: one queue of pending approvals, unread notifications, and briefings, with a nav badge. `/app/notifications` now redirects here. API: `GET /api/inbox`. |
| **Recall / digest** (command recall + digest) | REBUILD | `OpBriefing` (DIGEST / RECALL), shown in the Inbox. Estimates and recorded values are labeled separately. API: `/api/briefings`. |
| **Action requests** (`action_requests.ts`): record only, owner fulfills | KEEP → MERGE | Command `REQUEST` creates an owner task + approval. The Executive Action Center (`/app/action-center`) is the queue. |
| **Approvals** (`approvals`, step-up) | KEEP (earlier phase) | `ApprovalRequest` + `/app/approvals` + threshold rules (`src/lib/approval-thresholds.ts`). Now also gates operating runs. |
| **Automations** (`web/app/automations`) | REBUILD | `/app/automations`: standing orders, run history with evidence, engine/import jobs, run-due. |
| **Library**: evidence aggregate (`library.ts`, `web/app/library`) | MERGE | Command record (`/app/command`), run history (`/app/automations`), `/app/reports`, `/app/search`, `/app/findings`. No separate Library page, which avoids a redundant surface. |
| **Agents lite**: named profiles + directives (`agents.ts`, `web/app/agents`) | MERGE | CHIEF Agent Foundry (`/executive/chief`), the governed agent builder with eval gates. Client-facing "ask <agent>" personas were **removed**. |
| **Connectors** (`/v1/connectors`, booleans only) | KEEP (earlier phase) | `/app/integrations` + `IntegrationConnection`. Never exposes secrets. Missing integrations are labeled. |
| **Audit** (hash-chained `audit_logs`) | KEEP (simplified) | Append-only `AuditLog` via `writeAudit` on every operating action. Platform view: `/admin/audit`, `/executive/cseo/audit`. |
| **Mission-control dashboard** (`web/app/page.tsx`) | MERGE | `/app` home (operating desk: inbox count, last run, next standing order, health) + Action Center + CEO center (`/executive/ceo`). |
| **"More" / OS dock / PWA chrome** (`web/app/more`, OsDock) | REMOVE | Replaced by Kaivaryn's grouped nav: Command · Products · Automate · Evidence · Govern. |
| **HMAC single-owner auth** (`si_session`) | REMOVE | NextAuth + multi-tenant Membership + roles. |
| **LLM adapter** (`llm.ts`) | REMOVE | Not used. The operating layer is deterministic. |
| **Idempotency keys** | KEEP (light) | `OpCommand.idempotencyKey` (org-scoped unique) for command submissions. |

## What was dismantled (no longer exists in the client product)

1. **Separate "Ask (NL)" page** (`/app/query`): merged into Command (`ANSWER` route). Old URL redirects with `?q=` preserved.
2. **Separate Notifications page** (`/app/notifications`): merged into Inbox. Old URL redirects.
3. **Separate Jobs page** (`/app/jobs`): merged into Automations run history. Old URL redirects.
4. **SI single-owner assumptions**: global tables without an org, HMAC cookie auth, phone-first "More" dock.
5. **Autonomous code shipping** (SI V3 GitHub build pipeline) and **self-evolving architecture** (SI V2 sandbox/red-team): out of scope for a client SaaS and replaced by governed plans plus CHIEF.
6. **Redis/BullMQ queue**: replaced by in-process recorded runs (a free-tier Render constraint).
7. **Stub embeddings / LLM adapter**: removed so nothing is described as AI generation when it is not.

## Public website (kaivaryn.com) renovation

The 720 SI story is now told on the public site in business language. Every claim maps to shipped code; there are no logos, metrics, testimonials, or customer claims.

| Page | What changed |
|---|---|
| `/platform` (**new**) | Five-layer architecture: Data & evidence → Detection engines → Nine-return intelligence (R1–R9 → ZERO_RETURN, Witness-signed continuity) → Operating layer (Command, Playbooks, Standing orders, Run history, Approval gates, Initiatives) → Executive surfaces. Governance rails (tenant isolation, RBAC, human-in-the-loop, deterministic engines, audit, honest states). Integration states shown honestly: CSV/manual available; CRM/billing/ERP/ticketing labeled not connected until connected; outbound actions not automated. |
| `/` (home) | Kept "Find the money. Remove the friction." and the Zoom CTA. The hero panel now runs the product's **real** router (`src/lib/operate/router.ts`) on animated example asks. The old illustrative panel with "+14.8% surfaced this cycle" was removed. New sections: how the operating intelligence works (Ask → Route → Analyze → Gate → Brief → Measure + animated nine-return ring), a five-layer platform strip linking `/platform`, and a pricing teaser read from `PricingConfig` ($10k/mo for the first 10 clients, then $20k/mo; falls back to the same seeded values if the DB is briefly unavailable). |
| `/how-it-works` | Six-stage loop rewritten as the operating loop, plus a live routing panel and a typical-engagement timeline. Example chart kept and labeled illustrative. |
| `/intelligence` | Adds the nine-return cycle (stage-by-stage, stating that no generative model sits in the analysis path). |
| `/pricing` | "Included" list now names the operating layer. Prices stay DB-driven. Stripe checkout (`https://buy.stripe.com/14AaEZgJsdDNeTFePLeUU01`) stays in the post-demo gated flow (`PricingConfig.stripePaymentLink`, `/engage`, `render.yaml`). |
| Header / footer | "Platform" added. |

Shared narrative lives in `src/lib/public-story.ts`; animated components in `src/components/public/` (respect `prefers-reduced-motion`).

## Where each SI capability lives now (quick reference)

| If you used this in 720 SI… | …go here in Kaivaryn |
|---|---|
| Command bar / hub | `/app/command` (also embedded in `/app/action-center`) |
| Cycles / stages / zero state | `/app/intelligence` (Command: "analyze …") |
| Inbox + notifications | `/app/inbox` (briefings included) |
| Orders | `/app/automations` |
| Recipes / Library | `/app/playbooks`; Command record at `/app/command` |
| Jobs / runbooks | `/app/automations#runs` |
| Projects | `/app/initiatives` |
| Operate / health / tick | `/app/operate`; `POST /api/operate/tick` |
| Mission control / OS desk | `/app` operating desk |
| Learn / meta / evolve | `/app/learning`, `/app/intelligence` (methods, META track) |
| Build / products / agents | Command "plan …" (governed plan) · `/executive/chief` (executives) |
| Approvals / connectors / audit | `/app/approvals` · `/app/integrations` · `/admin/audit` |

## Data model (additive only)

New Prisma models, all with required `organizationId` and indexes: `OpCommand`, `OpStandingOrder`, `OpPlaybook`, `OpRun`, `OpInitiative`, `OpInitiativeLink`, `OpBriefing`, `OpHealthCheck`. No existing column was dropped or renamed, so `prisma db push` at boot is safe. The seed is idempotent: it upserts system playbooks, demo standing orders, a demo initiative, and one real `executive-weekly-review` run for the demo org.

## Tests

- `npm run test:operate`: 70+ library-level checks covering routing, every command route, runs + approval gates, standing orders, playbooks, initiatives, briefings, health, **cross-tenant reads/writes denied**, and **RBAC** (viewer cannot run or approve).
- `npm run test:operate:guards`: server-action write paths are RBAC- and tenant-guarded; return paths are in-app only.
- `npm run test:operate:api`: HTTP smoke against a running server (`BASE_URL`, default `http://localhost:3000`). Public pages incl. `/platform`, unauthenticated → 401, bad tick token rejected, the 12 SaaS pages, legacy redirects, each operating API, cross-tenant ids → 404, viewer denied.
- Existing suites still run under `npm test`: `test:si`, `test:enterprise`, `test:chief`, `test:acquisition`, `test:execution`.

## Open items

- `OPERATE_TICK_TOKEN` is declared in `render.yaml` (`sync: false`); set it (≥ 16 characters; use 32+ random) in Render before wiring a cron.
- Standing orders run on the platform cron only if an external scheduler calls `POST /api/operate/tick` with `OPERATE_TICK_TOKEN`. Free Render has no built-in cron, so without one, orders run only when someone presses **Run due** in Automations (or runs an order by hand).
- Live data integrations (CRM, billing, ERP) remain labeled "not connected" until a client connects them. CSV/manual import is the honest default.
