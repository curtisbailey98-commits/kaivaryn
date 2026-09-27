import Link from "next/link";
import { requireExecutive } from "@/lib/executive/access";
import { listFoundrySnapshot } from "@/lib/chief/foundry";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { instructChief, decideChiefApproval, runChiefAgent } from "../actions";

export const dynamic = "force-dynamic";

export default async function ChiefFoundryPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const exec = await requireExecutive("chief_foundry");
  const snap = await listFoundrySnapshot();
  const focusJob = searchParams.job
    ? snap.jobs.find((j) => j.id === searchParams.job)
    : snap.jobs[0];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="CHIEF · Internal agent manufacturer"
        title="CHIEF Foundry"
        description="Receive executive instructions → design architecture → generate executable package → evaluate → stage → human approval → deploy. CHIEF cannot self-grant unrestricted privileges."
      />

      {searchParams.error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{searchParams.error}</p>
      ) : null}
      {searchParams.ok ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{searchParams.msg || "OK"}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Instruct CHIEF</CardTitle>
            <CardDescription>
              Curtis / Don chat entry — manufactures sandbox agents <em>or</em> live website/app packages
              (templates: static-site, web-app, next-microsite) then deploys to <code className="text-amber-400">/a/&lt;slug&gt;</code> after approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={instructChief} className="space-y-3">
              <textarea
                name="instruction"
                required
                minLength={8}
                rows={4}
                defaultValue="Build a live internal status page for Kaivaryn platform health"
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-amber-500/50 focus:outline-none"
              />
              <Button type="submit">Manufacture agent</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Registry</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p>Templates: {snap.templates.length}</p>
            <p>Agents: {snap.agents.length}</p>
            <p>Pending approvals: {snap.approvals.length}</p>
            <p>Deployments: {snap.deployments.length}</p>
            <p>Executions: {snap.executions.length}</p>
            <Link href="/executive/chief/intake" className="block text-amber-400 hover:underline">Security agent intake →</Link>
          </CardContent>
        </Card>
      </div>

      {focusJob ? (
        <Card>
          <CardHeader>
            <CardTitle>Job activity · {focusJob.id.slice(0, 8)}</CardTitle>
            <CardDescription>
              Status <StatusBadge status={focusJob.status} /> · stage {focusJob.stage}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-300">{focusJob.instruction}</p>
            {focusJob.architectureJson ? (
              <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-neutral-800 bg-black/40 p-3 text-[11px] text-neutral-400">
                {JSON.stringify(JSON.parse(focusJob.architectureJson), null, 2)}
              </pre>
            ) : null}
            <ul className="mt-3 space-y-1 text-xs text-neutral-500">
              {(JSON.parse(focusJob.activityJson || "[]") as { event?: string; at?: string }[]).map((a, i) => (
                <li key={i}>
                  <span className="text-neutral-600">{a.at}</span> · {a.event}
                </li>
              ))}
            </ul>
            {focusJob.errorMessage ? <p className="mt-2 text-xs text-red-400">{focusJob.errorMessage}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Pending approvals</h2>
        <div className="mt-3 space-y-3">
          {snap.approvals.length === 0 ? (
            <p className="text-sm text-neutral-500">No pending foundry approvals</p>
          ) : (
            snap.approvals.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-100">{a.title}</p>
                    <p className="mt-1 text-xs text-neutral-500">{a.description}</p>
                    {a.selfGrantBlocked ? <Badge tone="danger" className="mt-2">Self-grant blocked</Badge> : null}
                  </div>
                  {exec.permissions.chiefApprove ? (
                    <div className="flex gap-2">
                      <form action={decideChiefApproval}>
                        <input type="hidden" name="approvalId" value={a.id} />
                        <input type="hidden" name="decision" value="APPROVED" />
                        <Button type="submit" size="sm">Approve & deploy</Button>
                      </form>
                      <form action={decideChiefApproval}>
                        <input type="hidden" name="approvalId" value={a.id} />
                        <input type="hidden" name="decision" value="REJECTED" />
                        <Button type="submit" size="sm" variant="outline">Reject</Button>
                      </form>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Agent registry</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950 text-neutral-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Deploy</th>
                <th className="px-3 py-2">Live</th>
                <th className="px-3 py-2">Health</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {snap.agents.map((a) => {
                const prod = a.deployments.find((d) => d.environment === "PRODUCTION" && d.status === "ACTIVE");
                const liveUrl = prod?.liveUrl || null;
                const health = prod?.healthStatus || null;
                return (
                <tr key={a.id} className="border-t border-neutral-900">
                  <td className="px-3 py-2 text-neutral-200">{a.name}</td>
                  <td className="px-3 py-2">{a.kind}</td>
                  <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                  <td className="px-3 py-2">{a.ownerRole}</td>
                  <td className="px-3 py-2">
                    {prod ? (
                      <Badge tone="success">PROD</Badge>
                    ) : a.deployments.length ? (
                      <Badge tone="warning">STAGED</Badge>
                    ) : (
                      <Badge>—</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {liveUrl ? (
                      <a href={liveUrl.startsWith("http") ? liveUrl : liveUrl} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">
                        {liveUrl.replace(/^https?:\/\/[^/]+/, "") || liveUrl}
                      </a>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {health ? <StatusBadge status={health} /> : <span className="text-neutral-600">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {prod ? (
                      <form action={runChiefAgent}>
                        <input type="hidden" name="agentId" value={a.id} />
                        <Button type="submit" size="sm" variant="secondary">Run</Button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
          {snap.agents.length === 0 ? <p className="p-4 text-neutral-500">Registry empty</p> : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent executions</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            {snap.executions.map((e) => (
              <div key={e.id} className="flex justify-between border-b border-neutral-900 py-1">
                <span className="font-mono text-neutral-500">{e.id.slice(0, 8)}</span>
                <StatusBadge status={e.status} />
              </div>
            ))}
            {snap.executions.length === 0 ? <p className="text-neutral-500">None yet</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Templates</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            {snap.templates.map((t) => (
              <div key={t.id}>
                <p className="text-neutral-200">{t.name}</p>
                <p className="text-neutral-600">{t.slug} · {t.category}</p>
              </div>
            ))}
            {snap.templates.length === 0 ? <p className="text-neutral-500">Seeded on first manufacture</p> : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
