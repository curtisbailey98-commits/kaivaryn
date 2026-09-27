import Link from "next/link";
import { requireExecutive } from "@/lib/executive/access";
import { getExecutiveOverview, money } from "@/lib/executive/overview";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { instructChief } from "../actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CeoCommandCenter() {
  await requireExecutive("executive_console");
  const data = await getExecutiveOverview();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Curtis Bailey · CEO"
        title="Executive Command Center"
        description="Company status across revenue, acquisition, RR/OE SaaS, agent workforce, and CHIEF Foundry — real database metrics. Missing integrations labeled."
        actions={
          <Link href="/executive/chief">
            <Button size="sm">Open CHIEF Agent Foundry</Button>
          </Link>
        }
      />

      <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-neutral-950 to-neutral-950 shadow-[0_0_40px_rgba(245,158,11,0.08)]">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-amber-200">CHIEF Agent Foundry</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Manufacture, evaluate, approve, and deploy internal agents and live website packages. Primary executive workspace for Curtis.
            </CardDescription>
          </div>
          <Link href="/executive/chief">
            <Button size="sm" className="shrink-0">Enter CHIEF Agent Foundry →</Button>
          </Link>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-xs text-neutral-400">
          <Link href="/executive/chief" className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-medium text-amber-300 hover:bg-amber-500/20">
            /executive/chief
          </Link>
          <Link href="/executive/chief/intake" className="rounded-md border border-neutral-700 px-3 py-2 hover:border-amber-500/40 hover:text-amber-300">
            Security intake
          </Link>
          <span className="rounded-md border border-neutral-800 px-3 py-2">
            Pending approvals: {data.agents.pendingApprovals.length} · Jobs: {data.agents.foundryJobs.length}
          </span>
        </CardContent>
      </Card>

      {/* 1. Executive overview */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">1 · Company status</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Organizations" value={data.company.organizations} />
          <MetricCard label="Users" value={data.company.users} />
          <MetricCard label="Demo leads" value={data.company.demoLeads} />
          <MetricCard label="Pending approvals" value={data.company.pendingApprovals} />
        </div>
      </section>

      {/* 2. Revenue */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">2 · Revenue & commercial</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Subscription revenue</CardTitle>
              <CardDescription>{data.revenue.note}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-amber-300">{money(data.revenue.subscriptionRevenueCents / 100)}</p>
              <p className="mt-1 text-xs text-neutral-500">{data.revenue.activeSubscriptions} active / {data.revenue.totalSubscriptions} total subs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>RR recovered (tenant data)</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{money(data.revenue.recoveredAmount)}</p>
              <p className="mt-1 text-xs text-neutral-500">Verified {money(data.revenue.verifiedAmount)} · Potential {money(data.revenue.potentialAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Opportunities tracked</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{data.revenue.opportunityCount}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 3-4 Acquisition + demo */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">3 · Client acquisition pipeline</h2>
          <Card className="mt-3">
            <CardContent className="space-y-2 pt-4">
              <p className="text-sm text-neutral-400">Accounts: <strong className="text-neutral-100">{data.acquisition.total}</strong></p>
              <div className="flex flex-wrap gap-2">
                {data.acquisition.byStage.length === 0 ? (
                  <p className="text-xs text-neutral-500">No acquisition accounts yet</p>
                ) : (
                  data.acquisition.byStage.map((s) => (
                    <Badge key={s.stage} tone="default">{s.stage}: {s.count}</Badge>
                  ))
                )}
              </div>
              <ul className="mt-3 space-y-1.5 border-t border-neutral-800 pt-3">
                {data.acquisition.recent.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2 text-xs">
                    <span className="truncate text-neutral-300">{a.company}</span>
                    <StatusBadge status={a.stage} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">4 · Prospect qualification & demo funnel</h2>
          <Card className="mt-3">
            <CardContent className="space-y-2 pt-4">
              <div className="flex flex-wrap gap-2">
                {data.demoFunnel.byStatus.map((s) => (
                  <Badge key={s.status} tone="info">{s.status}: {s.count}</Badge>
                ))}
              </div>
              <ul className="mt-3 space-y-1.5 border-t border-neutral-800 pt-3">
                {data.demoFunnel.recent.map((d) => (
                  <li key={d.id} className="flex justify-between gap-2 text-xs">
                    <span className="truncate text-neutral-300">{d.company} · {d.email}</span>
                    <StatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
              <Link href="/admin/demos" className="inline-block text-xs text-amber-400 hover:underline">Manage demos →</Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 5-6 RR / OE */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>5 · Revenue Recovery SaaS</CardTitle>
            <CardDescription>{data.rr.activeOrgEntitlements} orgs entitled</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-neutral-500">Opportunities</p><p className="text-lg font-semibold">{data.rr.opportunityCount}</p></div>
            <div><p className="text-neutral-500">Recovered</p><p className="text-lg font-semibold">{money(data.rr.recovered)}</p></div>
            <div><p className="text-neutral-500">Verified</p><p className="text-lg font-semibold">{money(data.rr.verified)}</p></div>
            <div><p className="text-neutral-500">Potential</p><p className="text-lg font-semibold">{money(data.rr.potential)}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>6 · Operations Efficiency SaaS</CardTitle>
            <CardDescription>{data.oe.activeOrgEntitlements} orgs entitled</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-neutral-500">Inefficiencies</p><p className="text-lg font-semibold">{data.oe.inefficiencyCount}</p></div>
            <div><p className="text-neutral-500">Est. waste</p><p className="text-lg font-semibold">{money(data.oe.estimatedWaste)}</p></div>
            <div><p className="text-neutral-500">Projected</p><p className="text-lg font-semibold">{money(data.oe.projectedSavings)}</p></div>
            <div><p className="text-neutral-500">Realized</p><p className="text-lg font-semibold">{money(data.oe.realizedSavings)}</p></div>
          </CardContent>
        </Card>
      </section>

      {/* 7-8 Agents + CHIEF chat */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">7 · Agent workforce</h2>
          <Card className="mt-3">
            <CardContent className="pt-4">
              <p className="text-sm text-neutral-400">
                Registered agents: <strong className="text-white">{data.agents.definitions.length}</strong> ·
                Production active: <strong className="text-emerald-300">{data.agents.activeCount}</strong>
              </p>
              <ul className="mt-3 space-y-2">
                {data.agents.definitions.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-neutral-300">{a.name}</span>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
                {data.agents.definitions.length === 0 ? (
                  <p className="text-xs text-neutral-500">No agents yet — instruct CHIEF below</p>
                ) : null}
              </ul>
            </CardContent>
          </Card>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">8 · CHIEF Agent Foundry</h2>
          <Card className="mt-3">
            <CardHeader>
              <CardTitle>Instruct CHIEF</CardTitle>
              <CardDescription>Architecture → generate → eval → approval → deploy. CHIEF cannot self-grant unrestricted privileges.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={instructChief} className="space-y-3">
                <textarea
                  name="instruction"
                  required
                  minLength={8}
                  rows={3}
                  placeholder="e.g. Manufacture an internal ops status reporter that summarizes platform health"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-amber-500/50 focus:outline-none"
                />
                <Button type="submit" size="sm">Send to CHIEF</Button>
              </form>
              <p className="mt-3 text-xs text-neutral-500">
                Pending foundry approvals: {data.agents.pendingApprovals.length} · Recent jobs: {data.agents.foundryJobs.length}
              </p>
              <Link href="/executive/chief" className="mt-2 inline-block text-xs text-amber-400 hover:underline">Open CHIEF Agent Foundry →</Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 9 Clients */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">9 · Client accounts & onboarding</h2>
        <Card className="mt-3">
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="py-2 pr-4">Organization</th>
                    <th className="py-2 pr-4">Product</th>
                    <th className="py-2">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clients.entitlements.slice(0, 12).map((e) => (
                    <tr key={e.id} className="border-t border-neutral-900">
                      <td className="py-2 pr-4 text-neutral-200">{e.organization.name}</td>
                      <td className="py-2 pr-4">{e.product}</td>
                      <td className="py-2">{e.active ? "yes" : "no"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.clients.entitlements.length === 0 ? (
                <p className="text-xs text-neutral-500">No entitlements recorded</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 10-11 Platform + financial integrations */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">10 · Platform health & incidents</h2>
          <Card className="mt-3">
            <CardContent className="space-y-2 pt-4 text-xs">
              {data.platform.integrationStatuses.map((s) => (
                <div key={s.status} className="flex justify-between">
                  <span>Tenant integrations · {s.status}</span>
                  <span className="text-neutral-300">{s.count}</span>
                </div>
              ))}
              <div className="border-t border-neutral-800 pt-2">
                <p className="mb-1 font-medium text-neutral-400">Integration visibility</p>
                {data.platform.missingIntegrations.map((m) => (
                  <div key={m.key} className="flex justify-between py-0.5">
                    <span>{m.label}</span>
                    <Badge tone={m.status === "configured" ? "success" : "warning"}>{m.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">11 · Financial & integration visibility</h2>
          <Card className="mt-3">
            <CardContent className="pt-4 text-xs text-neutral-400">
              <p>Stripe payment link configured: {process.env.STRIPE_PAYMENT_LINK || process.env.STRIPE_PAYMENT_LINK_FALLBACK ? "yes" : "missing"}</p>
              <p className="mt-1">Webhook secret: {process.env.STRIPE_WEBHOOK_SECRET ? "configured" : "missing — payment completion verification incomplete"}</p>
              <p className="mt-3 text-neutral-500">Recent intelligence runs: {data.platform.recentIntelligence.length} · Import jobs: {data.platform.recentImports.length}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 12 Approvals */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">12 · Executive approvals & notifications</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Foundry approvals pending</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {data.agents.pendingApprovals.length === 0 ? (
                <p className="text-neutral-500">None pending</p>
              ) : (
                data.agents.pendingApprovals.map((a) => (
                  <div key={a.id} className="flex justify-between gap-2 border-b border-neutral-900 py-1.5">
                    <span className="truncate text-neutral-300">{a.title}</span>
                    <StatusBadge status={a.status} />
                  </div>
                ))
              )}
              <Link href="/executive/chief" className="text-amber-400 hover:underline">Review in CHIEF Agent Foundry →</Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recent notifications</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {data.notifications.slice(0, 6).map((n) => (
                <div key={n.id} className="border-b border-neutral-900 py-1.5">
                  <p className="text-neutral-300">{n.title}</p>
                  <p className="text-neutral-600">{n.body?.slice(0, 100)}</p>
                </div>
              ))}
              {data.notifications.length === 0 ? <p className="text-neutral-500">No notifications</p> : null}
            </CardContent>
          </Card>
        </div>
      </section>

      <p className="text-[10px] text-neutral-600">Snapshot generated {data.generatedAt} · source: live Postgres</p>
    </div>
  );
}
