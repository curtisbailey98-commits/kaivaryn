import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

const tones: Record<string, string> = {
  default: "bg-neutral-800 text-neutral-200",
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
        "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tones[tone] ?? tones.default,
        className
      )}
      {...props}
    />
  );
}
