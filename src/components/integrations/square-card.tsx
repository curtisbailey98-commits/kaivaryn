import { CreditCard } from "lucide-react";
import type { SquareView } from "@/lib/integrations/square/connection";
import type { PosSummary } from "@/lib/integrations/square/summary";
import { squareDisabledReasonText } from "@/lib/integrations/square/config";
import { formatInZone } from "@/lib/operate";
import { ConnectSquareButton } from "./connect-square-button";
import { syncSquareNowAction, disconnectSquareAction } from "@/app/app/integrations/actions";

const PILL: Record<SquareView["state"], { label: string; cls: string; dot: string }> = {
  not_enabled: { label: "Not switched on yet", cls: "border-neutral-800 bg-neutral-950 text-neutral-400", dot: "bg-neutral-600" },
  not_connected: { label: "Not connected", cls: "border-neutral-700 bg-neutral-900 text-neutral-300", dot: "bg-neutral-500" },
  connected_waiting: { label: "Connected to Square · waiting for data", cls: "border-amber-800 bg-amber-950/50 text-amber-300", dot: "bg-amber-400" },
  connected: { label: "Connected", cls: "border-emerald-800 bg-emerald-950/60 text-emerald-300", dot: "bg-emerald-400" },
  needs_attention: { label: "Needs attention", cls: "border-red-900 bg-red-950/50 text-red-300", dot: "bg-red-400" },
};

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const TENDER: Record<string, string> = { CARD: "Card", CASH: "Cash", WALLET: "Digital wallet", SQUARE_GIFT_CARD: "Square gift card", BANK_ACCOUNT: "Bank account", EXTERNAL: "Other (external)", BUY_NOW_PAY_LATER: "Buy now, pay later", OTHER: "Other" };

export function SquareCard({ view, summary, canConnect, canSync, showServerDetail, tz }: {
  view: SquareView;
  summary: PosSummary | null;
  canConnect: boolean;
  canSync: boolean;
  showServerDetail: boolean;
  tz: string;
}) {
  const pill = PILL[view.state];
  const linked = view.state === "connected" || view.state === "connected_waiting" || view.state === "needs_attention";
  return (
    <section id="square" data-testid="square-card" data-state={view.state} className="rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/60 to-neutral-950 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400"><CreditCard className="h-4 w-4" /></span>
          <div>
            <h2 className="text-[15px] font-semibold text-white">Square POS</h2>
            <p className="text-[11px] text-neutral-500">Read-only: orders, payments, refunds, locations. Kaivaryn never writes to Square.</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${pill.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
          {pill.label}
        </span>
      </div>

      {view.state === "not_enabled" ? (
        <div className="mt-3 space-y-2 text-xs leading-5 text-neutral-400">
          <p>Square connection isn&apos;t switched on yet for Kaivaryn, so nothing is connected. For now, export your reports from the Square Dashboard and bring them in through Imports.</p>
          {showServerDetail && view.disabledReason ? <p className="text-[11px] text-neutral-500">Platform setup: {squareDisabledReasonText(view.disabledReason as Parameters<typeof squareDisabledReasonText>[0])}</p> : null}
        </div>
      ) : null}

      {view.state === "not_connected" ? (
        <div className="mt-3 space-y-3 text-xs leading-5 text-neutral-400">
          <p>Connect your Square account to bring in the last 90 days of orders, payments, and refunds for every location, then keep them up to date about every 15 minutes. You approve read-only access on Square&apos;s own page.</p>
          {canConnect ? <ConnectSquareButton /> : <p className="text-neutral-500">Connecting Square needs an Owner or Admin.</p>}
        </div>
      ) : null}

      {linked ? (
        <div className="mt-3 space-y-3 text-xs leading-5 text-neutral-400">
          {view.state === "needs_attention" ? (
            <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-red-200">
              <p>{view.errorMessage || "Square no longer accepts Kaivaryn's access (expired or revoked)."} Syncing is paused until Square is reconnected. Data already synced stays.</p>
              <div className="mt-2">{canConnect ? <ConnectSquareButton label="Reconnect Square" /> : <span className="text-red-300/80">An Owner or Admin needs to reconnect Square.</span>}</div>
            </div>
          ) : null}
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <div><dt className="inline text-neutral-500">Merchant: </dt><dd className="inline text-neutral-200">{view.merchantName || view.merchantId || "—"}{view.env === "sandbox" ? " (Square Sandbox — test data)" : ""}</dd></div>
            <div><dt className="inline text-neutral-500">Locations: </dt><dd className="inline text-neutral-200">{view.locations.length ? view.locations.map((l) => l.name).join(", ") : "none returned"}</dd></div>
            <div><dt className="inline text-neutral-500">Last synced: </dt><dd className="inline text-neutral-200">{view.lastSyncAt ? formatInZone(view.lastSyncAt, tz) : "not yet"}</dd></div>
            <div><dt className="inline text-neutral-500">Records synced: </dt><dd className="inline text-neutral-200" data-testid="square-rows">{view.rowsSynced.toLocaleString("en-US")}</dd></div>
          </dl>
          {view.state !== "needs_attention" && view.errorMessage ? <p className="text-amber-300">{view.errorMessage}</p> : null}
          {view.lastSync && !view.lastSync.complete && view.lastSync.ok ? <p className="text-neutral-500">Still catching up on history — more arrives with each sync.</p> : null}
          {view.state === "connected_waiting" ? <p className="text-neutral-500">Square access is set up. No orders, payments, or refunds have arrived yet{view.lastSyncAt ? " — Square returned none for the last 90 days" : ""}.</p> : null}

          {summary && view.rowsSynced > 0 ? <PosNumbers summary={summary} /> : null}

          <div className="flex flex-wrap gap-2 border-t border-neutral-900 pt-3">
            {canSync && view.state !== "needs_attention" ? <form action={syncSquareNowAction}><button type="submit" className="h-8 rounded-md border border-neutral-700 px-3 text-xs text-neutral-200 hover:border-amber-500/60">Sync now</button></form> : null}
            {canConnect ? <form action={disconnectSquareAction}><button type="submit" className="h-8 rounded-md px-3 text-xs text-red-300 hover:bg-neutral-900">Disconnect Square</button></form> : null}
            {!canSync ? <span className="self-center text-[11px] text-neutral-500">Sync now needs Manager or above.</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PosNumbers({ summary }: { summary: PosSummary }) {
  const t = summary.totals;
  const days = summary.byDay.slice(0, 14);
  return (
    <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3" data-testid="square-numbers">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">From your Square data · last {summary.days} days</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Net sales (completed orders)" value={money(t.netSales)} sub={`${t.orders.toLocaleString("en-US")} orders`} />
        <Stat label="Discounts" value={money(t.discounts)} />
        <Stat label="Comps" value={money(t.comps)} />
        <Stat label="Refunds" value={money(t.refunds)} sub={`${t.refundCount} ${t.refundCount === 1 ? "refund" : "refunds"}`} />
        <Stat label="Voided orders" value={t.voids.toLocaleString("en-US")} />
        <Stat label="Gross sales" value={money(t.grossSales)} />
      </div>
      {summary.tenders.length ? (
        <div>
          <p className="text-[11px] text-neutral-500">Payments by tender</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {summary.tenders.map((x) => <li key={x.tender} className="rounded-md border border-neutral-800 px-2 py-1 text-neutral-300">{TENDER[x.tender] ?? x.tender}: {money(x.amount)} · {x.count} {x.count === 1 ? "payment" : "payments"}</li>)}
          </ul>
        </div>
      ) : null}
      {days.length ? (
        <div>
          <p className="text-[11px] text-neutral-500">Daily sales by location (most recent first)</p>
          <table className="mt-1 w-full text-left text-[11px]">
            <thead className="text-neutral-500"><tr><th className="py-1 font-normal">Day</th><th className="py-1 font-normal">Location</th><th className="py-1 text-right font-normal">Orders</th><th className="py-1 text-right font-normal">Net sales</th></tr></thead>
            <tbody className="divide-y divide-neutral-900 text-neutral-300">
              {days.map((d) => <tr key={`${d.day}-${d.locationId}`}><td className="py-1">{d.day}</td><td className="py-1">{d.locationName}</td><td className="py-1 text-right">{d.orders}</td><td className="py-1 text-right">{money(d.netSales)}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="text-[11px] text-neutral-500">These are Square&apos;s own numbers. Anything Kaivaryn flags from them shows up as an estimate in Revenue Recovery — never as money recovered.</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-900 p-2">
      <p className="text-[10px] text-neutral-500">{label}</p>
      <p className="text-sm font-semibold text-neutral-100">{value}</p>
      {sub ? <p className="text-[10px] text-neutral-500">{sub}</p> : null}
    </div>
  );
}
