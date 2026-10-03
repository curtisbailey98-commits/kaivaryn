import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { getProductIntelligenceDashboard } from "@/lib/si/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, ExampleDataTag } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { startNineReturnCycle, requestMeta81 } from "./actions";
import type { SiProduct } from "@/lib/si/stages";
import { humanizeLabel } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { MONEY } from "@/lib/money-glossary";

export const metadata = { title: "Intelligence" };

export const dynamic = "force-dynamic";

function ProductPanel({
  title,
  product,
  data,
  ledger,
}: {
  title: string;
  product: SiProduct;
  data: Awaited<ReturnType<typeof getProductIntelligenceDashboard>>;
  ledger: { primary: number; secondary: number; primaryLabel: string; secondaryLabel: string };
}) {
  const improved =
    data.kpis.cycles_succeeded > 0
      ? `${data.kpis.cycles_succeeded} improvement cycle${data.kpis.cycles_succeeded === 1 ? "" : "s"} completed`
      : "No improvement cycles completed yet";
  const next =
    data.meta.meta81_ready
      ? "Ready for a multi-cycle review"
      : data.kpis.cycles_succeeded === 0
      ? "Run a first improvement cycle when you have open work"
      : `${Math.max(0, 9 - data.meta.toward_meta81)} more successful cycles before multi-cycle review`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-amber-100">{title}</h2>
          <p className="text-xs text-neutral-500">Business outcomes grounded in your live {title} ledger</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{ledger.primaryLabel}</CardDescription>
            <CardTitle className="text-xl tabular-nums text-emerald-300">{formatCurrency(ledger.primary)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{ledger.secondaryLabel}</CardDescription>
            <CardTitle className="text-xl tabular-nums text-amber-200">{formatCurrency(ledger.secondary)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>What improved</CardDescription>
            <CardTitle className="text-base leading-snug text-neutral-100">{improved}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>What&apos;s next</CardDescription>
            <CardTitle className="text-base leading-snug text-neutral-100">{next}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Cycles completed", data.kpis.cycles_succeeded],
          ["Needs attention", data.kpis.cycles_failed],
          ["Lessons captured", data.kpis.lessons],
          ["Learning confidence", `${humanizeLabel(String(data.kpis.learning_confidence))} · ${data.kpis.learning_samples} samples`],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-xl tabular-nums text-amber-200">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {data.recent_cycles.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent improvement cycles</CardTitle>
            <CardDescription>Recorded analysis runs against your workspace data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="py-1 pr-3">Status</th>
                    <th className="py-1 pr-3">Progress</th>
                    <th className="py-1 pr-3">Method</th>
                    <th className="py-1">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_cycles.map((c) => (
                    <tr key={c.id} className="border-t border-neutral-900 text-neutral-300">
                      <td className="py-1.5 pr-3">{humanizeLabel(c.status)}</td>
                      <td className="py-1.5 pr-3">{c.returnIndex}/9</td>
                      <td className="py-1.5 pr-3">{c.methodRole === "champion" ? "Primary" : c.methodRole === "challenger" ? "Challenger" : humanizeLabel(c.methodRole)}</td>
                      <td className="py-1.5">
                        {c.completedAt
                          ? new Date(c.completedAt).toLocaleString("en-US", { timeZone: "America/New_York" })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <details className="rounded-xl border border-neutral-800 bg-neutral-950/60">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-neutral-300 hover:text-white">
          Advanced · analysis controls
        </summary>
        <div className="space-y-4 border-t border-neutral-900 px-4 py-4">
          <p className="text-xs text-neutral-500">
            Re-run or compare analysis cycles. Safe for analysts; outcomes still require recorded evidence.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={startNineReturnCycle}>
              <input type="hidden" name="product" value={product} />
              <input type="hidden" name="methodRole" value="champion" />
              <Button type="submit" size="sm">Run primary cycle</Button>
            </form>
            <form action={startNineReturnCycle}>
              <input type="hidden" name="product" value={product} />
              <input type="hidden" name="methodRole" value="challenger" />
              <Button type="submit" size="sm" variant="secondary">Run challenger cycle</Button>
            </form>
            <form action={requestMeta81}>
              <input type="hidden" name="product" value={product} />
              <Button type="submit" size="sm" variant="secondary">Request multi-cycle review</Button>
            </form>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Canonical state</CardTitle>
                <CardDescription>Finalized only after a complete witnessed cycle</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.kpis.canonical_zero_state ? (
                  <p className="text-neutral-400">
                    State recorded · {data.kpis.canonical_zero_state.writtenBy}
                  </p>
                ) : (
                  <p className="text-neutral-500">No finalized state yet — complete a full cycle first.</p>
                )}
                <p className="text-xs text-neutral-600">
                  Multi-cycle progress: {data.meta.toward_meta81}/9 successful cycles
                  {data.meta.meta81_ready ? " · ready for review" : ""}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Primary / challenger methods</CardTitle>
                <CardDescription>Promotion requires measured superiority (n≥5)</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.methods.map((m) => (
                    <li
                      key={`${m.methodKey}-${m.version}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-neutral-800 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-neutral-200">{m.methodKey.split(".").pop()}</p>
                        <p className="text-[11px] text-neutral-500">
                          {humanizeLabel(m.role)} · {humanizeLabel(m.status)} · n={m.empirical.sampleSize ?? 0}
                        </p>
                      </div>
                      <Badge tone={m.role === "champion" ? "success" : "warning"}>{humanizeLabel(m.role)}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </details>
    </div>
  );
}

export default async function IntelligencePage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const [rr, oe, rrAgg, oeAgg] = await Promise.all([
    getProductIntelligenceDashboard(ctx.organizationId, "REVENUE_RECOVERY"),
    getProductIntelligenceDashboard(ctx.organizationId, "OPERATIONS_EFFICIENCY"),
    prisma.opportunity.aggregate({
      where: { organizationId: ctx.organizationId },
      _sum: { recoveredAmount: true, verifiedAmount: true, potentialAmount: true },
    }),
    prisma.inefficiency.aggregate({
      where: { organizationId: ctx.organizationId },
      _sum: { realizedSavings: true, projectedSavings: true },
    }),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Intelligence"
        title="Client Intelligence"
        description="What improved in your workspace, what the ledger shows, and what to do next — without inventing results."
      />
      {ctx.organization?.isDemo ? <ExampleDataTag label="Example workspace" /> : null}

      <ProductPanel
        title="Revenue Recovery"
        product="REVENUE_RECOVERY"
        data={rr}
        ledger={{
          primary: rrAgg._sum.recoveredAmount ?? 0,
          secondary: rrAgg._sum.potentialAmount ?? 0,
          primaryLabel: MONEY.cashRecovered.label,
          secondaryLabel: MONEY.pipelinePotential.label,
        }}
      />
      <ProductPanel
        title="Operations Efficiency"
        product="OPERATIONS_EFFICIENCY"
        data={oe}
        ledger={{
          primary: oeAgg._sum.realizedSavings ?? 0,
          secondary: oeAgg._sum.projectedSavings ?? 0,
          primaryLabel: MONEY.realizedSavings.label,
          secondaryLabel: MONEY.projectedSavings.label,
        }}
      />

      <p className="text-xs text-neutral-600">
        Ledger figures match Revenue Recovery and Operations Efficiency.{" "}
        <Link href="/app/learning" className="text-amber-400 hover:text-amber-300">
          Learning outcomes
        </Link>{" "}
        ·{" "}
        <Link href="/app/revenue" className="text-amber-400 hover:text-amber-300">
          RR
        </Link>{" "}
        ·{" "}
        <Link href="/app/operations" className="text-amber-400 hover:text-amber-300">
          OE
        </Link>
      </p>
    </div>
  );
}
