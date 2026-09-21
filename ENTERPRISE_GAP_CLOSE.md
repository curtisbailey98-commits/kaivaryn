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

## Completion (2026-09-21 ET)

Shipped on `main` (`d31132f`), Render deploy **live**, health **200**.

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
