import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AttentionBanner({
  items,
}: {
  items: Array<{ label: string; count: number; href: string; tone?: "warning" | "danger" }>;
}) {
  const active = items.filter((i) => i.count > 0);

  if (active.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
        <p className="text-sm text-neutral-300">Nothing needs your attention right now — everything is up to date.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex items-center gap-2 pl-1 pr-2 text-sm font-medium text-amber-300">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Needs your attention
      </div>
      <div className="flex flex-1 flex-wrap gap-2">
        {active.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
              item.tone === "danger"
                ? "border-red-500/30 bg-red-500/[0.06] text-red-200 hover:bg-red-500/[0.12]"
                : "border-amber-500/25 bg-neutral-950/40 text-amber-100 hover:bg-amber-500/[0.1]"
            )}
          >
            {item.count} {item.label}
            <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function NextBestAction({ title, description, href, actionLabel = "Open" }: { title: string; description?: ReactNode; href: string; actionLabel?: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-gradient-to-r from-neutral-950 to-neutral-900/60 p-4 transition hover:border-amber-500/30"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Next best action</p>
        <p className="mt-1 text-sm font-medium text-white">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-neutral-500">{description}</p> : null}
      </div>
      <span className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-neutral-950 transition group-hover:bg-amber-400">
        {actionLabel} <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
