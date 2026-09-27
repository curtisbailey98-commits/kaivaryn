import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "default",
  href,
  className,
}: {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "accent" | "danger" | "success";
  href?: string;
  className?: string;
}) {
  const toneStyles: Record<string, string> = {
    default: "border-neutral-800/90 bg-neutral-950/70",
    accent: "border-amber-500/25 bg-amber-500/[0.05]",
    danger: "border-red-500/25 bg-red-500/[0.05]",
    success: "border-emerald-500/25 bg-emerald-500/[0.05]",
  };
  const iconTone: Record<string, string> = {
    default: "text-neutral-500",
    accent: "text-amber-400",
    danger: "text-red-400",
    success: "text-emerald-400",
  };

  const body = (
    <div
      className={cn(
        "si-glass app-card-lift rounded-xl border p-3 sm:p-4",
        toneStyles[tone],
        className
      )}
    >
      <div className="relative z-[1] flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
        {Icon ? <Icon className={cn("h-4 w-4", iconTone[tone])} strokeWidth={2} /> : null}
      </div>
      <p className="relative z-[1] mt-1.5 text-xl font-semibold tracking-tight text-white sm:mt-2 sm:text-2xl">{value}</p>
      {sublabel ? <p className="relative z-[1] mt-1 text-xs text-neutral-500">{sublabel}</p> : null}
    </div>
  );

  return href ? <Link href={href} className="block">{body}</Link> : body;
}
