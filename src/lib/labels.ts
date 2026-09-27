/**
 * Client-facing label helpers — Title Case English, no snake_case / engine codes.
 */

const STATUS_LABELS: Record<string, string> = {
  IDENTIFIED: "Identified",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  IN_RECOVERY: "In recovery",
  PARTIALLY_RECOVERED: "Partially recovered",
  RECOVERED: "Recovered",
  VERIFIED: "Verified",
  DISMISSED: "Dismissed",
  NEW: "New",
  IN_PROGRESS: "In progress",
  ANALYZING: "Analyzing",
  IMPLEMENTING: "Implementing",
  REALIZED: "Realized",
  RESOLVED: "Resolved",
  PENDING: "Pending",
  REJECTED: "Rejected",
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  OPEN: "Open",
  CONNECTED: "Connected",
  AVAILABLE: "Available",
  NEEDS_CONFIG: "Needs config",
  ERROR: "Error",
  HIGH_VALUE_RECOVERY: "High-value recovery",
  HIGH_VALUE_SAVINGS: "High-value savings",
  AUTOMATION_CANDIDATE: "Automation candidate",
  INTEGRATION_GATE: "Integration gate",
  REVENUE_RECOVERY: "Revenue Recovery",
  OPERATIONS_EFFICIENCY: "Operations Efficiency",
};

/** Title Case English for statuses, types, priorities — never raw SNAKE_CASE. */
export function humanizeLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  const key = raw.trim();
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  const upper = key.toUpperCase();
  if (STATUS_LABELS[upper]) return STATUS_LABELS[upper];
  return key
    .replace(/^\[DETECT\]\s*/i, "")
    .replace(/[\[\]]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Strip engine prefixes from titles shown to clients. */
export function clientTitle(raw: string | null | undefined): string {
  if (!raw) return "Untitled";
  return raw
    .replace(/^\[DETECT\]\s*/i, "")
    .replace(/^\[DEMO\]\s*/i, "")
    .trim();
}
