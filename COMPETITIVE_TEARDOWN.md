# Kaivaryn Competitive Teardown — Revenue Recovery & Ops Efficiency
**Date:** 2026-09-27 (ET) · **Scope:** durable patterns only (no branding/logo theft) · **Fit:** consulting-led $10k–$20k/mo

## Category patterns (synthesized)

### A. Revenue recovery / leakage / billing integrity
Sources studied: HighRadius deductions/dispute, Waystar denial recovery, FinThrive A/R Optimizer, Rivet Resolve, Chargebee/Maxio-style recognition vs collection gaps (conceptual).

| Pattern | What leaders actually buy | Honesty mechanism |
|---|---|---|
| Hero | “Stop leaving cash in aging disputes / denials / underpayments” | Recovery rate, DDO/aging, invalid-claim % — labeled as measured or modeled |
| Loop | Detect → score (likelihood × $) → assign worklist → evidence pack → dispute/appeal → close → root-cause prevent | Backup docs / evidence required before “recovered” |
| UX | Worklists + aging buckets + batch actions + claim/line detail | Projected pipeline ≠ cash posted |
| Action Center | SLA / timely-filing alerts, owner queues, bulk appeal | Status trail |
| Financial truth | Open pipeline vs recovered vs write-off | Never conflate estimate with banked |
| Trust | Audit, RBAC, exports; SSO often claimed | We ship audit/RBAC/exports; SSO deferred |
| Site IA | Problem → method → workflow stages → KPI framework → demo/ROI | Case stats only when real |

### B. Ops efficiency / process intelligence / automation ROI
Sources: Celonis (find→quantify→act inbox), UiPath Automation Hub/Insights (estimated vs actual savings), Automation Anywhere CoE ROI, ServiceNow/Moveworks ops triage (priority queues).

| Pattern | Durable takeaway |
|---|---|
| Hero | Quantify friction → govern intervention → prove realized hours/$ |
| Loop | Detect bottleneck → estimate waste → readiness score → approve automation → execute (or record decision) → ledger realized vs projected |
| UX | Bottleneck heat, initiative cards, realization ledger, precision gap (est vs actual) |
| Action Center | Signal inbox with routing + feedback to reduce noise |
| Financial truth | Projected savings ≠ realized; hours tracked separately |
| Site | ROI calculator with labeled estimates; TEI-style frameworks without fake customers |

## Gaps vs CURRENT Kaivaryn (live + repo)

| Competitor bar | Kaivaryn today | Gap severity |
|---|---|---|
| Aging + SLA badges on action queue | Action Center ranks impact/urgency but no aging buckets / SLA chrome | High |
| Bulk approve/deny with reasons | Single-item approve; note optional | High |
| Recovery funnel stages viz + recovery rate | Status views exist; no funnel strip / rate metric | High |
| Leakage taxonomy clarity | Free-text `type`; no canonical chips | Med-High |
| Realization ledger + automation readiness | Fields exist; weak OE ledger / readiness UX | High |
| Bottleneck heat by dept | Missing | Med |
| Honest public ROI estimator | Missing | High (sales) |
| Solution pages: problem→method→workflow→outcomes | Thin 3-card pages | High |
| Org display name + timezone | Thresholds only | Med |
| Weekly digest queue (no fake email) | Toggle exists; no queue stub | Med |
| SSO | Not shipped | Deferred (honest) |

## TOP 8 shippable upgrades (impact × fit)

1. **Action Center triage** — aging buckets, SLA badges, owner, unassigned / needs-attention filters  
2. **Approvals bulk decide** — multi-select approve/deny with required reason + aging  
3. **RR recovery funnel + rate + taxonomy chips**  
4. **OE realization ledger + automation readiness + dept heat**  
5. **Public Value Estimator** — inputs → estimate range, labeled estimate (not realized)  
6. **Solution pages deepen** — problem → method → workflow → outcomes framework (no fake stats)  
7. **Org settings** — display name + timezone (settingsJson / org name)  
8. **Weekly digest stub + executive report polish** — queue EmailDraft / in-app notification, never fake SMTP send  

Deferred: SSO/SAML, real SMTP, live ERP connectors, fabricated logos/testimonials, competitor-branded ROI claims.
