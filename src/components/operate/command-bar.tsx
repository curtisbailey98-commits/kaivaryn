"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CornerDownLeft, Sparkles } from "lucide-react";
import { runCommandAction } from "@/app/app/operate-actions";

function Submit({ compact }: { compact?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-500 font-semibold text-neutral-950 shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_8px_24px_rgba(245,158,11,0.18)] transition hover:bg-amber-400 disabled:opacity-60 ${compact ? "h-10 px-4 text-xs" : "h-12 px-5 text-sm"}`}
    >
      {pending ? (
        <>
          <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-950" /> Routing…
        </>
      ) : (
        <>
          Run <CornerDownLeft className="h-3.5 w-3.5" />
        </>
      )}
    </button>
  );
}

export function CommandBar({
  defaultValue,
  examples,
  compact,
  back = "/app/command",
  autoFocus,
}: {
  defaultValue?: string;
  examples?: Array<{ label: string; text: string }>;
  compact?: boolean;
  back?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <form action={runCommandAction} className="relative">
        <input type="hidden" name="back" value={back} />
        <div className={`group flex items-center gap-2 rounded-xl border border-amber-500/25 bg-neutral-950/80 p-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_-20px_rgba(245,158,11,0.25)] transition focus-within:border-amber-400/60`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <Sparkles className="h-4 w-4" />
          </span>
          <input
            ref={ref}
            name="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus={autoFocus}
            autoComplete="off"
            maxLength={1000}
            placeholder="Ask or direct Kaivaryn — “Analyze revenue leakage”, “Brief me”, “Every day digest”…"
            className={`min-w-0 flex-1 bg-transparent px-1 text-neutral-100 placeholder:text-neutral-600 focus:outline-none ${compact ? "h-10 text-sm" : "h-12 text-[15px]"}`}
            aria-label="Command"
          />
          <Submit compact={compact} />
        </div>
      </form>
      {examples?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex.text}
              type="button"
              onClick={() => {
                setValue(ex.text);
                ref.current?.focus();
              }}
              className="rounded-full border border-neutral-800 bg-neutral-950/60 px-3 py-1 text-[11px] text-neutral-400 transition hover:border-amber-600/60 hover:text-amber-300"
            >
              {ex.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
