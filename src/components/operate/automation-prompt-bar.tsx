"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarClock, CornerDownLeft } from "lucide-react";

export const AUTOMATION_EXAMPLES: Array<{ label: string; text: string }> = [
  { label: "Monday 8am briefing", text: "Every Monday at 8am send me a briefing" },
  { label: "Leakage alert over $50k", text: "Every weekday at 9 check revenue leakage and alert me if it's over $50k" },
  { label: "Daily health check", text: "Daily at 7 run a health check" },
  { label: "Monthly revenue sweep", text: "First of the month run the revenue sweep" },
  { label: "Friday operations review", text: "Every Friday at 4pm analyze operations and send me a digest" },
  { label: "Critical items watch", text: "Every hour tell me if there are any critical items" },
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 text-sm font-semibold text-neutral-950 shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_8px_24px_rgba(245,158,11,0.18)] transition hover:bg-amber-400 disabled:opacity-60"
    >
      {pending ? "Reading…" : (
        <>
          Preview <CornerDownLeft className="h-3.5 w-3.5" />
        </>
      )}
    </button>
  );
}

/** Plain-English automation prompt. Submits as GET so the preview is a read-only page render. */
export function AutomationPromptBar({ defaultValue, action = "/app/automations" }: { defaultValue?: string; action?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div>
      <form action={action} method="get" className="relative">
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/25 bg-neutral-950/80 p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_-20px_rgba(245,158,11,0.25)] transition focus-within:border-amber-400/60 sm:flex-row sm:items-start">
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 sm:flex">
            <CalendarClock className="h-4 w-4" />
          </span>
          <textarea
            ref={ref}
            name="prompt"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            maxLength={600}
            required
            placeholder="Describe the automation — “Every Monday at 8am check revenue leakage and alert me if it's over $50k”"
            className="min-h-[44px] min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-6 text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
            aria-label="Automation prompt"
          />
          <Submit />
        </div>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {AUTOMATION_EXAMPLES.map((ex) => (
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
    </div>
  );
}
