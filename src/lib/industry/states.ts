/**
 * Honest integration states for business systems:
 *   selected → connection planned → configured → connected → verified
 * Selecting a system in onboarding only ever produces "selected". Connection states come from an
 * IntegrationConnection row for that provider (set by Kaivaryn during setup), never from a checkbox.
 */
import { systemStateFromIntegration, systemUsable, type SystemState } from "@/lib/voice/action-levels";

export type { SystemState };
export { systemUsable };

export const INTEGRATION_STATES: SystemState[] = ["selected", "planned", "configured", "connected", "verified"];
export const INTEGRATION_STATE_LABEL: Record<SystemState, string> = {
  selected: "Selected",
  planned: "Connection planned",
  configured: "Configured",
  connected: "Connected",
  verified: "Verified",
};
export const INTEGRATION_STATE_HELP: Record<SystemState, string> = {
  selected: "You told us you use it. Not connected.",
  planned: "Kaivaryn has scheduled the connection with you. Not connected yet.",
  configured: "Access is set up; waiting for data to arrive.",
  connected: "Data has arrived in Kaivaryn.",
  verified: "Data has arrived and been checked against your records.",
};

/** Resolve the state of each selected system. Unselected systems only appear if a connection row exists. */
export function resolveSystemStates(
  selected: Iterable<string>,
  connections: Array<{ provider: string; status: string | null }>,
): Map<string, SystemState> {
  const sel = new Set(selected);
  const out = new Map<string, SystemState>();
  for (const s of Array.from(sel)) out.set(s, "selected");
  for (const c of connections) {
    const st = systemStateFromIntegration(c.status, sel.has(c.provider));
    if (st) out.set(c.provider, st);
  }
  return out;
}
