import { roleRank } from "@/lib/rbac";

/**
 * Voice permissions, layered on the existing role ranks (VIEWER 10 … OWNER 50, platform roles 90+).
 * Transcripts contain caller PII, so they need MANAGER+. Activating an AI agent that answers the
 * business's phone is an ADMIN+ decision.
 */
export type VoicePermission =
  | "voice.use"            // talk to Viki in the app
  | "voice.calls.list"     // see call list + summaries
  | "voice.calls.transcript"
  | "voice.agent.view"
  | "voice.agent.edit"     // draft/edit config, run generator
  | "voice.agent.test"     // provision a test assistant + preview call
  | "voice.agent.approve"
  | "voice.agent.activate"
  | "voice.usage.view"
  | "voice.cost.view"      // provider cost — Kaivaryn internal only
  | "voice.sync";

const MIN: Record<VoicePermission, number> = {
  "voice.use": 10,
  "voice.calls.list": 10,
  "voice.calls.transcript": 30,
  "voice.agent.view": 10,
  "voice.agent.edit": 30,
  "voice.agent.test": 30,
  "voice.agent.approve": 40,
  "voice.agent.activate": 40,
  "voice.usage.view": 10,
  "voice.cost.view": 50,
  "voice.sync": 40,
};

export function canVoice(role: string | null | undefined, perm: VoicePermission): boolean {
  return roleRank(role) >= MIN[perm];
}

export function assertVoice(role: string | null | undefined, perm: VoicePermission): void {
  if (!canVoice(role, perm)) throw new Error(`Forbidden: ${perm}`);
}
