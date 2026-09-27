# Kaivaryn Extension Points — CHIEF, Dual Executive, CSEO

Internal architecture notes for continuing CHIEF Foundry and Don Lewis (CSEO) onboarding.
**Do not expose this surface to client tenants.** Routes under `/executive/*` are platform-executive only.

## Roles

| Role | Identity | Surfaces |
|------|----------|----------|
| `CEO` | Curtis Bailey (`curtis@kaivaryn.com`) | CEO Command Center, CHIEF Foundry, dashboard switcher, deploy |
| `CSEO` | Don Lewis (`don@kaivaryn.com`) | Security Command (stub), CHIEF Foundry, security intake, limited deploy |
| `SUPER_ADMIN` | Platform admin | Admin console + all executive permissions |

RBAC: `src/lib/rbac.ts` — `chief_foundry`, `chief_approve`, `chief_deploy`, `cseo_console`, `security_intake`, `switch_executive_dashboard`, `critical_security_change`.

**Hard rule:** CHIEF cannot self-grant unrestricted / ADMIN / CREDENTIAL tool scopes (`src/lib/chief/permissions.ts`). Privilege attempts create `FoundryApproval` with `selfGrantBlocked: true` and are denied by policy.

Dashboard switcher never bypasses auth — preference stored only after `requireExecutive("switch_executive_dashboard")`.

## CHIEF Foundry pipeline

```
instruction → FoundryJob
  → design (AgentTemplate match)
  → generate AgentDefinition + AgentVersion package under data/agents/
  → ToolPermissionGrant (sanitized)
  → AgentEvalRun harness
  → stage AgentDeployment (STAGING/PENDING)
  → FoundryApproval (human)
  → on approve: PRODUCTION ACTIVE
  → AgentExecution via sandboxed runner
```

Key modules:
- `src/lib/chief/foundry.ts` — manufacture / approve / run
- `src/lib/chief/templates.ts` — reusable templates
- `src/lib/chief/eval.ts` — eval lab
- `src/lib/chief/runtime.ts` — sandbox runner (no network/credentials)
- UI: `/executive/chief`
- Actions: `src/app/executive/actions.ts`

## Prisma models

`AgentDefinition`, `AgentVersion`, `AgentTemplate`, `AgentEvalRun`, `AgentDeployment`, `AgentExecution`, `FoundryJob`, `FoundryApproval`, `ToolPermissionGrant`, `ExecutiveDashboardPref`, `SecurityAgentSpec`, `ExecAuditEvent`.

## CEO Command Center

`/executive/ceo` — twelve live sections fed by `getExecutiveOverview()` (Postgres). Missing integrations labeled, never faked.

## CSEO Security Command (Phase 5 stubs)

`/executive/cseo` plus reserved modules:
`posture`, `governance`, `threats`, `infra`, `access`, `incidents`, `api`, `audit`, `testing`, `remediation`.

### CHIEF extension points for future CSEO agent

1. **Intake:** `SecurityAgentSpec` via `/executive/chief/intake` (Don/Codesa when activated — no ChatGPT assumption).
2. **Manufacture:** Add template slug `cseo-security-governor` in `templates.ts`; match on security specs.
3. **Permissions:** Grants with `requiresHuman: true`; critical types use `FoundryApproval.type = PRIVILEGE | POLICY`.
4. **Deploy policy:** `canDeployProduction` — unrestricted tools need CEO/SUPER_ADMIN.
5. **Audit:** `ExecAuditEvent` with `dashboard: "CSEO"`.
6. **Monitoring hooks:** Wire future modules to `AgentExecution` + platform health probes.

## Dual executive switcher

`ExecutiveDashboardPref.activeDashboard` ∈ `CEO | CSEO`. Header control in `ExecShell`. Both executives may navigate both environments; sensitive actions still role-gated.

## Continuity — do not duplicate

Keep existing RR (`/app/revenue`), OE (`/app/operations`), acquisition (`/admin/acquisition`), demos, and tenant SaaS. Executive dashboards are internal-only and must not replace client product UX.

## Remaining for Don onboarding

1. Set production `BOOTSTRAP_CSEO_PASSWORD` (or rotate `don@kaivaryn.com`).
2. Don submits first `SecurityAgentSpec` via intake UI.
3. Curtis/Don approve CHIEF manufacture of CSEO agent from that spec.
4. Implement Security Command modules incrementally against stubs.
5. Connect real SIEM/IdP integrations when available — label as missing until then.
