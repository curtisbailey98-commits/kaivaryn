/**
 * Viki Core — shared constants. No secrets live here.
 *
 * Kaivaryn's own receptionist "Viki" is an existing Vapi assistant wired to Curtis's n8n workflow.
 * Kaivaryn NEVER modifies it: no PATCH, no server-URL change, no phone-number change. Calls are
 * read by polling GET /call filtered by assistantId.
 */
export const KAIVARYN_HQ_SLUG = "kaivaryn-hq";

/** The saved "Viki" assistant (phone lines + n8n). Read-only for Kaivaryn. */
export const VIKI_ASSISTANT_ID = process.env.KAIVARYN_VIKI_ASSISTANT_ID || "f22b0952-119e-4ed7-b656-b6ccbc4f2a2a";

/** Assistant ids Kaivaryn must never write to, whatever the caller asks. */
export function protectedAssistantIds(): string[] {
  return [VIKI_ASSISTANT_ID, "f22b0952-119e-4ed7-b656-b6ccbc4f2a2a"];
}

/** Web-only Kaivaryn assistants (created new; Viki untouched). Ids come from env once provisioned. */
export const KAIVARYN_WEB_ASSISTANT_ID = () => process.env.VAPI_WEB_ASSISTANT_ID || "";
export const KAIVARYN_WORKSPACE_ASSISTANT_ID = () => process.env.VAPI_WORKSPACE_ASSISTANT_ID || "";

import { ZOOM_SCHEDULER_URL } from "@/lib/constants";
export const ZOOM_DEMO_URL = ZOOM_SCHEDULER_URL;

/** Outbound calling is OFF. There is no autonomous or mass calling path. */
export const VOICE_OUTBOUND_ENABLED = false as const;

export function assertOutboundDisabled(): never {
  throw new Error("Outbound voice calling is disabled for Kaivaryn. No autonomous or mass calling is permitted.");
}

export const AGENT_STATUSES = ["draft", "generated", "in_review", "testing", "approved", "active", "paused"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  draft: "Draft",
  generated: "Recommended config ready",
  in_review: "In review",
  testing: "Testing",
  approved: "Approved — not yet live",
  active: "Active",
  paused: "Paused",
};

/** Public web token lifetime (seconds). Short so a leaked token is near-worthless. */
export const WEB_TOKEN_TTL_SECONDS = 600;
/** Signed per-call workspace session lifetime (seconds). */
export const TOOL_SESSION_TTL_SECONDS = 30 * 60;
/** Hard cap on Kaivaryn-created web call length (cost guard). */
export const WEB_CALL_MAX_SECONDS = 600;
