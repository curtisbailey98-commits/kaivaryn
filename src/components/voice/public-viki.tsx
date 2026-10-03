"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic, MicOff, PhoneOff, X, CalendarClock } from "lucide-react";
import { useVoiceCall } from "./use-voice-call";
import { VoiceOrb } from "./voice-orb";
import { ZOOM_SCHEDULER_URL as ZOOM_DEMO_URL } from "@/lib/constants";

const STATUS: Record<string, string> = {
  idle: "Ready when you are",
  connecting: "Connecting…",
  live: "Live — Viki is listening",
  ended: "Call ended",
  unavailable: "Voice unavailable",
  error: "Something went wrong",
};

export function openViki() {
  window.dispatchEvent(new CustomEvent("kv:open-viki"));
}

/** Inline trigger for use inside public pages. */
export function TalkToVikiButton({ className, label = "Talk to Viki" }: { className?: string; label?: string }) {
  return (
    <button type="button" onClick={openViki} className={className ?? "inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20"}>
      <Mic className="h-4 w-4" /> {label}
    </button>
  );
}

/** "Talk to Viki" — Kaivaryn's website voice assistant (launcher + panel). */
export function PublicViki() {
  const [open, setOpen] = useState(false);
  const call = useVoiceCall("public");

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("kv:open-viki", h);
    return () => window.removeEventListener("kv:open-viki", h);
  }, []);

  const live = call.state === "live" || call.state === "connecting";

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="viki-launcher"
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2.5 rounded-full border border-neutral-700/80 bg-neutral-950/90 py-2 pl-2 pr-4 text-sm font-medium text-neutral-100 shadow-[0_12px_40px_rgba(0,0,0,0.55),0_0_0_1px_rgba(245,158,11,0.18)] backdrop-blur-xl transition hover:border-amber-500/50 hover:text-white sm:right-6"
          aria-label="Talk to Viki, Kaivaryn's AI voice assistant"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-neutral-200 via-neutral-500 to-neutral-900 shadow-[0_0_18px_rgba(245,158,11,0.25)]">
            <Mic className="h-3.5 w-3.5 text-neutral-950" />
          </span>
          Talk to Viki
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-auto sm:bottom-6 sm:right-6" role="dialog" aria-label="Talk to Viki" data-testid="viki-panel">
          <div className="mx-auto w-full overflow-hidden rounded-t-2xl border border-neutral-800 bg-neutral-950/95 shadow-[0_24px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(245,158,11,0.12)] backdrop-blur-2xl sm:w-[380px] sm:rounded-2xl">
            <div className="flex items-start justify-between border-b border-neutral-900 px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500">Kaivaryn · AI voice assistant</p>
                <p className="mt-1 text-base font-semibold text-white">Talk to Viki</p>
              </div>
              <button type="button" onClick={() => { if (live) void call.stop(); setOpen(false); }} className="rounded-md p-1.5 text-neutral-500 transition hover:bg-neutral-900 hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 pb-5 pt-4">
              <div className="flex items-center gap-4">
                <VoiceOrb state={call.state} level={call.level} speaking={call.speaking} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-100" aria-live="polite">{STATUS[call.state]}</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-400">
                    {call.state === "unavailable" || call.state === "error"
                      ? call.message
                      : "Tell Viki what's happening in your business. She'll help you see whether Revenue Recovery or Operations Efficiency fits — and point you to an executive demo if it does."}
                  </p>
                </div>
              </div>

              {call.captions.length ? (
                <div className="mt-4 max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-neutral-900 bg-black/40 p-3 text-xs leading-5" aria-live="polite">
                  {call.captions.slice(-6).map((c, i) => (
                    <p key={i} className={c.role === "assistant" ? "text-neutral-200" : "text-amber-200/80"}>
                      <span className="mr-1.5 font-mono text-[10px] uppercase text-neutral-600">{c.role === "assistant" ? "Viki" : "You"}</span>
                      {c.text}
                    </p>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                {live ? (
                  <>
                    <button type="button" onClick={call.toggleMute} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-700 text-sm text-neutral-200 transition hover:border-neutral-500">
                      {call.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {call.muted ? "Unmute" : "Mute"}
                    </button>
                    <button type="button" onClick={() => void call.stop()} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-red-700 text-sm font-medium text-white transition hover:bg-red-600">
                      <PhoneOff className="h-4 w-4" /> End call
                    </button>
                  </>
                ) : call.state !== "unavailable" ? (
                  <button type="button" onClick={() => void call.start()} data-testid="viki-start" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 text-sm font-semibold text-neutral-950 shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_8px_24px_rgba(245,158,11,0.18)] transition hover:bg-amber-400">
                    <Mic className="h-4 w-4" /> {call.state === "ended" || call.state === "error" ? "Talk again" : "Start voice conversation"}
                  </button>
                ) : null}
                <a href={ZOOM_DEMO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-amber-500/40 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/10">
                  <CalendarClock className="h-4 w-4" /> Book an executive demo
                </a>
              </div>

              <p className="mt-4 text-[11px] leading-5 text-neutral-500">
                Viki is an AI assistant. Uses your microphone; conversations are transcribed so Kaivaryn can follow up.
                Prefer typing? <Link href="/contact" className="text-neutral-300 underline-offset-2 hover:underline">Contact us</Link>.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
