import type { VendorGuide } from "./types";
import { CONFIRM } from "./shared";

const SHARE = [
  "Sales summary by day and by hour (with covers / guest count)",
  "Check-level detail: items, discounts, comps, voids, and refunds with employee and reason",
  "Product / menu mix report",
  "Payments by tender type, including tips",
  "Labor: time punches, breaks, and hours by role",
];
const EXPORT = (where: string) => [
  `In ${where}, export each report above for the last full week as CSV.`,
  "Upload the files once in Kaivaryn → Imports so the columns can be mapped.",
  `Then schedule the same reports by email (daily or weekly) where your system offers it — exact menu ${CONFIRM}.`,
];

export const POS_GUIDES_2: VendorGuide[] = [
  {
    key: "pos_touchbistro", method: "export", intake: "pos",
    methodNote: "TouchBistro's API is limited to approved integration partners, so the dependable path is TouchBistro Cloud report exports.",
    prerequisites: ["A TouchBistro Cloud login with access to Reports.", "Your TouchBistro account rep's contact, if you want to ask about direct access."],
    steps: [
      "Sign in to TouchBistro Cloud and open Reports.",
      "Export the reports below for the last full week as CSV.",
      "Upload them in Kaivaryn → Imports and map columns with your Kaivaryn lead.",
      "Set up a recurring email or export of the same reports (see below).",
    ],
    share: SHARE,
    exportFallback: EXPORT("TouchBistro Cloud → Reports"),
    sourceUrl: "https://www.touchbistro.com/features/reporting-analytics/",
  },
  {
    key: "pos_revel", method: "api_credentials", intake: "pos",
    methodNote: "Revel admins can generate API credentials for their own account through the Revel Data Connector in the Management Console.",
    prerequisites: ["A Revel Management Console admin with access to all establishments.", `Whether the Revel Data Connector is enabled on your account — ${CONFIRM}.`],
    steps: [
      "Sign in to the Revel Management Console as an admin with access to all establishments.",
      "Open Settings and search for “Revel Data Connector”.",
      "On the setup call, choose Manage Credentials → Generate Credentials with your Kaivaryn lead on screen.",
      "Hand the key and secret to your lead live on the call — never by email or in this form.",
      "Add your establishment names and IDs to the intake below.",
    ],
    share: SHARE,
    exportFallback: EXPORT("the Revel Management Console → Reports"),
    sourceUrl: "https://developer.revelsystems.com/revelsystems/docs/how-to-get-credentials",
  },
  {
    key: "pos_aloha", method: "partner_request", intake: "pos",
    methodNote: "NCR Voyix offers APIs through its developer platform; for Aloha Cloud, API access is allowed per merchant in the Admin settings. Many Aloha sites also work through a reseller.",
    prerequisites: ["An Aloha admin user, or your NCR Voyix reseller / support contact.", "Whether you're on Aloha Cloud or on-premise Aloha (the path differs)."],
    steps: [
      "Tell your Kaivaryn lead whether you're on Aloha Cloud or on-premise Aloha, and who your reseller is.",
      "Aloha Cloud: an admin opens Settings & Privacy → Admin → Merchant Settings and checks the API Access setting with your lead.",
      `On-premise Aloha: your reseller or NCR Voyix confirms the data access route — ${CONFIRM}.`,
      "Meanwhile, export the reports below from Aloha back-office reporting.",
      "Add your site names and site / store IDs to the intake below.",
    ],
    share: SHARE,
    exportFallback: EXPORT("Aloha back-office reporting"),
    sourceUrl: "https://docs.ncrvoyix.com/restaurant/aloha-cloud/implementing/settings/configuring_admin",
  },
  {
    key: "pos_simphony", method: "api_credentials", intake: "pos",
    methodNote: "Oracle MICROS Simphony enterprises create a Business Intelligence API account in Reporting and Analytics; your IT team or integrator usually does this.",
    prerequisites: ["A Reporting and Analytics user with the privilege to manage API accounts.", "Your enterprise short name and the locations / levels in scope."],
    steps: [
      "In Reporting and Analytics, open Administration → System → API Accounts → Add API Account.",
      "Choose type Business Intelligence API, name the account (for example “kaivaryn-readonly”), and set the owner email to your IT contact.",
      "Select only the locations / levels and data permissions agreed with your Kaivaryn lead.",
      "The owner sets the account password from Oracle's welcome email and hands access over live with your lead.",
      "Add your enterprise short name and location list to the intake below.",
    ],
    share: [...SHARE, "Kitchen / ticket-time data where available"],
    exportFallback: EXPORT("Reporting and Analytics"),
    sourceUrl: "https://docs.oracle.com/en/industries/food-beverage/back-office/20.1/rause/c_BI_API_permissions.htm",
  },
  {
    key: "pos_heartland", method: "partner_request", intake: "pos",
    methodNote: "Heartland Restaurant can expose a per-location API key in its Admin Portal, but Heartland says to share it only with certified integrators or with management approval. Kaivaryn is not a certified Heartland integrator.",
    prerequisites: ["A Heartland Restaurant Admin Portal user for each location.", "Approval from Heartland / your management before any API key is shared."],
    steps: [
      "Sign in to the Heartland Restaurant Admin Portal and choose the location.",
      "Export the reports below and upload them in Kaivaryn → Imports.",
      `Ask Heartland whether API access can be approved for Kaivaryn (Integrations → API in the Admin Portal); approval is ${CONFIRM}.`,
      "Do not generate or send an API key unless that approval is in place.",
      "Add your location names and IDs to the intake below.",
    ],
    share: SHARE,
    exportFallback: EXPORT("the Heartland Restaurant Admin Portal → Reports"),
    sourceUrl: "https://pos.heartlandpaymentsystems.com/kb/kb_upload/file/Heartland%20Restaurant%20-%203rd%20Party%20Integration%20Configuration.pdf",
  },
];
