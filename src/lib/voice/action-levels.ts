/**
 * Action levels for voice tools. Safe by default: anything that moves money, commits the business
 * contractually, or acts outside Kaivaryn is REQUIRE_APPROVAL and can never be raised to EXECUTE.
 */
export const ACTION_LEVELS = ["READ", "ANSWER", "SUGGEST", "DRAFT", "EXECUTE", "REQUIRE_APPROVAL"] as const;
export type ActionLevel = (typeof ACTION_LEVELS)[number];

export const ACTION_LEVEL_LABEL: Record<ActionLevel, string> = {
  READ: "Read — look up information",
  ANSWER: "Answer — respond from approved knowledge",
  SUGGEST: "Suggest — recommend a next step",
  DRAFT: "Draft — prepare something for a person to review",
  EXECUTE: "Execute — do it directly (low-risk only)",
  REQUIRE_APPROVAL: "Needs approval — a person must approve first",
};

export type VoiceTool = {
  key: string;
  label: string;
  description: string;
  defaultLevel: ActionLevel;
  /** Highest level this tool may ever be given. */
  maxLevel: ActionLevel;
  /** Consequential tools are forced to REQUIRE_APPROVAL. */
  consequential?: boolean;
  /** Business systems that would back this tool when connected. */
  systems?: string[];
};

const ORDER: Record<ActionLevel, number> = { READ: 0, ANSWER: 1, SUGGEST: 2, DRAFT: 3, EXECUTE: 4, REQUIRE_APPROVAL: 5 };

/** Client voice-agent tool catalog. */
export const CLIENT_TOOLS: VoiceTool[] = [
  { key: "answer_faq", label: "Answer common questions", description: "Hours, location, services — from approved knowledge only.", defaultLevel: "ANSWER", maxLevel: "ANSWER" },
  { key: "take_message", label: "Take a message", description: "Capture caller name, number, and reason for a person to follow up.", defaultLevel: "DRAFT", maxLevel: "DRAFT" },
  { key: "request_callback", label: "Request a callback", description: "Ask a team member to call the person back.", defaultLevel: "DRAFT", maxLevel: "DRAFT" },
  { key: "request_appointment", label: "Request an appointment", description: "Capture a preferred time. Booked only once a calendar is connected and a person confirms.", defaultLevel: "DRAFT", maxLevel: "DRAFT", systems: ["google_workspace", "microsoft365"] },
  { key: "lookup_order_status", label: "Look up an order or ticket", description: "Read status from a connected system.", defaultLevel: "READ", maxLevel: "READ", systems: ["shopify", "woocommerce", "zendesk", "servicenow", "jira_service", "intercom", "magento"] },
  { key: "lookup_account", label: "Look up a customer account", description: "Read account details from a connected CRM.", defaultLevel: "READ", maxLevel: "READ", systems: ["salesforce", "hubspot", "dynamics365", "zoho", "pipedrive", "other_crm"] },
  { key: "check_invoice_status", label: "Check invoice status", description: "Read invoice or payment status from a connected billing system.", defaultLevel: "READ", maxLevel: "READ", systems: ["stripe", "quickbooks", "xero", "netsuite", "sap", "sage", "other_erp"] },
  { key: "issue_refund", label: "Refunds", description: "Always needs a person's approval.", defaultLevel: "REQUIRE_APPROVAL", maxLevel: "REQUIRE_APPROVAL", consequential: true, systems: ["stripe", "quickbooks", "xero", "netsuite"] },
  { key: "contract_change", label: "Contract or pricing changes", description: "Always needs a person's approval.", defaultLevel: "REQUIRE_APPROVAL", maxLevel: "REQUIRE_APPROVAL", consequential: true },
  { key: "financial_commitment", label: "Discounts, credits, or financial commitments", description: "Always needs a person's approval.", defaultLevel: "REQUIRE_APPROVAL", maxLevel: "REQUIRE_APPROVAL", consequential: true },
  { key: "transfer_to_human", label: "Hand off to a person", description: "Route the caller to your team per your escalation rules.", defaultLevel: "EXECUTE", maxLevel: "EXECUTE" },
];

export function toolByKey(key: string): VoiceTool | undefined {
  return CLIENT_TOOLS.find((t) => t.key === key);
}

/** Clamp a requested level to the tool's safe ceiling. Consequential tools are always REQUIRE_APPROVAL. */
export function clampLevel(tool: VoiceTool, requested: string | null | undefined): ActionLevel {
  if (tool.consequential) return "REQUIRE_APPROVAL";
  const lvl = (ACTION_LEVELS as readonly string[]).includes(String(requested)) ? (requested as ActionLevel) : tool.defaultLevel;
  if (lvl === "REQUIRE_APPROVAL") return "REQUIRE_APPROVAL"; // stricter is always allowed
  return ORDER[lvl] > ORDER[tool.maxLevel] ? tool.maxLevel : lvl;
}

/** Normalise a tool map: unknown tools dropped, every level clamped, consequential tools forced to approval. */
export function sanitizeToolMap(input: Record<string, unknown> | null | undefined): Record<string, ActionLevel> {
  const out: Record<string, ActionLevel> = {};
  for (const [k, v] of Object.entries(input || {})) {
    const tool = toolByKey(k);
    if (!tool) continue;
    if (v === false || v === "OFF" || v === null) continue;
    out[k] = clampLevel(tool, String(v));
  }
  for (const t of CLIENT_TOOLS) if (t.consequential && out[t.key] === undefined) out[t.key] = "REQUIRE_APPROVAL";
  return out;
}

export function defaultToolMap(): Record<string, ActionLevel> {
  const out: Record<string, ActionLevel> = {};
  for (const t of CLIENT_TOOLS) out[t.key] = t.defaultLevel;
  return out;
}

/**
 * Integration honesty: a tool backed by a business system is only usable when that system is
 * CONNECTED (or VERIFIED). Selected/planned/configured systems are shown as such — never as connected.
 */
export type SystemState = "selected" | "planned" | "configured" | "connected" | "verified";
export function systemStateFromIntegration(status: string | null | undefined, selected: boolean): SystemState | null {
  const s = String(status || "").toUpperCase();
  if (s === "VERIFIED") return "verified";
  if (s === "CONNECTED") return "connected";
  if (s === "CONFIGURED" || s === "PENDING") return "configured";
  if (s === "PLANNED") return "planned";
  return selected ? "selected" : null;
}
export function systemUsable(state: SystemState | null): boolean {
  return state === "connected" || state === "verified";
}

/** Human-handoff triggers baked into every generated prompt. */
export const HANDOFF_TRIGGERS = [
  "You are uncertain, or the answer is not in your approved knowledge",
  "The caller is angry, distressed, or asks to complain",
  "Sensitive financial matters (refunds, disputes, credits, billing errors, payment changes)",
  "Legal matters (contracts, liability, threats of legal action, compliance questions)",
  "Requests you are not configured or permitted to handle",
  "Anything outside the caller's permission boundary or requiring identity you cannot verify",
  "Any consequential action (money, contracts, commitments, account changes)",
  "The caller explicitly asks for a person",
] as const;
