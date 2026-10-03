import { cn } from "@/lib/utils";

const ROUTE_STYLE: Record<string, { label: string; cls: string }> = {
  ANALYZE: { label: "Analysis", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  ANSWER: { label: "Answer", cls: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  BUILD: { label: "Plan & build", cls: "border-violet-500/40 bg-violet-500/10 text-violet-300" },
  STATUS: { label: "Status", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  DIGEST: { label: "Briefing", cls: "border-amber-400/40 bg-amber-400/10 text-amber-200" },
  RECALL: { label: "Recall", cls: "border-teal-500/40 bg-teal-500/10 text-teal-300" },
  STANDING: { label: "Automation", cls: "border-orange-500/40 bg-orange-500/10 text-orange-300" },
  PLAYBOOK: { label: "Playbook", cls: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300" },
  REQUEST: { label: "Request", cls: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
  SEARCH: { label: "Find", cls: "border-neutral-600 bg-neutral-800/60 text-neutral-300" },
  INITIATIVE: { label: "Initiative", cls: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300" },
  HELP: { label: "Help", cls: "border-neutral-600 bg-neutral-800/60 text-neutral-300" },
};

export function RouteBadge({ route, className }: { route: string; className?: string }) {
  const s = ROUTE_STYLE[route] ?? ROUTE_STYLE.HELP;
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", s.cls, className)}>{s.label}</span>;
}

const RUN_STYLE: Record<string, string> = {
  SUCCEEDED: "border-emerald-700 bg-emerald-950 text-emerald-300",
  FAILED: "border-red-800 bg-red-950 text-red-300",
  WAITING_APPROVAL: "border-amber-700 bg-amber-950 text-amber-300",
  RUNNING: "border-sky-800 bg-sky-950 text-sky-300",
  QUEUED: "border-neutral-700 bg-neutral-900 text-neutral-300",
  CANCELLED: "border-neutral-700 bg-neutral-900 text-neutral-500",
  OK: "border-emerald-700 bg-emerald-950 text-emerald-300",
  DEGRADED: "border-amber-700 bg-amber-950 text-amber-300",
  DOWN: "border-red-800 bg-red-950 text-red-300",
  INFO: "border-sky-800 bg-sky-950 text-sky-300",
  DENIED: "border-red-800 bg-red-950 text-red-300",
  ERROR: "border-red-800 bg-red-950 text-red-300",
};

export function RunStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold tracking-wide", RUN_STYLE[status] ?? RUN_STYLE.QUEUED, className)}>
      {status === "WAITING_APPROVAL" ? "Waiting on approval" : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
