import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

const tones: Record<string, string> = {
  default: "bg-neutral-800 text-neutral-200 border-neutral-700",
  success: "bg-emerald-950 text-emerald-300 border-emerald-800",
  warning: "bg-amber-950 text-amber-300 border-amber-800",
  danger: "bg-red-950 text-red-300 border-red-800",
  info: "bg-sky-950 text-sky-300 border-sky-800",
  demo: "bg-violet-950 text-violet-300 border-violet-800",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tones[tone] ?? tones.default,
        className
      )}
      {...props}
    />
  );
}

/** Priority/severity is the single most important scan cue on RR/OE, findings,
 *  and acquisition surfaces — this maps the shared CRITICAL/HIGH/MEDIUM/LOW
 *  vocabulary to a consistent dot + tone everywhere it appears. */
const PRIORITY_TONE: Record<string, { tone: keyof typeof tones; dot: string }> = {
  CRITICAL: { tone: "danger", dot: "bg-red-500" },
  HIGH: { tone: "warning", dot: "bg-amber-500" },
  MEDIUM: { tone: "info", dot: "bg-sky-500" },
  LOW: { tone: "default", dot: "bg-neutral-500" },
};

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const cfg = PRIORITY_TONE[priority.toUpperCase()] ?? PRIORITY_TONE.LOW;
  return (
    <Badge tone={cfg.tone} className={className}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {priority}
    </Badge>
  );
}

const CONFIDENCE_TONE: Record<string, keyof typeof tones> = {
  high: "success",
  medium: "warning",
  low: "default",
};

export function ConfidenceBadge({ confidence, className }: { confidence: string; className?: string }) {
  const tone = CONFIDENCE_TONE[confidence.toLowerCase()] ?? "default";
  return (
    <Badge tone={tone} className={className}>
      {confidence} confidence
    </Badge>
  );
}

/** Generic lifecycle-stage badge for anything with a status string (Opportunity,
 *  Inefficiency, ProspectAccount, DemoRequest, ApprovalRequest, ...) — buckets
 *  unknown/new-ish statuses as info, terminal-positive as success, terminal-
 *  negative as danger, and everything mid-flow as default, so a new status
 *  value added later never renders unstyled. */
const POSITIVE_STATUSES = new Set(["WON", "ACTIVE", "RECOVERED", "VERIFIED", "REALIZED", "CLOSED_WON", "APPROVED", "CONNECTED"]);
const NEGATIVE_STATUSES = new Set(["LOST", "DISQUALIFIED", "NOT_INTERESTED", "UNSUBSCRIBED", "REJECTED", "CLOSED_LOST", "PAYMENT_FAILED", "ABANDONED", "ERROR"]);
const NEUTRAL_EARLY_STATUSES = new Set(["DETECTED", "NEW", "DRAFT", "PENDING", "RESOLVED", "OPEN"]);

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = status.toUpperCase();
  const tone: keyof typeof tones = POSITIVE_STATUSES.has(key)
    ? "success"
    : NEGATIVE_STATUSES.has(key)
    ? "danger"
    : NEUTRAL_EARLY_STATUSES.has(key)
    ? "info"
    : "default";
  return (
    <Badge tone={tone} className={className}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
