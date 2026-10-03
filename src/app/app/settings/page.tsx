import { requirePermission, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateOrgSettings } from "./actions";
import { EmptyState } from "@/components/ui/states";
import { getSettingsUsageChartData } from "@/lib/chart-data";
import { DynAreaChart, KpiSpark } from "@/components/charts/dynamic";
import { CHART } from "@/components/charts/theme";

export const metadata = { title: "Org settings" };

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requirePermission("read");
  assertOrgId(ctx.organizationId);
  const canEdit = can(ctx.effectiveRole, "manage_settings");

  const usage = await getSettingsUsageChartData(ctx.organizationId);
  const settings = await prisma.orgSettings.upsert({
    where: { organizationId: ctx.organizationId },
    update: {},
    create: { organizationId: ctx.organizationId },
  });
  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });
  let timezone = "America/New_York";
  if (settings.settingsJson) {
    try {
      const parsed = JSON.parse(settings.settingsJson) as { timezone?: string };
      if (parsed.timezone) timezone = parsed.timezone;
    } catch { /* keep default */ }
  }

  if (!canEdit) {
    return (
      <div>
        <p className="si-label text-amber-500">Organization</p>
        <h1 className="mt-1 text-2xl font-semibold">Settings</h1>
        <EmptyState
          className="mt-8"
          title="View-only"
          description={`Detection and approval thresholds are managed by Admin/Owner. Your role: ${ctx.effectiveRole}.`}
        />
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          {[
            ["High-value threshold", settings.highValueThreshold],
            ["Manager approval limit", settings.managerApprovalLimit],
            ["Admin approval limit", settings.adminApprovalLimit],
            ["Require approval above", settings.requireApprovalAbove],
            ["Notify on assign", settings.notifyAssign ? "yes" : "no"],
            ["Email notifications", settings.notifyEmailEnabled ? "on (needs SMTP)" : "off"],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded border border-neutral-900 p-3">
              <dt className="text-[10px] uppercase text-neutral-500">{k}</dt>
              <dd className="mt-1 text-neutral-200">{String(v)}</dd>
            </div>
          ))}
        </dl>
        
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <KpiSpark
          label="Imports (8 wk)"
          value={usage.totals.imports}
          data={usage.importSpark}
          color={CHART.sky}
          footnote={usage.sourceNote}
          stagger={0}
        />
        <KpiSpark
          label="Intelligence runs"
          value={usage.totals.runs}
          data={usage.runSpark}
          color={CHART.violet}
          footnote="Finding-producing runs"
          stagger={1}
        />
        <KpiSpark
          label="Audit events"
          value={usage.totals.audits}
          data={usage.auditSpark}
          color={CHART.amber}
          footnote="Recorded workspace actions"
          stagger={2}
        />
      </div>
      <div className="mt-4">
        <DynAreaChart
          title="Workspace usage"
          description="Imports, intelligence runs, audits, and notifications by week"
          data={usage.usage}
          series={[
            { key: "imports", label: "Imports", color: CHART.sky },
            { key: "runs", label: "Runs", color: CHART.violet },
            { key: "audits", label: "Audits", color: CHART.amber },
            { key: "notifications", label: "Notifications", color: CHART.emerald },
          ]}
          stacked
          money={false}
          height={240}
          footnote={usage.sourceNote}
          stagger={3}
        />
      </div>

      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <p className="si-label text-amber-500">Organization</p>
      <h1 className="mt-1 text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Detection thresholds, scoring weights, amount/role approval gates, and notification preferences.
        Email send still requires SMTP — enabling the toggle alone never fakes delivery.
      </p>


      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <KpiSpark
          label="Imports (8 wk)"
          value={usage.totals.imports}
          data={usage.importSpark}
          color={CHART.sky}
          footnote={usage.sourceNote}
          stagger={0}
        />
        <KpiSpark
          label="Intelligence runs"
          value={usage.totals.runs}
          data={usage.runSpark}
          color={CHART.violet}
          footnote="Finding-producing runs"
          stagger={1}
        />
        <KpiSpark
          label="Audit events"
          value={usage.totals.audits}
          data={usage.auditSpark}
          color={CHART.amber}
          footnote="Recorded workspace actions"
          stagger={2}
        />
      </div>
      <div className="mt-4">
        <DynAreaChart
          title="Workspace usage"
          description="Imports, intelligence runs, audits, and notifications by week"
          data={usage.usage}
          series={[
            { key: "imports", label: "Imports", color: CHART.sky },
            { key: "runs", label: "Runs", color: CHART.violet },
            { key: "audits", label: "Audits", color: CHART.amber },
            { key: "notifications", label: "Notifications", color: CHART.emerald },
          ]}
          stacked
          money={false}
          height={240}
          footnote={usage.sourceNote}
          stagger={3}
        />
      </div>

      <form action={updateOrgSettings} className="mt-8 space-y-8">
        <section className="si-panel space-y-3 p-4">
          <p className="si-label">Organization display</p>
          <p className="text-xs text-neutral-500">Branding-safe display name shown in the app shell. Timezone is stored for digests and aging labels — not used to invent metrics.</p>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-neutral-500">Display name</span>
              <Input name="displayName" defaultValue={org?.name || ""} className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-500">Timezone</span>
              <Input name="timezone" defaultValue={timezone} placeholder="America/New_York" className="mt-1" />
            </label>
          </div>
        </section>

        <section className="si-panel space-y-3 p-4">
          <p className="si-label">Detection thresholds</p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {(
              [
                ["stalledLeadDays", "Stalled lead (days)", settings.stalledLeadDays],
                ["dormantCustomerDays", "Dormant customer (days)", settings.dormantCustomerDays],
                ["failedPaymentLookbackDays", "Failed payment lookback", settings.failedPaymentLookbackDays],
                ["missedAppointmentDays", "Missed appointment (days)", settings.missedAppointmentDays],
                ["pipelineStallDays", "Pipeline stall (days)", settings.pipelineStallDays],
                ["churnRiskInactiveDays", "Churn risk inactive", settings.churnRiskInactiveDays],
                ["unansweredInquiryHours", "Unanswered inquiry (hrs)", settings.unansweredInquiryHours],
                ["approvalDelayDays", "Approval delay (days)", settings.approvalDelayDays],
                ["duplicateWorkWindowDays", "Duplicate work window", settings.duplicateWorkWindowDays],
              ] as const
            ).map(([name, label, val]) => (
              <label key={name} className="block">
                <span className="text-xs text-neutral-500">{label}</span>
                <Input name={name} type="number" defaultValue={val} className="mt-1" />
              </label>
            ))}
          </div>
        </section>

        <section className="si-panel space-y-3 p-4">
          <p className="si-label">Scoring weights (normalized at score time)</p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {(
              [
                ["scoreWeightAmount", "Amount", settings.scoreWeightAmount],
                ["scoreWeightAge", "Age", settings.scoreWeightAge],
                ["scoreWeightPriority", "Priority", settings.scoreWeightPriority],
                ["scoreWeightEvidence", "Evidence", settings.scoreWeightEvidence],
              ] as const
            ).map(([name, label, val]) => (
              <label key={name} className="block">
                <span className="text-xs text-neutral-500">{label}</span>
                <Input name={name} type="number" step="0.01" defaultValue={val} className="mt-1" />
              </label>
            ))}
          </div>
        </section>

        <section className="si-panel space-y-3 p-4">
          <p className="si-label">Approval thresholds (amount / role)</p>
          <p className="text-xs text-neutral-500">
            Manager may record recovery up to manager limit; Admin up to admin limit; above that needs Owner.
            Amounts at/above &quot;require approval above&quot; always queue an ApprovalRequest instead of direct record.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="block">
              <span className="text-xs text-neutral-500">High-value threshold</span>
              <Input name="highValueThreshold" type="number" step="0.01" defaultValue={settings.highValueThreshold} className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-500">Manager approval limit</span>
              <Input name="managerApprovalLimit" type="number" step="0.01" defaultValue={settings.managerApprovalLimit} className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-500">Admin approval limit</span>
              <Input name="adminApprovalLimit" type="number" step="0.01" defaultValue={settings.adminApprovalLimit} className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-500">Require approval above</span>
              <Input name="requireApprovalAbove" type="number" step="0.01" defaultValue={settings.requireApprovalAbove} className="mt-1" />
            </label>
          </div>
        </section>

        <section className="si-panel space-y-3 p-4">
          <p className="si-label">Notification preferences</p>
          <div className="space-y-2 text-sm">
            {(
              [
                ["notifyAssign", "Notify on assign", settings.notifyAssign],
                ["notifyStatusChange", "Notify on status change", settings.notifyStatusChange],
                ["notifyRecovery", "Notify on recovery / savings", settings.notifyRecovery],
                ["notifyHighValue", "Notify on high-value events", settings.notifyHighValue],
                ["notifyWeeklyBrief", "Weekly brief reminder (in-app)", settings.notifyWeeklyBrief],
                ["notifyEmailEnabled", "Email notifications (needs SMTP — never faked)", settings.notifyEmailEnabled],
              ] as const
            ).map(([name, label, checked]) => (
              <label key={name} className="flex items-center gap-2">
                <input type="checkbox" name={name} defaultChecked={checked} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>

        <Button type="submit">Save settings</Button>
      </form>
    </div>
  );
}
