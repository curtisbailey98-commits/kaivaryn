import Link from "next/link";
import { CheckCircle2, CircleDashed, PauseCircle, XCircle } from "lucide-react";
import { describeStep, normalizeSteps, safeJson, type StepEvidence } from "@/lib/operate";

export function RunEvidence({ stepsJson, evidenceJson, status }: { stepsJson: string; evidenceJson: string; status: string }) {
  const steps = normalizeSteps(safeJson(stepsJson, []));
  const evidence = safeJson<StepEvidence[]>(evidenceJson, []);
  return (
    <ol className="relative space-y-3 border-l border-neutral-800 pl-5">
      {steps.map((s, i) => {
        const ev = evidence.filter((e) => e.index === i).at(-1);
        const waiting = !ev && status === "WAITING_APPROVAL" && i === evidence.length;
        const Icon = ev ? (ev.ok ? (s.kind === "APPROVAL" ? PauseCircle : CheckCircle2) : XCircle) : waiting ? PauseCircle : CircleDashed;
        const tone = ev ? (ev.ok ? (s.kind === "APPROVAL" && status === "WAITING_APPROVAL" ? "text-amber-400" : "text-emerald-400") : "text-red-400") : "text-neutral-600";
        return (
          <li key={i} className="relative">
            <span className={`absolute -left-[27px] top-0.5 rounded-full bg-neutral-950 ${tone}`}>
              <Icon className="h-4 w-4" />
            </span>
            <p className="text-sm font-medium text-neutral-200">
              <span className="mr-2 font-mono text-[10px] text-neutral-600">{String(i + 1).padStart(2, "0")}</span>
              {describeStep(s)}
            </p>
            {ev ? (
              <div className="mt-1 text-xs leading-5 text-neutral-400">
                {ev.summary}
                {ev.refs?.length ? (
                  <span className="ml-2 inline-flex flex-wrap gap-2">
                    {ev.refs.map((r) => (
                      <Link key={r.href + r.label} href={r.href} className="text-amber-400 hover:text-amber-300">
                        {r.label} →
                      </Link>
                    ))}
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-xs text-neutral-600">{status === "CANCELLED" ? "Not run (cancelled)" : status === "FAILED" ? "Not run" : "Pending"}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
