import Link from "next/link";
import { FileSpreadsheet, Sheet, Webhook, PenLine, ArrowRight } from "lucide-react";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { smtpConfigured, stripeLinkConfigured } from "@/lib/si-connectors";
import { getPricingConfig } from "@/lib/pricing";
import { getInboundConnection } from "@/lib/integrations/inbound";
import { IMPORT_TEMPLATES, getTemplate } from "@/lib/integrations/templates";
import { InboundKey } from "@/components/integrations/inbound-key";
import { importSheetAction, resyncSheetAction, disconnectSheetAction, revokeInboundKeyAction } from "./actions";
import { formatInZone } from "@/lib/operate";
import { getIndustryContext, getSelectedSystems } from "@/lib/industry/context";
import { RestaurantSystemsPanel } from "@/components/industry/restaurant-systems-panel";
import { SelectedSystemsGuides } from "@/components/integrations/selected-systems-guides";
import { getSystemSetup } from "@/lib/integrations/setup-store";
import { getSquareView } from "@/lib/integrations/square/connection";
import { getPosSummary } from "@/lib/integrations/square/summary";
import { SquareCard } from "@/components/integrations/square-card";

export const metadata = { title: "Integrations" };

export const dynamic = "force-dynamic";

type Status = "CONNECTED" | "WAITING" | "NOT_CONNECTED" | "ON_REQUEST" | "SOON";

const STATUS_UI: Record<Status, { label: string; cls: string; dot: string }> = {
  CONNECTED: { label: "Connected", cls: "border-emerald-800 bg-emerald-950/60 text-emerald-300", dot: "bg-emerald-400" },
  WAITING: { label: "Not connected · waiting for data", cls: "border-amber-800 bg-amber-950/50 text-amber-300", dot: "bg-amber-400" },
  NOT_CONNECTED: { label: "Not connected", cls: "border-neutral-700 bg-neutral-900 text-neutral-300", dot: "bg-neutral-500" },
  ON_REQUEST: { label: "Not connected · available on request", cls: "border-neutral-800 bg-neutral-950 text-neutral-400", dot: "bg-neutral-600" },
  SOON: { label: "Coming soon", cls: "border-sky-900 bg-sky-950/40 text-sky-300", dot: "bg-sky-500" },
};

function StatusPill({ status }: { status: Status }) {
  const s = STATUS_UI[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-3 space-y-1.5">
      {steps.map((s, i) => (
        <li key={s} className="flex gap-2 text-xs leading-5 text-neutral-400">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-neutral-700 text-[9px] text-neutral-400">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function SetupCard({ id, icon, title, status, detail, steps, children }: { id?: string; icon: React.ReactNode; title: string; status: Status; detail: string; steps: string[]; children?: React.ReactNode }) {
  return (
    <section id={id} className="flex min-w-0 flex-col rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/60 to-neutral-950 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">{icon}</span>
          <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        </div>
        <StatusPill status={status} />
      </div>
      <p className="mt-3 text-xs leading-5 text-neutral-400">{detail}</p>
      <Steps steps={steps} />
      {children ? <div className="mt-4 border-t border-neutral-900 pt-4">{children}</div> : null}
    </section>
  );
}

const ON_REQUEST: Array<{ provider: string; title: string; systems: string; today: string; template: string }> = [
  { provider: "billing_system", title: "Billing system", systems: "QuickBooks, Xero, Stripe Billing, practice-management billing", today: "Export invoices and use the Billing export template.", template: "billing_export" },
  { provider: "claims_payer", title: "Claims / clearinghouse", systems: "835 remittance files, clearinghouse portals", today: "Export a remittance summary and use the Payer remittance template.", template: "payer_remittance" },
  { provider: "erp_generic", title: "ERP / accounting", systems: "NetSuite, Sage Intacct, Microsoft Dynamics", today: "Export AR aging or a price list and use those templates.", template: "ar_aging" },
  { provider: "crm", title: "CRM", systems: "Salesforce, HubSpot", today: "Export accounts and use the Customers template.", template: "customers" },
  { provider: "hris", title: "HRIS / time tracking", systems: "ADP, Gusto, Harvest, Toggl", today: "Export hours by activity and use the Timesheets template.", template: "timesheets" },
];

export default async function IntegrationsPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const orgId = ctx.organizationId;
  const [industry, systems, setup] = await Promise.all([getIndustryContext(orgId, ctx.user.id), getSelectedSystems(orgId), getSystemSetup(orgId)]);
  const canWrite = can(ctx.effectiveRole, "write");
  const [connections, lastFileImport, recent, inbound, pricing] = await Promise.all([
    prisma.integrationConnection.findMany({ where: { organizationId: orgId } }),
    prisma.importJob.findFirst({ where: { organizationId: orgId, status: "SUCCEEDED", OR: [{ source: null }, { source: "CSV_UPLOAD" }] }, orderBy: { createdAt: "desc" } }),
    prisma.importJob.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 6 }),
    getInboundConnection(orgId),
    getPricingConfig(),
  ]);
  const byProvider = new Map(connections.map((c) => [c.provider, c]));
  const squareView = await getSquareView(orgId);
  const showSquare = industry.isRestaurant || systems.selected.includes("pos_square") || squareView.state === "connected" || squareView.state === "connected_waiting" || squareView.state === "needs_attention";
  const squareSummary = showSquare && squareView.rowsSynced > 0 ? await getPosSummary(orgId, squareView.locations.map((l) => ({ id: l.id, name: l.name, timezone: squareView.locationTimezones[l.id] }))) : null;
  const sheet = byProvider.get("google_sheets");
  const sheetCfg = sheet?.configJson ? (JSON.parse(sheet.configJson) as { url?: string; template?: string }) : null;
  const sheetStatus: Status = sheet?.status === "CONNECTED" && !sheet.errorMessage ? "CONNECTED" : "NOT_CONNECTED";
  const inboundStatus: Status = inbound?.hasKey ? (inbound.status === "CONNECTED" ? "CONNECTED" : "WAITING") : "NOT_CONNECTED";
  const canImport = can(ctx.effectiveRole, "import");
  const canManage = can(ctx.effectiveRole, "manage_settings");
  const base = (process.env.NEXTAUTH_URL || "https://kaivaryn.onrender.com").replace(/\/$/, "");
  const tz = "America/New_York";
  const SOURCE_LABEL: Record<string, string> = { CSV_UPLOAD: "File import", GOOGLE_SHEETS: "Google Sheets", WEBHOOK: "Inbound API" };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Integrations"
        title="Get your data in"
        description="Three simple ways to bring data into Kaivaryn today, each set up in a few steps. Nothing is marked connected until data has actually arrived. Direct system connectors are set up with you on request."
      />

      {showSquare ? (
        <SquareCard view={squareView} summary={squareSummary} canConnect={canManage} canSync={canImport} showServerDetail={ctx.isSuperAdmin} tz={tz} />
      ) : null}

      {industry.isRestaurant ? <RestaurantSystemsPanel selected={systems.selected} posOther={systems.posOther} connections={connections} setup={setup} readOnly={!canWrite} /> : null}

      <SelectedSystemsGuides selected={systems.selected} connections={connections} setup={setup} readOnly={!canWrite} includeRestaurant={false} />

      <div className="grid gap-5 lg:grid-cols-2">
        <SetupCard
          icon={<FileSpreadsheet className="h-4 w-4" />}
          title="File import — CSV or Excel"
          status={lastFileImport ? "CONNECTED" : "NOT_CONNECTED"}
          detail={lastFileImport ? `Last import ${formatInZone(lastFileImport.createdAt, tz)} · ${lastFileImport.successCount} records from “${lastFileImport.fileName ?? lastFileImport.kind}”.` : "Ready to use. Templates for billing exports, payer remittances, contracts / price lists, AR aging, and timesheets."}
          steps={["Pick a template (billing export, payer remittance, AR aging, …).", "Upload a CSV — or copy cells from Excel and paste them.", "Check the matched columns and the preview, then import."]}
        >
          <Link href="/app/imports" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition hover:bg-amber-400">
            Start an import <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </SetupCard>

        <SetupCard
          id="sheets"
          icon={<Sheet className="h-4 w-4" />}
          title="Google Sheets"
          status={sheetStatus}
          detail={
            sheet
              ? sheet.errorMessage
                ? `Last sync failed: ${sheet.errorMessage}`
                : `${getTemplate(sheetCfg?.template)?.name ?? "Linked sheet"}${sheet.lastSyncAt ? ` · last synced ${formatInZone(sheet.lastSyncAt, tz)}` : ""}. Re-sync anytime — rows already imported are skipped.`
              : "No Google sign-in needed. Works with a sheet that is published to the web as CSV, or shared as “Anyone with the link can view”."
          }
          steps={["In Google Sheets: File → Share → Publish to web → choose the tab → CSV → Publish (or share “Anyone with the link”).", "Paste the link here and choose what the sheet contains.", "Import now. Use Re-sync whenever the sheet changes."]}
        >
          {canImport ? (
            <div className="space-y-3">
              <form action={importSheetAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input name="url" required defaultValue={sheetCfg?.url ?? ""} placeholder="https://docs.google.com/spreadsheets/…" className="h-9 min-w-0 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-xs text-neutral-100" aria-label="Google Sheets link" />
                <select name="template" defaultValue={sheetCfg?.template ?? "billing_export"} className="h-9 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-xs text-neutral-100" aria-label="Sheet contains">
                  {IMPORT_TEMPLATES.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
                </select>
                <button type="submit" className="h-9 rounded-md bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition hover:bg-amber-400 sm:col-span-2 sm:justify-self-start">{sheet ? "Save & import" : "Link & import"}</button>
              </form>
              {sheet ? (
                <div className="flex flex-wrap gap-2">
                  <form action={resyncSheetAction}><button type="submit" className="h-8 rounded-md border border-neutral-700 px-3 text-xs text-neutral-200 hover:border-amber-500/60">Re-sync now</button></form>
                  <form action={disconnectSheetAction}><button type="submit" className="h-8 rounded-md px-3 text-xs text-red-300 hover:bg-neutral-900">Unlink</button></form>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-neutral-500">Linking a sheet needs Manager or above.</p>
          )}
        </SetupCard>

        <SetupCard
          id="inbound"
          icon={<Webhook className="h-4 w-4" />}
          title="Inbound API / webhook"
          status={inboundStatus}
          detail={
            inbound?.hasKey
              ? inbound.status === "CONNECTED"
                ? `Receiving data${inbound.lastSyncAt ? ` · last push ${formatInZone(inbound.lastSyncAt, tz)}` : ""}. Any system or no-code tool that can send an HTTP request can push records.`
                : "Key issued — waiting for the first push."
              : "Push records from any system, script, or no-code tool (Zapier, Make, n8n) with one HTTP request. Uses the same templates as file import."
          }
          steps={["Generate a key for this workspace (shown once — store it in your tool's secrets).", "Send records with the example below. Use any template slug: billing_export, payer_remittance, contract_pricing, ar_aging, timesheets.", "Records appear in Revenue or Operations; re-sent records are skipped, not duplicated."]}
        >
          <InboundKey endpoint={`${base}/api/inbound/records`} hasKey={Boolean(inbound?.hasKey)} hint={inbound?.hint ?? null} canManage={canManage} />
          {inbound?.hasKey && canManage ? (
            <form action={revokeInboundKeyAction} className="mt-2"><button type="submit" className="h-8 rounded-md px-2 text-xs text-red-300 hover:bg-neutral-900">Revoke key</button></form>
          ) : null}
        </SetupCard>

        <SetupCard
          icon={<PenLine className="h-4 w-4" />}
          title="Manual entry"
          status="CONNECTED"
          detail="Built in. Add or edit revenue and operations items directly — useful for one-offs and for recording recovered or realized amounts."
          steps={["Open Revenue Recovery or Operations Efficiency.", "Add an item with its estimate and owner.", "Record recovered / realized amounts as they land."]}
        >
          <div className="flex flex-wrap gap-2">
            <Link href="/app/revenue" className="h-8 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-amber-500/60">Revenue Recovery</Link>
            <Link href="/app/operations" className="h-8 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-amber-500/60">Operations Efficiency</Link>
          </div>
        </SetupCard>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-white">Direct connectors</h2>
        <p className="mt-1 text-xs text-neutral-500">Not connected. We set these up with you during onboarding. Until then, each works today through an export and the matching template.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ON_REQUEST.map((c) => (
            <div key={c.provider} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-neutral-100">{c.title}</p>
                <StatusPill status="ON_REQUEST" />
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">{c.systems}</p>
              <p className="mt-2 text-xs leading-5 text-neutral-400">Today: {c.today}</p>
              <Link href={`/app/imports?template=${c.template}`} className="mt-2 inline-block text-xs text-amber-400 hover:text-amber-300">Use the template →</Link>
            </div>
          ))}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-neutral-100">Email &amp; Slack delivery</p>
              <StatusPill status="SOON" />
            </div>
            <p className="mt-2 text-xs leading-5 text-neutral-400">Automation results and alerts are delivered to your Kaivaryn Inbox today. Email and Slack delivery are not available yet.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-neutral-800 p-5">
          <h2 className="text-sm font-semibold text-white">Recent data arrivals</h2>
          {recent.length ? (
            <ul className="mt-3 divide-y divide-neutral-900 text-xs">
              {recent.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate text-neutral-300">{SOURCE_LABEL[j.source ?? "CSV_UPLOAD"] ?? "File import"} · {j.fileName ?? j.kind}</span>
                  <span className="text-neutral-500">{j.successCount} new{j.skippedCount ? ` · ${j.skippedCount} skipped` : ""}{j.errorCount ? ` · ${j.errorCount} errors` : ""} · {formatInZone(j.createdAt, tz)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-neutral-500">No data has arrived yet.</p>
          )}
          <Link href="/app/imports" className="mt-3 inline-block text-xs text-amber-400 hover:text-amber-300">Full import history →</Link>
        </section>
        <section className="rounded-2xl border border-neutral-800 p-5">
          <h2 className="text-sm font-semibold text-white">Platform</h2>
          <ul className="mt-3 space-y-2 text-xs">
            <li className="flex items-center justify-between gap-2"><span className="text-neutral-300">Stripe Payment Link</span><span className={stripeLinkConfigured(pricing.stripePaymentLink) ? "text-emerald-300" : "text-amber-300"}>{stripeLinkConfigured(pricing.stripePaymentLink) ? "Configured" : "Not configured"}</span></li>
            <li className="flex items-center justify-between gap-2"><span className="text-neutral-300">Outgoing email (password reset)</span><span className={smtpConfigured() ? "text-emerald-300" : "text-amber-300"}>{smtpConfigured() ? "Configured" : "Not configured"}</span></li>
          </ul>
          <p className="mt-3 text-[11px] leading-5 text-neutral-500">Secrets are never shown here. “Not configured” means the feature falls back safely.</p>
        </section>
      </div>
    </div>
  );
}
