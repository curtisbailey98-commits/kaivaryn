import type { ConnectionMethod } from "./types";

/** Used wherever a specific menu path or capability couldn't be confirmed from public docs. */
export const CONFIRM = "confirmed with your Kaivaryn lead during setup";

export const METHOD_LABEL: Record<ConnectionMethod, string> = {
  oauth: "Approve access in the vendor's own sign-in screen",
  api_credentials: "Read-only API access you create in the vendor's admin",
  partner_request: "Access requested through the vendor or your account rep",
  export: "Scheduled report / CSV export",
  database: "Read-only database access from your IT team",
  file: "File upload or secure file drop",
};

export const NO_SECRETS_NOTE =
  "Never type passwords, API secrets, or tokens into Kaivaryn forms or email. Access is granted through the vendor's own screen, or handed over live with your Kaivaryn lead during setup.";

export const KAIVARYN_DOES: Record<ConnectionMethod, string[]> = {
  oauth: [
    "Schedules a short setup call and sends you the vendor's authorization link at that time.",
    "Requests read-only scopes wherever the vendor offers them.",
    "Maps the fields we receive to your intake answers (locations, pipelines, entities).",
    "Runs a first pull and shows you what arrived before anything is used.",
  ],
  api_credentials: [
    "Walks you through creating read-only credentials on a screen-share — you never email them.",
    "Stores credentials only in Kaivaryn's secured connection settings, never in notes or forms.",
    "Maps the fields we receive to your intake answers.",
    "Runs a first pull and shows you what arrived before anything is used.",
  ],
  partner_request: [
    "Prepares the access request wording for you or your account rep.",
    "Starts with a back-office export so you see value while the request is reviewed.",
    "Switches to the direct path only once the vendor grants it.",
    "Never claims an approved partnership — the vendor decides on access.",
  ],
  export: [
    "Gives you the exact report list and a column-mapping template.",
    "Imports the first file with you through File import and checks the columns.",
    "Sets up a recurring drop (scheduled email or shared folder) where your system supports it.",
    "Flags any gaps between files and your intake answers.",
  ],
  database: [
    "Sends your IT team a least-privilege read-only access request.",
    "Agrees on the exact tables or views to read — nothing else.",
    "Runs a first read and shows you row counts before anything is used.",
    "Documents the connection for your security review.",
  ],
  file: [
    "Gives you a column template and imports the first file with you.",
    "Checks the mapping and flags missing or unexpected columns.",
    "Agrees a cadence for future files.",
  ],
};

export const VERIFICATION = [
  "Connected means data has actually arrived in Kaivaryn — not that a step was ticked.",
  "Verified means your Kaivaryn lead compared a sample (for example one day or one week of totals) against a report you trust and the numbers matched.",
  "If anything doesn't match, the system stays at Connected until it's resolved, and you'll see why.",
];

export const LADDER_NOTE = "Selected → Connection planned → Configured → Connected → Verified. Ticking checklist items helps you prepare; it never marks a system connected.";
