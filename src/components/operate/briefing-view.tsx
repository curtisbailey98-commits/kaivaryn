import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { safeJson, type DigestBody, type RecallBody } from "@/lib/operate";
import { PriorityBadge } from "@/components/ui/badge";

function humanProduct(p: string) {
  return p === "REVENUE_RECOVERY" ? "Revenue Recovery" : p === "OPERATIONS_EFFICIENCY" ? "Operations Efficiency" : p;
}

export function BriefingView({ kind, bodyJson }: { kind: string; bodyJson: string }) {
  if (kind === "RECALL") {
    const b = safeJson<RecallBody | null>(bodyJson, null);
    if (!b) return <p className="text-sm text-neutral-500">Briefing body unavailable.</p>;
    return (
      <div className="space-y-5">
        {b.empty ? <p className="rounded-lg border border-dashed border-neutral-800 p-4 text-sm text-neutral-400">Nothing recorded yet. Run an analysis to create the first continuity state.</p> : null}
        {b.continuity.length ? (
          <section>
            <p className="si-label">Continuity (Witness-signed ZERO_STATE)</p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {b.continuity.map((c) => (
                <div key={c.product + c.hash} className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-4">
                  <p className="text-xs font-semibold text-amber-300">{humanProduct(c.product)} · v{c.version}</p>
                  <p className="mt-2 text-sm text-neutral-300">{c.summary || "—"}</p>
                  {c.witness ? <p className="mt-2 text-xs text-neutral-400">Witness: {c.witness}</p> : null}
                  {c.hints.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-neutral-500">{c.hints.map((h) => <li key={h}>{h}</li>)}</ul> : null}
                  <p className="mt-2 font-mono text-[10px] text-neutral-600">hash {c.hash}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {b.lessons.length ? (
          <section>
            <p className="si-label">Lessons</p>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-300">{b.lessons.map((l, i) => <li key={i}><span className="text-[10px] uppercase text-neutral-500">{humanProduct(l.product)}</span> · {l.lesson}</li>)}</ul>
          </section>
        ) : null}
        {b.memory.length ? (
          <section>
            <p className="si-label">Memory</p>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-300">{b.memory.map((m, i) => <li key={i}><span className="text-[10px] uppercase text-neutral-500">{m.kind}</span> · {m.summary}</li>)}</ul>
          </section>
        ) : null}
        <p className="text-[11px] text-neutral-600">{b.notes.join(" ")}</p>
      </div>
    );
  }
  const d = safeJson<DigestBody | null>(bodyJson, null);
  if (!d) return <p className="text-sm text-neutral-500">Briefing body unavailable.</p>;
  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {d.money.map((m) => (
          <div key={m.label} className={`rounded-lg border p-3 ${m.nature === "RECORDED" ? "border-emerald-800/60 bg-emerald-950/20" : "border-neutral-800 bg-neutral-950/60"}`}>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">{m.label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(m.value)}</p>
            <p className={`text-[10px] ${m.nature === "RECORDED" ? "text-emerald-400" : "text-neutral-500"}`}>{m.nature === "RECORDED" ? "Recorded outcome" : "Estimate"}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Pending approvals", d.work.pendingApprovals],
          ["Open tasks", d.work.openTasks],
          ["Unassigned items", d.work.unassigned],
          ["Critical items", d.work.critical],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-lg border border-neutral-800 p-3">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">{k}</p>
            <p className="mt-1 text-xl font-semibold text-white">{v}</p>
          </div>
        ))}
      </div>
      <section>
        <p className="si-label">Since {d.since ? "previous digest" : "last 7 days"}</p>
        <p className="mt-1 text-sm text-neutral-300">
          {d.changes.newOpportunities} new revenue items · {d.changes.newInefficiencies} new operations items · {d.changes.approvalsDecided} approvals decided · {d.changes.cyclesCompleted} intelligence cycles completed
        </p>
      </section>
      {d.priorities.length ? (
        <section>
          <p className="si-label">Top priorities</p>
          <ul className="mt-2 divide-y divide-neutral-900 rounded-lg border border-neutral-800">
            {d.priorities.map((p) => (
              <li key={p.href} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <Link href={p.href} className="min-w-0 flex-1 truncate text-neutral-200 hover:text-amber-300">
                  <span className="mr-2 text-[10px] uppercase text-neutral-500">{p.kind}</span>
                  {p.title}
                </Link>
                <span className="flex items-center gap-2">
                  <PriorityBadge priority={p.priority} />
                  <span className="text-xs text-neutral-400">{formatCurrency(p.estimate)} est.</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="grid gap-3 md:grid-cols-2">
        {d.intelligence.map((i) => (
          <div key={i.product} className="rounded-lg border border-neutral-800 p-3 text-sm">
            <p className="text-xs font-semibold text-amber-300">{i.product}</p>
            <p className="mt-1 text-neutral-400">{i.lastCycle ? `Last cycle ${i.status} · ${i.lastCycle.slice(0, 10)}` : "No cycle yet"}</p>
            {i.witness ? <p className="mt-1 text-xs text-neutral-500">Witness: {i.witness}</p> : null}
          </div>
        ))}
      </section>
      <p className="text-[11px] text-neutral-500">
        Operate: {d.operate.lastHealth ?? "no health check yet"} · {d.operate.standingActive} standing orders active · {d.operate.failedRuns24h} failed runs (24h) · {d.operate.waitingApproval} runs waiting on approval
      </p>
      <p className="text-[11px] text-neutral-600">{d.notes.join(" ")}</p>
    </div>
  );
}
