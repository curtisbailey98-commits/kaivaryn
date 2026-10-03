"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CallState = "idle" | "connecting" | "live" | "ended" | "unavailable" | "error";
export type Caption = { role: "assistant" | "you"; text: string };

type VapiLike = {
  start: (assistantId: string, overrides?: Record<string, unknown>) => Promise<unknown>;
  stop: () => Promise<void> | void;
  setMuted: (m: boolean) => void;
  on: (e: string, cb: (...args: never[]) => void) => void;
  removeAllListeners: () => void;
};

/**
 * Browser voice call. Asks our server for a short-lived session (public-scoped token pinned to one
 * assistant), then starts the call with the Web SDK, which is loaded only on demand.
 */
export function useVoiceCall(mode: "public" | "workspace" | "preview", extra?: { agentId?: string }) {
  const [state, setState] = useState<CallState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [muted, setMutedState] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const vapiRef = useRef<VapiLike | null>(null);

  const cleanup = useCallback(() => {
    try {
      vapiRef.current?.removeAllListeners();
    } catch { /* ignore */ }
    vapiRef.current = null;
    setSpeaking(false);
    setLevel(0);
  }, []);

  useEffect(() => () => {
    try {
      void vapiRef.current?.stop();
    } catch { /* ignore */ }
    cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    if (state === "connecting" || state === "live") return;
    setState("connecting");
    setMessage(null);
    setCaptions([]);
    try {
      const res = await fetch("/api/voice/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, agentId: extra?.agentId }) });
      const s = await res.json().catch(() => ({ available: false, reason: "Voice is not available right now." }));
      if (!s.available) {
        setState("unavailable");
        setMessage(s.reason || "Voice is not available right now.");
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        setMessage("This browser can't use the microphone. Try Chrome, Safari, or Edge.");
        return;
      }
      const mod = await import("@vapi-ai/web");
      const Vapi = (mod as unknown as { default: new (token: string) => VapiLike }).default;
      const vapi = new Vapi(s.token);
      vapiRef.current = vapi;
      vapi.on("call-start", () => setState("live"));
      vapi.on("call-end", () => {
        setState("ended");
        cleanup();
      });
      vapi.on("speech-start", () => setSpeaking(true));
      vapi.on("speech-end", () => setSpeaking(false));
      vapi.on("volume-level", ((v: number) => setLevel(Math.max(0, Math.min(1, Number(v) || 0)))) as never);
      vapi.on("message", ((m: { type?: string; role?: string; transcriptType?: string; transcript?: string }) => {
        if (m?.type === "transcript" && m.transcriptType === "final" && m.transcript) {
          const role = m.role === "assistant" ? "assistant" : "you";
          setCaptions((c) => [...c.slice(-30), { role, text: String(m.transcript).slice(0, 600) }]);
        }
      }) as never);
      vapi.on("error", ((e: unknown) => {
        const text = JSON.stringify(e ?? "").toLowerCase();
        setMessage(text.includes("permission") || text.includes("notallowed") ? "Microphone access was blocked. Allow it in your browser settings and try again." : "The call couldn't continue. Please try again.");
        setState("error");
        cleanup();
      }) as never);
      await vapi.start(s.assistantId, { variableValues: s.variableValues || {} });
    } catch (e) {
      const text = String((e as Error)?.message || e).toLowerCase();
      setMessage(text.includes("permission") || text.includes("notallowed") ? "Microphone access was blocked. Allow it in your browser settings and try again." : "The call couldn't start. Please try again.");
      setState("error");
      cleanup();
    }
  }, [state, mode, extra?.agentId, cleanup]);

  const stop = useCallback(async () => {
    try {
      await vapiRef.current?.stop();
    } catch { /* ignore */ }
    setState("ended");
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    try {
      vapiRef.current?.setMuted(next);
      setMutedState(next);
    } catch { /* ignore */ }
  }, [muted]);

  return { state, message, captions, muted, speaking, level, start, stop, toggleMute };
}
