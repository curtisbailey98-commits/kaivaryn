import type { VendorGuide } from "./types";
import { CONFIRM } from "./shared";

const POS_SHARE = [
  "Sales summary by day and by hour (with covers / guest count)",
  "Check-level detail: items, discounts, comps, voids, and refunds with employee and reason",
  "Product / menu mix report",
  "Payments by tender type, including tips",
  "Labor: time punches, breaks, and hours by role",
];
const POS_EXPORT = (where: string) => [
  `In ${where}, open each report above for the last full week and export it as CSV.`,
  "Upload the files once in Kaivaryn → Imports so the columns can be mapped.",
  `Then set the same reports to email on a schedule (daily or weekly) if your plan offers scheduled reports — exact menu ${CONFIRM}.`,
];

export const POS_GUIDES: VendorGuide[] = [
  {
    key: "pos_toast", method: "api_credentials", intake: "pos",
    methodNote: "Toast lets restaurants create their own read-only Standard API access in Toast Web. Toast's partner program is a separate, approval-based route that Kaivaryn does not claim.",
    prerequisites: [
      "A Toast Web user with the Manage Integrations permission for each location.",
      "An active Toast Restaurant Management Suite (RMS) Essentials subscription or higher (US). Outside the US, API access may be a separate subscription.",
    ],
    steps: [
      "Sign in to Toast Web and go to Integrations → Toast API access → Manage credentials.",
      "On the setup call, choose Create new credentials → Standard API with your Kaivaryn lead on screen.",
      "Select read-only scopes for orders, menus, labor, and restaurant info, and pick the locations in scope.",
      "Confirm. Toast emails the location names and GUIDs — paste the GUIDs (not the secret) into the intake below.",
      "Hand the client ID and secret to your Kaivaryn lead live on the call; never by email or in this form.",
    ],
    share: POS_SHARE,
    exportFallback: POS_EXPORT("Toast Web → Reports"),
    sourceUrl: "https://doc.toasttab.com/doc/devguide/devApiAccessRequirements.html",
  },
  {
    key: "pos_square", method: "oauth", intake: "pos",
    methodNote: "Square sellers grant access through Square's own authorization page (OAuth). Kaivaryn asks for read-only access and never writes to Square. You can disconnect in Kaivaryn (which revokes access) or remove the app from your Square Dashboard any time.",
    prerequisites: ["The Square account owner, or a team member with permission to manage apps / authorize applications.", "An Owner or Admin in Kaivaryn to press Connect Square."],
    steps: [
      "In Kaivaryn → Integrations, find the Square card and press Connect Square (Owner or Admin). If the card says Square connection isn't switched on yet, use the export route below for now.",
      "Sign in to Square and review the read-only permissions requested: merchant profile & locations, orders, and payments (including refunds).",
      "Approve. Kaivaryn pulls up to the last 90 days of orders, payments, and refunds for every location, then keeps syncing about every 15 minutes. Use Sync now any time.",
      "The Square card shows the merchant, locations, last sync, and how many records have arrived. It only says Connected once real Square data is in.",
    ],
    share: [...POS_SHARE, "Location list and hours"],
    exportFallback: POS_EXPORT("the Square Dashboard → Reports / Transactions"),
    sourceUrl: "https://developer.squareup.com/docs/oauth-api/overview",
  },
  {
    key: "pos_clover", method: "oauth", intake: "pos",
    methodNote: "Clover grants third-party access through apps installed from the Clover App Market or a privately shared app link, using OAuth. Kaivaryn does not have a published Clover app; your lead confirms the route.",
    prerequisites: ["The Clover merchant owner or an admin who can install apps.", "Your Clover plan and installed apps (features vary)."],
    steps: [
      "Sign in to the Clover web dashboard (clover.com) as owner or admin.",
      `Your Kaivaryn lead confirms whether a direct connection is available for your account; the exact install route is ${CONFIRM}.`,
      "Until then, export the reports below from the dashboard's Reports and Transactions pages.",
      "Add your merchant ID(s) — shown in the dashboard under account settings — to the intake below.",
    ],
    share: POS_SHARE,
    exportFallback: POS_EXPORT("the Clover web dashboard → Reports"),
    sourceUrl: "https://docs.clover.com/dev/docs/private-apps",
  },
  {
    key: "pos_lightspeed", method: "partner_request", intake: "pos",
    methodNote: "For Lightspeed Restaurant (K-Series), custom API access is a paid add-on requested through your Lightspeed Account Manager; Lightspeed issues one API client per business.",
    prerequisites: ["The Lightspeed business account owner or main admin.", "Agreement to Lightspeed's custom API access add-on (paid) if you want a direct connection."],
    steps: [
      "Tell your Kaivaryn lead you're on Lightspeed Restaurant and whether it's K-Series or another series.",
      "Contact your Lightspeed Account Manager to request K-Series API access; Kaivaryn gives you the request wording.",
      "Complete Lightspeed's technical contact form, naming your Kaivaryn lead as the technical contact.",
      "When Lightspeed confirms, approve access on the authorization screen with your Kaivaryn lead on the call.",
      "Meanwhile, export the reports below from Lightspeed Back Office.",
    ],
    share: POS_SHARE,
    exportFallback: POS_EXPORT("Lightspeed Back Office → Reports"),
    sourceUrl: "https://api-portal.lsk.lightspeed.app/guides/integration-guides/custom-integrations",
  },
  {
    key: "pos_spoton", method: "partner_request", intake: "pos",
    methodNote: "SpotOn controls API access through its integration partner program. Kaivaryn is not a SpotOn partner, so the practical path is SpotOn dashboard exports, with any direct access requested through SpotOn.",
    prerequisites: ["A SpotOn dashboard user who can run and export reports.", "Your SpotOn account rep's contact details."],
    steps: [
      "Sign in to the SpotOn dashboard and confirm you can open Reports.",
      "Export the reports below for the last full week as CSV and upload them in Kaivaryn → Imports.",
      `Ask your SpotOn rep whether API access is available for your location; the route is ${CONFIRM}.`,
      "Add your SpotOn location names and IDs to the intake below.",
    ],
    share: POS_SHARE,
    exportFallback: POS_EXPORT("the SpotOn dashboard → Reports"),
    sourceUrl: "https://developers.spoton.com/central-api/docs/spoton-oauth-integration-guide",
  },
];
