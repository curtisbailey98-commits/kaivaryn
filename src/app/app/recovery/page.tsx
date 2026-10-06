import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { formatCurrency, formatDate } from "@/lib/utils";
import { humanizeLabel } from "@/lib/labels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, ExampleDataTag } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { DynBarChart } from "@/components/charts/dynamic";
import { CHART } from "@/components/charts/theme";
import { ArrowRight, Download, Lock, Settings2, TrendingUp, Upload, Plug } from "lucide-react";
import {
  getRecoveryTracker,
  describeRecovery,
  canConfirmRealized,
  type CategoryTotals,
  type RecoveryLedgerItem,
} from "@/lib/recovery/tracker";

export const metadata = { title: "Money recovered" };
export const dynamic = "force-dynamic";

function amountSuffix(unit: "cash" | "per_year") {
  return unit === "per_year" ? " / yr" : "";
}

function CategoryCard({ t }: { t: CategoryTotals }) {
  const Icon = t.category === "REVENUE_RECOVERY" ? TrendingUp : Settings2;
  const sfx = amountSuffix(t.unit);
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4 sm:p-5" data-testid={`recovery-${t.category}`}>
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        <Icon className="h-4 w-4 text-amber-400" /> {t.label}
        <span className="ml-auto text-[11px] font-normal text-neutral-500">{t.itemCount} item{t.itemCount === 1 ? "" : "s"}</span>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Found</p>
          <p className="mt-1 text-xl font-semibold text-white sm:text-2xl">{formatCurrency(t.found)}<span className="text-sm font-normal text-neutral-500">{sfx}</span></p>
          <p className="mt-0.5 text-[10px] text-neutral-600">Estimate · not money in the bank</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">Won back</p>
          <p className="mt-1 text-xl font-semibold text-emerald-400 sm:text-2xl">{formatCurrency(t.wonBack)}<span className="text-sm font-normal text-neutral-500">{sfx}</span></p>
          <p className="mt-0.5 text-[10px] text-neutral-600">
            Recorded by your team · {t.wonBackCount} item{t.wonBackCount === 1 ? "" : "s"}
            {t.verified > 0 ? <> · {formatCurrency(t.verified)} verified</> : null}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Still being worked on</p>
          <p className="mt-1 text-base font-semibold text-neutral-200">{formatCurrency(t.inProgress)}<span className="text-xs font-normal text-neutral-500">{sfx}</span></p>
          <p className="mt-0.5 text-[10px] text-neutral-600">Estimate · {t.inProgressCount} item{t.inProgressCount === 1 ? "" : "s"} · {t.openCount} not started yet</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Found → won back</p>
          <p className="mt-1 text-base font-semibold text-neutral-200">{t.found > 0 ? `${t.conversionRate}%` : "—"}</p>
          <p className="mt-0.5 text-[10px] text-neutral-600">Won back ÷ found, by dollars</p>
        </div>
      </div>
    </div>
  );
}

function BreakdownTable({ t, by }: { t: CategoryTotals; by: "type" | "source" }) {
  const rows = by === "type" ? t.byType : t.bySource;
  const sfx = amountSuffix(t.unit);
  if (!rows.length) return null;
  return (
    <Table>
      <THead>
        <tr>
          <TH>{by === "type" ? "Kind of issue" : "Where it was found"}</TH>
          <TH className="text-right">Items</TH>
          <TH className="text-right">Found (est.)</TH>
          <TH className="text-right">Won back</TH>
        </tr>
      </THead>
      <TBody>
        {rows.map((r) => (
          <TR key={r.key}>
            <TD>{r.label}</TD>
            <TD className="text-right text-neutral-400">{r.count}</TD>
            <TD className="text-right text-neutral-300">{formatCurrency(r.found)}{sfx}</TD>
            <TD className="text-right font-medium text-emerald-400">{formatCurrency(r.wonBack)}{sfx}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

function WonBackRow({ i }: { i: RecoveryLedgerItem }) {
  const c = i.confirmation;
  return (
    <li className="grid gap-x-4 gap-y-1 px-4 py-3 lg:grid-cols-[minmax(0,1.6fr)_8rem_minmax(0,1.6fr)] lg:items-start">
      <div className="min-w-0">
        <Link href={i.href} className="text-sm font-medium text-white hover:text-amber-300">{i.title}</Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          {i.category === "REVENUE_RECOVERY" ? "Revenue" : "Operations"} · {i.typeLabel}
          {i.stillInProgress ? <Badge tone="info">Partly won back</Badge> : null}
          {i.isVerified ? <Badge tone="success">Verified</Badge> : <Badge>Recorded, not yet verified</Badge>}
        </p>
      </div>
      <div className="lg:text-right">
        <p className="text-sm font-semibold text-emerald-400">{formatCurrency(i.realizedAmount)}<span className="text-[10px] font-normal text-neutral-500">{amountSuffix(i.unit)}</span></p>
        <p className="text-[10px] text-neutral-600">of {formatCurrency(i.foundAmount)} estimated</p>
      </div>
      <div className="text-xs leading-5 text-neutral-400">
        <p>
          <span className="text-neutral-600">Won back on </span>{i.realizedAt ? formatDate(i.realizedAt) : <span className="text-amber-400/80">date not recorded</span>}
          {c ? (
            <>
              <span className="text-neutral-600"> · recorded by </span>
              {c.byName ?? "a former team member"}{c.byRole ? ` (${humanizeLabel(c.byRole)})` : ""}
              <span className="text-neutral-600"> on </span>{formatDate(c.at)}
            </>
          ) : (
            <span className="text-amber-400/80"> · no record of who entered this amount</span>
          )}
        </p>
        {c?.note ? <p className="text-neutral-500">“{c.note}”</p> : null}
        <p className="text-neutral-600">
          Found by: {i.sourceLabel} · {i.findingIds.length} finding{i.findingIds.length === 1 ? "" : "s"} · {i.evidenceCount} evidence item{i.evidenceCount === 1 ? "" : "s"}
          {i.initiatives.length ? <> · Initiative: {i.initiatives.join(", ")}</> : null}
        </p>
      </div>
    </li>
  );
}

function OpenRow({ i, canConfirm }: { i: RecoveryLedgerItem; canConfirm: boolean }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3 lg:grid-cols-[minmax(0,1.6fr)_8rem_10rem_9rem] lg:items-center">
      <div className="min-w-0">
        <Link href={i.href} className="text-sm font-medium text-white hover:text-amber-300 lg:truncate">{i.title}</Link>
        <p className="mt-0.5 text-xs text-neutral-500">{i.category === "REVENUE_RECOVERY" ? "Revenue" : "Operations"} · {i.typeLabel} · {i.sourceLabel}</p>
      </div>
      <p className="text-right text-sm font-semibold text-neutral-200">{formatCurrency(i.foundAmount)}<span className="text-[10px] font-normal text-neutral-500">{amountSuffix(i.unit)} est.</span></p>
      <p className="col-span-2 text-xs text-neutral-400 lg:col-span-1">{i.stageLabel} · {humanizeLabel(i.status)}</p>
      <div className="col-span-2 lg:col-span-1 lg:text-right">
        {canConfirm && i.stage !== "DISMISSED" ? (
          <Link href={`${i.href}#record`} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300">
            Record amount won back <ArrowRight className="h-3 w-3" />
          </Link>
        ) : (
          <Link href={i.href} className="text-xs text-neutral-500 hover:text-neutral-300">View evidence</Link>
        )}
      </div>
    </li>
  );
}

export default async function RecoveryPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const tracker = await getRecoveryTracker(ctx.organizationId);
  const copy = describeRecovery(tracker);
  const isDemo = Boolean(ctx.organization?.isDemo);
  const canConfirm = canConfirmRealized(ctx.effectiveRole);
  const canExport = can(ctx.effectiveRole, "export");
  const categories = [tracker.revenue, tracker.operations].filter((t) => t.itemCount > 0);
  const won = tracker.items.filter((i) => i.stage === "WON_BACK");
  const toWin = tracker.items.filter((i) => i.stage === "IN_PROGRESS" || i.stage === "OPEN");
  const closed = tracker.items.filter((i) => i.stage === "DISMISSED" || i.stage === "CLOSED_NO_AMOUNT");
  const hasOps = tracker.operations.itemCount > 0;

  return (
    <div className="space-y-5 pb-16 sm:space-y-6">
      <PageHeader
        eyebrow="Proof of value"
        title="Money recovered"
        description="What Kaivaryn found in your data, and what your team has actually won back — kept separate, item by item, so you can check every dollar."
        actions={
          <>
            {isDemo ? <ExampleDataTag label="Example workspace" /> : null}
            {canExport && tracker.hasData ? (
              <a href="/api/recovery/export" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-700 px-3 text-xs font-medium text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-900">
                <Download className="h-3.5 w-3.5" /> Download ledger (CSV)
              </a>
            ) : null}
          </>
        }
      />

      {isDemo ? (
        <p className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-xs text-neutral-400" data-testid="recovery-demo-note">
          <span className="font-semibold text-neutral-200">Example data.</span> This is a demo company with sample records, not a client and not real results.
        </p>
      ) : null}

      {copy.empty ? (
        <section className="rounded-2xl border border-dashed border-neutral-800 px-6 py-12 text-center" data-testid="recovery-empty">
          <p className="text-base font-medium text-neutral-100">{copy.headline}</p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-neutral-400">{copy.detail}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/app/imports" className="inline-flex h-10 items-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-medium text-neutral-950 hover:bg-amber-400"><Upload className="h-4 w-4" /> Import a file</Link>
            <Link href="/app/integrations" className="inline-flex h-10 items-center gap-2 rounded-md border border-neutral-700 px-4 text-sm font-medium text-neutral-100 hover:bg-neutral-900"><Plug className="h-4 w-4" /> Connect a system</Link>
          </div>
        </section>
      ) : (
        <>
          <section aria-labelledby="recovery-summary" className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] via-neutral-950 to-neutral-950 p-4 sm:p-6">
            <h2 id="recovery-summary" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">In plain terms</h2>
            <p className="mt-3 max-w-4xl text-base leading-7 text-neutral-200 sm:text-lg sm:leading-8">{copy.headline}</p>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-400">{copy.detail}</p>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {categories.map((t) => <CategoryCard key={t.category} t={t} />)}
            </div>
            <p className="mt-3 text-[11px] text-neutral-500">
              Revenue won back is one-time cash. Operations savings are a yearly run-rate. They are different kinds of money, so we never add them together.
              Every total on this page is the sum of the items listed below.
            </p>
          </section>

          <section aria-label="Won back by month" className="space-y-2">
            <DynBarChart
              title="Won back, by month"
              description="Amounts your team recorded, by the month they were won back."
              badge={{ label: "Recorded", tone: "realized" }}
              data={tracker.timeline.map((p) => ({ label: p.label, cashRecovered: p.cashRecovered, realizedSavings: p.realizedSavings }))}
              series={[
                { key: "cashRecovered", label: "Revenue cash recovered", color: CHART.emerald },
                ...(hasOps ? [{ key: "realizedSavings", label: "Savings realized (per year)", color: CHART.silver }] : []),
              ]}
              money
              height={240}
              footnote={
                tracker.undated.count > 0
                  ? `${tracker.undated.count} won-back item${tracker.undated.count === 1 ? " has" : "s have"} no recorded date and ${tracker.undated.count === 1 ? "is" : "are"} not on this chart (${formatCurrency(tracker.undated.cashRecovered)} cash, ${formatCurrency(tracker.undated.realizedSavings)}/yr savings). They are still counted in the totals and listed below.`
                  : "Recorded amounts only. Estimates are never shown on this chart."
              }
            />
          </section>

          <section aria-labelledby="ledger-won" className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="ledger-won" className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Won back — every recorded dollar ({won.length})</h2>
              <p className="text-[11px] text-neutral-600">Who recorded it, when, and what it came from.</p>
            </div>
            {won.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-800 px-6 py-8 text-center text-sm text-neutral-400">
                Nothing has been recorded as won back yet. Estimates below are not counted here.
              </div>
            ) : (
              <Card className="overflow-hidden p-0">
                <ul className="divide-y divide-neutral-900">
                  {won.map((i) => <WonBackRow key={i.id} i={i} />)}
                </ul>
              </Card>
            )}
          </section>

          <section aria-labelledby="ledger-open" className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="ledger-open" className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Found, not yet won back ({toWin.length})</h2>
              <p className="flex items-center gap-1 text-[11px] text-neutral-600">
                {canConfirm ? (
                  "Record an amount only once the money is actually collected or the saving is in place."
                ) : (
                  <><Lock className="h-3 w-3" /> Read-only. A manager, admin or owner records amounts won back.</>
                )}
              </p>
            </div>
            {toWin.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-800 px-6 py-8 text-center text-sm text-neutral-400">No open items right now.</div>
            ) : (
              <Card className="overflow-hidden p-0">
                <ul className="divide-y divide-neutral-900">
                  {toWin.map((i) => <OpenRow key={i.id} i={i} canConfirm={canConfirm} />)}
                </ul>
              </Card>
            )}
            {closed.length ? (
              <details className="rounded-xl border border-neutral-800 bg-neutral-950/50 [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer list-none px-4 py-3 text-xs text-neutral-400 hover:text-neutral-200">
                  {closed.length} closed or ruled-out item{closed.length === 1 ? "" : "s"} (counted in “found”, nothing won back) — show
                </summary>
                <ul className="divide-y divide-neutral-900 border-t border-neutral-900">
                  {closed.map((i) => <OpenRow key={i.id} i={i} canConfirm={canConfirm} />)}
                </ul>
              </details>
            ) : null}
          </section>

          <section aria-labelledby="breakdown" className="space-y-2">
            <h2 id="breakdown" className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Where the money is</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {categories.map((t) => (
                <Card key={t.category}>
                  <CardHeader>
                    <CardTitle>{t.label}</CardTitle>
                    <CardDescription>By kind of issue and by where it was found. “Found” is an estimate.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <BreakdownTable t={t} by="type" />
                    <BreakdownTable t={t} by="source" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <p className="text-[10px] leading-5 text-neutral-600">
            How these numbers work: “Found” is Kaivaryn&apos;s estimate from your records and is never counted as won back. “Won back” only includes amounts a manager, admin or owner
            recorded on an item; amounts above your approval limits go through Approvals first. Kaivaryn&apos;s analysis never marks money as won back on its own.
          </p>
        </>
      )}
    </div>
  );
}
