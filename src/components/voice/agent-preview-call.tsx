"use client";

import { Mic, PhoneOff } from "lucide-react";
import { useVoiceCall } from "./use-voice-call";
import { VoiceOrb } from "./voice-orb";

/** Test call to the tenant's own draft/test assistant. */
export function AgentPreviewCall({ agentId, agentName, disabled }: { agentId: string; agentName: string; disabled?: boolean }) {
  const call = useVoiceCall("preview", { agentId });
  const live = call.state === "live" || call.state === "connecting";
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-800 bg-black/30 p-4">
      <VoiceOrb state={call.state} level={call.level} speaking={call.speaking} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{live ? `Talking to ${agentName}…` : `Test-call ${agentName}`}</p>
        <p className="text-xs text-neutral-500">{call.message || "A private web call from your browser. Nothing is live to your customers."}</p>
      </div>
      {live ? (
        <button type="button" onClick={() => void call.stop()} className="inline-flex h-9 items-center gap-2 rounded-md bg-red-700 px-3 text-xs font-medium text-white"><PhoneOff className="h-3.5 w-3.5" />End</button>
      ) : (
        <button type="button" disabled={disabled} onClick={() => void call.start()} className="inline-flex h-9 items-center gap-2 rounded-md bg-amber-500 px-3 text-xs font-semibold text-neutral-950 disabled:opacity-50"><Mic className="h-3.5 w-3.5" />Start test call</button>
      )}
    </div>
  );
}
