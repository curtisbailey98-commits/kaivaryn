import Link from "next/link";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { getProductIntelligenceDashboard } from "@/lib/si/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { startNineReturnCycle, requestMeta81 } from "./actions";
import type { SiProduct } from "@/lib/si/stages";

export const dynamic = "force-dynamic";

function ProductPanel({
  title,
  product,
  data,
}: {
  title: string;
  product: SiProduct;
  data: Awaited<ReturnType<typeof getProductIntelligenceDashboard>>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-amber-100">{title}</h2>
          <p className="text-xs text-neutral-500">
            Nine-return R1–R9 · Witness-only ZERO_STATE_NEXT · {data.protocol}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={startNineReturnCycle}>
            <input type="hidden" name="product" value={product} />
            <input type="hidden" name="methodRole" value="champion" />
            <Button type="submit" size="sm">
              Run champion 9-return
            </Button>
          </form>
          <form action={startNineReturnCycle}>
            <input type="hidden" name="product" value={product} />
            <input type="hidden" name="methodRole" value="challenger" />
            <Button type="submit" size="sm" variant="secondary">
              Run challenger 9-return
            </Button>
          </form>
          <form action={requestMeta81}>
            <input type="hidden" name="product" value={product} />
            <Button type="submit" size="sm" variant="secondary">
              META_RETURN_81
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Cycles succeeded", data.kpis.cycles_succeeded],
          ["Failed", data.kpis.cycles_failed],
          ["Invariants", data.kpis.invariants],
          ["Memories", data.kpis.memories],
          ["Lessons", data.kpis.lessons],
          ["Errors logged", data.kpis.errors],
          ["Learning", `${data.kpis.learning_confidence} · n=${data.kpis.learning_samples}`],
          ["Toward META81", `${data.meta.toward_meta81}/9`],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-xl tabular-nums text-amber-200">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Canonical ZERO_STATE</CardTitle>
            <CardDescription>Only Witness finalizes ZERO_STATE_NEXT</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.kpis.canonical_zero_state ? (
              <>
                <p className="font-mono text-xs text-emerald-300">
                  {data.kpis.canonical_zero_state.hash.slice(0, 24)}…
                </p>
                <p className="text-neutral-400">
                  writtenBy={data.kpis.canonical_zero_state.writtenBy} · id=
                  {data.kpis.canonical_zero_state.id.slice(0, 10)}
                </p>
              </>
            ) : (
              <p className="text-neutral-500">No canonical head yet — run a full 9-return cycle.</p>
            )}
            <p className="text-xs text-neutral-600">
              META progress: windows {data.meta.meta_windows_done}/{data.meta.max_meta_windows} · toward 729
              stages {data.meta.toward_729_stages}/{data.meta.cap_729_stages}
              {data.meta.meta81_ready ? " · ready for META_RETURN_81" : " · need 9 succeeded cycles"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Champion / Challenger</CardTitle>
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
                    <p className="font-medium text-neutral-200">{m.methodKey}</p>
                    <p className="text-[11px] text-neutral-500">
                      {m.role} · {m.status} · n={m.empirical.sampleSize ?? 0} · rate=
                      {m.empirical.successRate == null
                        ? "—"
                        : `${Math.round((m.empirical.successRate as number) * 100)}%`}
                    </p>
                  </div>
                  <Badge tone={m.role === "champion" ? "success" : "warning"}>{m.role}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent cycles</CardTitle>
          <CardDescription>Immutable stage history · idempotent resume</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recent_cycles.length === 0 ? (
            <p className="text-sm text-neutral-500">No cycles yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="py-1 pr-3">ID</th>
                    <th className="py-1 pr-3">Status</th>
                    <th className="py-1 pr-3">R#</th>
                    <th className="py-1 pr-3">Method</th>
                    <th className="py-1 pr-3">Stages</th>
                    <th className="py-1">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_cycles.map((c) => (
                    <tr key={c.id} className="border-t border-neutral-900 text-neutral-300">
                      <td className="py-1.5 pr-3 font-mono">{c.id.slice(0, 8)}</td>
                      <td className="py-1.5 pr-3">{c.status}</td>
                      <td className="py-1.5 pr-3">{c.returnIndex}/9</td>
                      <td className="py-1.5 pr-3">
                        {c.methodRole}:{c.methodKey?.split(".").pop()}
                      </td>
                      <td className="py-1.5 pr-3">
                        {c.stagesDone}/{c.stagesExpected}
                      </td>
                      <td className="py-1.5">
                        {c.completedAt ? new Date(c.completedAt).toLocaleString("en-US", { timeZone: "America/New_York" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data.invariants.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Invariants</CardTitle>
            <CardDescription>CYCLE_INVARIANT / META_INVARIANT</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.invariants.slice(0, 8).map((i) => (
                <li key={i.id} className="rounded-md border border-neutral-800 px-3 py-2">
                  <Badge tone={i.kind === "META_INVARIANT" ? "warning" : "success"}>{i.kind}</Badge>
                  <p className="mt-1 text-neutral-300">{i.statement}</p>
                  <p className="mt-1 font-mono text-[10px] text-neutral-600">{i.contentHash.slice(0, 20)}…</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default async function IntelligencePage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const [rr, oe] = await Promise.all([
    getProductIntelligenceDashboard(ctx.organizationId, "REVENUE_RECOVERY"),
    getProductIntelligenceDashboard(ctx.organizationId, "OPERATIONS_EFFICIENCY"),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="720 SI · Recursive intelligence"
        title="Client Intelligence"
        description="Nine-return cycles grounded in your RR and OE data. Evidence persists; Witness alone writes ZERO_STATE_NEXT; META_RETURN_81 never fakes completion."
      />
      {ctx.organization?.isDemo ? <Badge tone="demo">DEMO tenant</Badge> : null}

      <ProductPanel title="Revenue Recovery" product="REVENUE_RECOVERY" data={rr} />
      <ProductPanel title="Operations Efficiency" product="OPERATIONS_EFFICIENCY" data={oe} />

      <p className="text-xs text-neutral-600">
        Lineage: 720 SI Zero cognition adapted for multi-tenant Kaivaryn (no Redis).{" "}
        <Link href="/app/learning" className="text-amber-400 hover:text-amber-300">
          Outcome learning
        </Link>{" "}
        ·{" "}
        <Link href="/app/revenue/analytics" className="text-amber-400 hover:text-amber-300">
          RR analytics
        </Link>{" "}
        ·{" "}
        <Link href="/app/operations/analytics" className="text-amber-400 hover:text-amber-300">
          OE analytics
        </Link>
      </p>
    </div>
  );
}
