"use client";

import { useState } from "react";
import Link from "next/link";
import { Mic, MicOff, PhoneOff, X, ShieldCheck } from "lucide-react";
import { useVoiceCall } from "./use-voice-call";
import { VoiceOrb } from "./voice-orb";

const STATUS: Record<string, string> = {
  idle: "Ask about your workspace",
  connecting: "Connecting…",
  live: "Live — Viki is listening",
  ended: "Call ended",
  unavailable: "Voice unavailable",
  error: "Something went wrong",
};

/** In-app "Ask Viki" for signed-in users. Data only via server tools scoped to this tenant + role. */
export function WorkspaceViki({ orgName, roleLabel }: { orgName: string; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const call = useVoiceCall("workspace");
  const live = call.state === "live" || call.state === "connecting";
  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="workspace-viki-launcher"
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full border border-neutral-700/80 bg-neutral-950/90 py-1.5 pl-1.5 pr-3.5 text-xs font-medium text-neutral-100 shadow-[0_12px_40px_rgba(0,0,0,0.55),0_0_0_1px_rgba(245,158,11,0.15)] backdrop-blur-xl transition hover:border-amber-500/50 sm:right-6"
          aria-label="Ask Viki about this workspace"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-neutral-200 via-neutral-500 to-neutral-900"><Mic className="h-3 w-3 text-neutral-950" /></span>
          Ask Viki
        </button>
      ) : null}
      {open ? (
        <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-auto sm:bottom-6 sm:right-6" role="dialog" aria-label="Ask Viki" data-testid="workspace-viki-panel">
          <div className="w-full overflow-hidden rounded-t-2xl border border-neutral-800 bg-neutral-950/95 shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:w-[360px] sm:rounded-2xl">
            <div className="flex items-start justify-between border-b border-neutral-900 px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500">Viki · in-app voice</p>
                <p className="mt-1 truncate text-sm font-semibold text-white">{orgName}</p>
              </div>
              <button type="button" onClick={() => { if (live) void call.stop(); setOpen(false); }} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-900 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-5 pb-5 pt-4">
              <div className="flex items-center gap-4">
                <VoiceOrb state={call.state} level={call.level} speaking={call.speaking} size="lg" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-100" aria-live="polite">{STATUS[call.state]}</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-400">{call.state === "unavailable" || call.state === "error" ? call.message : "Try: “What's pending approval?” or “Where's our biggest estimated recovery?”"}</p>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-neutral-900 bg-black/40 p-3 text-[11px] leading-5 text-neutral-400">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>Viki only sees what your role (<span className="text-neutral-200">{roleLabel}</span>) can see in this workspace, and says so when data isn&apos;t available. Anything consequential goes to <Link href="/app/approvals" className="text-neutral-200 underline-offset-2 hover:underline">Approvals</Link> — she never acts on her own.</span>
              </div>
              {call.captions.length ? (
                <div className="mt-3 max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-neutral-900 bg-black/40 p-3 text-xs leading-5" aria-live="polite">
                  {call.captions.slice(-6).map((c, i) => (
                    <p key={i} className={c.role === "assistant" ? "text-neutral-200" : "text-amber-200/80"}><span className="mr-1.5 font-mono text-[10px] uppercase text-neutral-600">{c.role === "assistant" ? "Viki" : "You"}</span>{c.text}</p>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 flex gap-2">
                {live ? (
                  <>
                    <button type="button" onClick={call.toggleMute} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-700 text-sm text-neutral-200">{call.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{call.muted ? "Unmute" : "Mute"}</button>
                    <button type="button" onClick={() => void call.stop()} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-red-700 text-sm font-medium text-white"><PhoneOff className="h-4 w-4" />End</button>
                  </>
                ) : call.state !== "unavailable" ? (
                  <button type="button" onClick={() => void call.start()} data-testid="workspace-viki-start" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 text-sm font-semibold text-neutral-950 hover:bg-amber-400"><Mic className="h-4 w-4" />{call.state === "ended" || call.state === "error" ? "Talk again" : "Start talking"}</button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
