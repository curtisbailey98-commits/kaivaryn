"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { PlayCircle, X } from "lucide-react";

/**
 * A short guided tour of the executive Home for someone watching over the presenter's shoulder.
 * Pure UI: highlights elements marked with data-tour="<id>"; no data is read or written.
 * Start with the button, or open /app?tour=1.
 */

export type TourStep = { target: string; title: string; body: string };

const STEPS: TourStep[] = [
  { target: "summary", title: "The whole story in one line", body: "What Kaivaryn found, what is waiting on a decision, and what has actually been recorded. In this workspace it's example data for a demo company." },
  { target: "value", title: "Estimates and results never mix", body: "White figures are estimates. Green figures are results your team has recorded, and 'verified' means checked against evidence. They sit side by side and are never added together." },
  { target: "issues", title: "Every dollar has an owner", body: "Each issue has a dollar estimate, an owner, and a next step. Open any row to see the evidence behind the number." },
  { target: "decisions", title: "Nothing consequential happens without approval", body: "Anything that commits you to a customer, moves money, or changes a system waits here for a named person. Every decision is logged." },
  { target: "results", title: "Did it work?", body: "Recorded cash and savings by week. Only what the team has recorded counts. Estimates never show up here." },
];

type Rect = { top: number; left: number; width: number; height: number };

export function ValueTour({ autoStartParam = "tour" }: { autoStartParam?: string }) {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const steps = STEPS;
  const current = step === null ? null : steps[step];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get(autoStartParam) === "1") setStep(0);
  }, [autoStartParam]);

  const measure = useCallback(() => {
    if (!current) return setRect(null);
    const el = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [current]);

  useLayoutEffect(() => {
    if (!current) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Leave room for the tour card at the bottom of the screen.
      const desiredTop = Math.max(72, Math.min(120, vh * 0.12));
      if (r.top < desiredTop || r.bottom > vh - 230) {
        window.scrollTo({ top: window.scrollY + r.top - desiredTop, behavior: "smooth" });
      }
    }
    measure();
    const t1 = setTimeout(measure, 350);
    const t2 = setTimeout(measure, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [current, measure]);

  useEffect(() => {
    if (step === null) return;
    const on = () => measure();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStep(null);
      if (e.key === "ArrowRight") setStep((s) => (s === null ? s : Math.min(steps.length - 1, s + 1)));
      if (e.key === "ArrowLeft") setStep((s) => (s === null ? s : Math.max(0, s - 1)));
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); window.removeEventListener("keydown", key); };
  }, [step, measure, steps.length]);

  const last = step !== null && step === steps.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={() => setStep(0)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
        data-testid="tour-start"
      >
        <PlayCircle className="h-3.5 w-3.5" /> 60-second tour
      </button>

      {current && mounted ? createPortal(
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Guided tour">
          {rect ? (
            <div
              className="pointer-events-none fixed rounded-xl border-2 border-amber-400 transition-all duration-300"
              style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: "0 0 0 9999px rgba(0,0,0,0.62), 0 0 32px rgba(245,158,11,0.35)" }}
              aria-hidden
            />
          ) : (
            <div className="fixed inset-0 bg-black/60" aria-hidden />
          )}
          <button type="button" className="fixed inset-0 cursor-default" aria-label="Close tour" onClick={() => setStep(null)} tabIndex={-1} />
          <div className="fixed inset-x-3 bottom-3 z-[71] mx-auto max-w-lg rounded-2xl border border-amber-500/40 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur sm:bottom-6 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400">Tour · {step! + 1} of {steps.length}</p>
                <p className="mt-1 text-base font-semibold text-white">{current.title}</p>
              </div>
              <button type="button" onClick={() => setStep(null)} className="rounded-md p-1 text-neutral-500 hover:text-white" aria-label="End tour"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-2 text-sm leading-6 text-neutral-300">{current.body}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex gap-1.5" aria-hidden>
                {steps.map((_, i) => (
                  <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-amber-400" : "w-1.5 bg-neutral-700"}`} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {step! > 0 ? (
                  <button type="button" onClick={() => setStep(step! - 1)} className="rounded-lg px-3 py-1.5 text-xs text-neutral-400 hover:text-white">Back</button>
                ) : null}
                {last ? (
                  <Link href="/app/approvals" onClick={() => setStep(null)} className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-amber-400" data-testid="tour-finish">
                    See the approvals →
                  </Link>
                ) : (
                  <button type="button" onClick={() => setStep(step! + 1)} className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-amber-400" data-testid="tour-next">
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
