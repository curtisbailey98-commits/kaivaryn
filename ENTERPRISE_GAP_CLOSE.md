# Enterprise Gap Close — RR + OE only

Audited: 2026-09-21 against `/workspace/kaivaryn` (foundation already ships public site + basic RR/OE CRUD + SI approvals/connectors/intelligence stubs).

## Map

| Area | State | Notes |
|------|-------|-------|
| Tenant isolation | **Partial** | `organizationId` on queries; no cross-tenant test; SUPER_ADMIN only on `/admin` |
| RBAC | **Partial** | Roles enum exists; **no** Viewer≠Analyst≠Manager≠Admin≠Owner enforcement on mutations |
| Opportunity / Inefficiency CRUD | **Works** | Tenant-scoped create/update/notes |
| Status lifecycle + history | **Missing** | Flat statuses; no `StatusHistory` |
| Customers/leads/txns/appointments | **Missing** | Needed for detection engines |
| Processes / workflows | **Missing** | OE needs process + inefficiency link |
| Detection engines | **Missing** | No deterministic rules |
| Scoring | **Missing** | Priority is manual enum only |
| Financial impact engine | **Partial** | Estimated≠recovered UI copy; no shared service; no potential/approved/in-progress/verified |
| Actions (assign/draft email/task/external) | **Partial** | Assign+notes+status; no draft email, tasks, honest external gate |
| Executive Action Center | **Partial** | Separate lists; not unified impact/urgency ranking; weak mobile |
| Intelligence E\|A\|R\|D | **Partial** | FINDING / INSUFFICIENT_DATA; no Decision / provenance on findings |
| Imports CSV | **Missing** | |
| Jobs queue | **Missing** | |
| Notifications | **Missing** | |
| Search / Export | **Missing** | |
| Audit | **Works** | Append-only; not hash-chained (SQLite OK) |
| Demo seed | **Partial** | DEMO opportunities/inefficiencies; not interconnected journey |
| Analytics | **Works** | DB aggregates; no pagination/indexes beyond basic |
| Hardcoded charts | **None found** | Analytics from live queries |
| Marketing site | **Out of scope** | Do not rebuild |

## Priority close order (this pass)

1. RBAC + isolation test  
2. Prisma expansion (entities, StatusHistory, settings, jobs, notifications, findings, evidence)  
3. Detection + scoring + financial impact services  
4. Workflows / StatusHistory / actions honesty  
5. Action Center union ranking  
6. Imports / jobs / notifications / search / export  
7. Demo seed interconnected  
8. Validation scripts + Render redeploy  

## Non-goals

- Rebuild public/marketing pages  
- Decorative mock dashboards  
- Fake send / fake integration success  
- Touch 720 SI Render services  

## Completion v1 (2026-09-21 ET)

Shipped on `main` (`d31132f` → docs `62a456d`, Zoom fields `1bfcaba`). Render deploy **live**, health **200**.

| # | Item | Result |
|---|------|--------|
| 1 | Tenant isolation + RBAC | Done — `rbac.ts` + `requirePermission`; `scripts/enterprise-validation.ts` proves 2-org cross-tenant fail |
| 2 | Persistent models | Done — customers/contacts/leads/txns/appts/interactions/processes/StatusHistory/evidence/findings/imports/jobs/notifications/tasks/email drafts/org settings/departments + RR/OE financial fields + provenance |
| 3 | Detection engines | Done — deterministic rules; org threshold settings |
| 4 | Scoring | Done — weighted factors JSON for admins |
| 5 | Workflows + StatusHistory | Done — RR/OE lifecycles + history |
| 6 | Actions | Done — assign/notes/status/recovery/savings/draft email/task/external→approval; never fake send |
| 7 | Financial impact engine | Done — shared service; LLM never sets money |
| 8 | Executive Action Center | Done — union rank impact×urgency; mobile nav |
| 9 | Intelligence E/A/R/D | Done — findings + INSUFFICIENT_DATA |
| 10 | NL query | Partial — tenant search only (not NL parser) |
| 11 | CSV imports | Done |
| 12 | Jobs | Done — in-process |
| 13 | Notifications | Done |
| 14 | Search | Done — tenant-scoped |
| 15 | Exports | Done — `/api/export` |
| 16 | Audit | Done — append-only |
| 17 | Demo seed | Done — interconnected DEMO + other-co foil |
| 18 | Analytics | Done — DB aggregates + indexes |
| 19 | UX states | Partial — empty states on key pages; success toasts light |
| 20 | Reuse 720 SI | Done — approvals/connectors/anti-fabrication/health; SI Render untouched |

Validation: `npm run test:enterprise` ALL PASSED. Stripe link unchanged in PricingConfig.

## Completion v2 (2026-09-21 ET) — honesty / executive gap close

**Do not rebuild.** Closed remaining honesty gaps vs re-sent enterprise brief. Credentials unchanged.

| # | Item | v2 result |
|---|------|-----------|
| 1 | Tenant isolation + RBAC | Unchanged (still enforced) |
| 2 | Persistent models | Extended `OrgSettings`: manager/admin approval limits, `requireApprovalAbove`, notify prefs + `notifyEmailEnabled` (SMTP honest) |
| 3 | Detection engines | Unchanged |
| 4 | Scoring | Unchanged |
| 5 | Workflows + StatusHistory | Unchanged |
| 6 | Actions | High-value recovery/savings gated; above threshold → `HIGH_VALUE_*` ApprovalRequest (step-up); approve applies amounts, never external exec |
| 7 | Financial impact engine | Unchanged |
| 8 | Executive Action Center | Ask (NL) + Reports shortcuts + compact NL form panel |
| 9 | Intelligence E/A/R/D | Unchanged |
| 10 | **NL query** | **Done** — deterministic interpreters in `src/lib/nl-query.ts`; UI `/app/query` (RBAC read+); example questions + keyword fallback; tenant-scoped only |
| 11 | CSV imports | Flash confirmation on complete |
| 12 | Jobs | Unchanged |
| 13 | Notifications | Prefs editable in Settings; assign/recovery/high-value respect toggles |
| 14 | Search | Unchanged (keyword); NL is separate path |
| 15 | **Exports / reports** | **Done** — RR Summary, Ops Summary, Weekly Brief, Monthly Impact as CSV + printable HTML (`/app/reports`, `/api/reports`); PDF via browser print |
| 16 | Audit | Unchanged |
| 17 | Demo seed | Zoom scheduler URL seeded on every reseed (free Render) |
| 18 | Analytics | Unchanged |
| 19 | **UX** | **Done** — `FlashToast` on `?ok=` / `?error=` / `?msg=` for assign, status, recovery, savings, import, settings, approvals |
| 20 | Reuse 720 SI | Unchanged; SI Render untouched |

### v2 also

- **Client admin** — `/app/settings` edits detection thresholds, scoring weights, approval amount/role gates, notification prefs (Admin+)
- **Zoom** — `PricingConfig.zoomMeetingUrl` = `https://scheduler.zoom.us/curtis-bailey/kaivaryn-executive-demo`; thank-you CTA shows Join/schedule when set
- Tests extended: NL intents, report aggregates, threshold gate matrix, OrgSettings fields

### Still honest blockers / non-fake

- **SQLite ephemeral on free Render** — disk wiped on redeploy; `startCommand` reseeds (demo journey restored; not durable prod storage)
- **Email send / CRM external** — drafts + approval queue only; `notifyEmailEnabled` needs SMTP; integrations stay `needsIntegration` until credentials connected
- **PDF** — printable HTML (Print → PDF); no heavy PDF dependency

Validation: `npm run test:enterprise` ALL PASSED.


## Completion v3 (2026-09-27 ET) — Demo Zoom CTA + public polish + SaaS merge

| # | Item | Result |
|---|------|--------|
| 1 | Demo Zoom CTA | **Done** — `/demo` always shows **Schedule executive demo on Zoom** → `ZOOM_SCHEDULER_URL` / `PricingConfig.zoomMeetingUrl`; thank-you always shows same CTA |
| 2 | Prospect Zoom field | **Removed** from public form; admin per-lead `zoomLink` retained |
| 3 | Constant | `ZOOM_SCHEDULER_URL` in `src/lib/constants.ts`; seed + `getPricingConfig` fallback use it |
| 4 | Public polish | Hero, solutions, how-it-works, pricing denser executive copy; Book Demo + Zoom schedule + Stripe activate paths (no fake stats/logos) |
| 5 | SaaS deepen | NL Ask `/app/query`, Reports `/app/reports`+`/api/reports`, approval thresholds, FlashToast, Org Settings — merged from pending work |
| 6 | Marketing rebuild | **Not done** — upgrade in place only |

Validation: `npm run test:enterprise` ALL PASSED after merge.
