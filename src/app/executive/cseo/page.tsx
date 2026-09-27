import Link from "next/link";
import { requireExecutive } from "@/lib/executive/access";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const STUB_MODULES = [
  { id: "posture", title: "Security posture", status: "stub" },
  { id: "governance", title: "Agent governance", status: "extension" },
  { id: "threats", title: "Threat intelligence", status: "stub" },
  { id: "infra", title: "Infrastructure security", status: "stub" },
  { id: "access", title: "Access reviews", status: "stub" },
  { id: "incidents", title: "Incidents", status: "stub" },
  { id: "api", title: "API security", status: "stub" },
  { id: "audit", title: "Security audit", status: "extension" },
  { id: "testing", title: "Security testing", status: "stub" },
  { id: "remediation", title: "Remediation tracking", status: "stub" },
];

export default async function CseoCommandCenter() {
  const exec = await requireExecutive("cseo_console");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Don Lewis · CSEO"
        title="Security Command Center"
        description="Shell for the future CSEO security division. Shared architecture and CHIEF extension points are ready; full security product surface is intentionally stubbed (Phase 5). Use Security Intake to submit agent specs."
        actions={
          <Link href="/executive/chief/intake">
            <Button size="sm">Security agent intake</Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Signed in as {exec.user.name || exec.user.email} · role {exec.platformRole}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-neutral-400">
          Dashboard switcher is permanent in the header for authorized executives. Sensitive credential / production changes require human approval policies (see EXTENSIONS.md).
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STUB_MODULES.map((m) => (
          <Card key={m.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{m.title}</span>
                <Badge tone={m.status === "extension" ? "info" : "default"}>{m.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-neutral-500">
              Route reserved: <code className="text-neutral-400">/executive/cseo/{m.id}</code>
              {m.status === "extension" ? " — CHIEF governance hooks documented." : " — not built yet."}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CHIEF extension points</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-neutral-400">
          <p>· SecurityAgentSpec intake → future manufacture of CSEO agent via CHIEF</p>
          <p>· ToolPermissionGrant with requiresHuman + no CHIEF self-grant</p>
          <p>· FoundryApproval type PRIVILEGE / POLICY for critical security changes</p>
          <p>· ExecAuditEvent dashboard=CSEO for cross-dashboard audit history</p>
          <p>
            Full detail: <Link href="#" className="pointer-events-none text-neutral-500">EXTENSIONS.md</Link> in repo root
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
