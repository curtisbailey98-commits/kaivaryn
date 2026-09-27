import { requireExecutive } from "@/lib/executive/access";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { submitSecuritySpec } from "../../actions";

export const dynamic = "force-dynamic";

export default async function SecurityIntakePage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireExecutive("security_intake");
  const specs = await prisma.securityAgentSpec.findMany({ orderBy: { createdAt: "desc" }, take: 20 });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Phase 4 · Prepare CHIEF for Don’s CSEO agent"
        title="Security agent specification intake"
        description="Structured intake for CSEO security-agent specs. Authenticated for Don / Codesa when activated — no assumption of Codesa ChatGPT access. Does not auto-build the full CSEO agent."
      />

      {searchParams.ok ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Spec submitted · id {searchParams.id}
        </p>
      ) : null}
      {searchParams.error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{searchParams.error}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Submit security-agent spec</CardTitle>
          <CardDescription>Responsibilities, capabilities, policies, technical requirements, tool permissions, integrations, monitoring, evals.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submitSecuritySpec} className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2 block text-xs text-neutral-400">
              Title
              <input name="title" required className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white" placeholder="CSEO Security Governance Agent" />
            </label>
            <label className="block text-xs text-neutral-400">
              Responsibilities (one per line)
              <textarea name="responsibilities" rows={4} className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white" placeholder={"Monitor security posture\nGovern agent tool grants"} />
            </label>
            <label className="block text-xs text-neutral-400">
              Capabilities (one per line)
              <textarea name="capabilities" rows={4} className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white" placeholder={"Threat summarization\nAccess review drafts"} />
            </label>
            <label className="block text-xs text-neutral-400">
              Policies (JSON)
              <textarea name="policies" rows={3} className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-white" defaultValue='{"humanApprovalRequired":true,"noSelfGrant":true}' />
            </label>
            <label className="block text-xs text-neutral-400">
              Technical requirements (JSON)
              <textarea name="technicalReqs" rows={3} className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-white" defaultValue='{"runtime":"sandbox","network":"deny"}' />
            </label>
            <label className="block text-xs text-neutral-400">
              Tool permissions (JSON array)
              <textarea name="toolPermissions" rows={3} className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-white" defaultValue='[{"toolId":"audit.append","scope":"WRITE"}]' />
            </label>
            <label className="block text-xs text-neutral-400">
              Integrations (one per line)
              <textarea name="integrations" rows={3} className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white" placeholder={"SIEM (missing)\nIdP access reviews"} />
            </label>
            <label className="block text-xs text-neutral-400">
              Monitoring (JSON)
              <textarea name="monitoring" rows={3} className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-white" defaultValue='{"alerts":["privilege_escalation","failed_auth_spike"]}' />
            </label>
            <label className="block text-xs text-neutral-400">
              Eval scenarios (one per line)
              <textarea name="evals" rows={3} className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white" placeholder={"Rejects unrestricted self-grant\nRequires human for prod credential change"} />
            </label>
            <label className="sm:col-span-2 block text-xs text-neutral-400">
              Notes
              <textarea name="notes" rows={2} className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white" />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">Submit spec to CHIEF intake</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Submitted specs</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          {specs.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-neutral-900 py-2">
              <div>
                <p className="text-neutral-200">{s.title}</p>
                <p className="text-neutral-600">{s.id} · {s.createdAt.toISOString()}</p>
              </div>
              <StatusBadge status={s.status} />
            </div>
          ))}
          {specs.length === 0 ? <p className="text-neutral-500">No specs yet — waiting on Don / Codesa activation</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
