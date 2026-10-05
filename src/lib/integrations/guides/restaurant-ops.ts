import type { VendorGuide } from "./types";
import { CONFIRM } from "./shared";
import { g } from "./make";

const LABOR_SHARE = ["Scheduled vs. actual hours by role and day", "Labor cost / wages by shift (if you track wages here)", "Overtime and break compliance"];
const INV_SHARE = ["Invoices with line items and vendors", "Inventory counts and usage", "Recipe / item costs", "Actual vs. theoretical food cost and waste, if tracked"];

export const LABOR_GUIDES: VendorGuide[] = [
  g("sevenshifts", "api_credentials", "labor", "7shifts lets company admins create a self-service access token in Developer Tools; the Hours & Wages report is the main labor source.",
    ["A 7shifts account admin.", `Plan requirements for Developer Tools — ${CONFIRM}.`],
    ["Sign in to 7shifts as an account admin.", "Open Company Settings → Developer Tools.", "On the setup call, create an access token with your Kaivaryn lead on screen and hand it over live — never by email or in this form.", "Add your location names, pay period, and overtime rule to the intake below."],
    LABOR_SHARE, ["Export the Hours & Wages report weekly as CSV and upload it in Kaivaryn → Imports."],
    "https://developers.7shifts.com/reference/authentication"),
  g("hotschedules", "export", "labor", "HotSchedules (Fourth) labor reports export from Reporting; direct data access goes through Fourth.",
    ["A HotSchedules manager login with Reporting access."],
    ["Sign in to HotSchedules and open Reporting → Labor Analysis.", "Run the Employee Hours report (scheduled and actual) for the last full week.", "Export it and upload the file in Kaivaryn → Imports.", `Any direct feed is requested through Fourth and ${CONFIRM}.`],
    LABOR_SHARE, ["Run and export the Employee Hours report weekly."],
    "https://help.hotschedules.com/hc/en-us/articles/214872808-HS-Employee-Hours-Report"),
  g("homebase", "export", "labor", "Homebase timesheets download as CSV from the Timesheets page.",
    ["A Homebase manager or owner login."],
    ["Sign in to Homebase and open Timesheets.", "Pick the last pay period and choose View Summary.", "Select Download to save the CSV and upload it in Kaivaryn → Imports."],
    LABOR_SHARE, ["Download the timesheet summary each pay period and upload it."],
    "https://support.joinhomebase.com/s/article/Step-7-Downloading-Exporting-Printing-Timesheets"),
];

export const INVENTORY_GUIDES: VendorGuide[] = [
  g("marketman", "partner_request", "inventory", "MarketMan offers an API with credentials issued by MarketMan; most restaurants start with MarketMan's Excel exports.",
    ["A MarketMan admin login.", "Your MarketMan account contact, if you want API access."],
    ["Sign in to MarketMan.", "Export invoices (Accounting → Invoices, Generic Excel export) and your latest inventory count.", "Upload the files in Kaivaryn → Imports.", `Ask MarketMan about API access for Kaivaryn — issued by MarketMan and ${CONFIRM}.`],
    INV_SHARE, ["Export invoices and counts weekly after your count is closed."],
    "https://mealticket.my.site.com/helpcenter/s/article/Introduction-to-MarketMan-API"),
  g("marginedge", "partner_request", "inventory", "MarginEdge has a read-only public API and CSV exports from its reports.",
    ["A MarginEdge admin login.", `API access setup — ${CONFIRM}.`],
    ["Sign in to MarginEdge and open the Category report (or Setup → Integrations → Exports → Line Items).", "Set the date range and choose Export As → CSV.", "Upload the CSV in Kaivaryn → Imports.", "If you prefer the read-only API, your Kaivaryn lead walks you through MarginEdge's access steps on a call."],
    INV_SHARE, ["Export the line-item purchasing CSV weekly."],
    "https://help.marginedge.com/hc/en-us/articles/28081506932499-MarginEdge-Public-API"),
  g("restaurant365", "api_credentials", "inventory", "Restaurant365 provides a read-only OData connector for reporting tools, used with an R365 user you create.",
    ["An R365 admin who can create users and set permissions.", `Whether your R365 subscription includes the OData connector — ${CONFIRM}.`],
    ["Create a dedicated R365 user for Kaivaryn with read-only reporting permissions.", "Limit it to the locations and legal entities in scope.", "On the setup call, connect the OData connector with your Kaivaryn lead; the user's sign-in is handed over live, never by email or in this form.", "Add your entities, locations, and fiscal calendar to the intake below."],
    [...INV_SHARE, "GL transactions and P&L by location", "Sales detail and labor (if kept in R365)"], ["Export the P&L and inventory reports weekly and upload them in Kaivaryn → Imports."],
    "https://docs.restaurant365.com/docs/restaurant365-odata-connector"),
  g("xtrachef", "export", "inventory", "xtraCHEF by Toast exports processed invoices as CSV from the Extract Monitor.",
    ["An xtraCHEF user with access to Extract Monitor and Reporting."],
    ["Sign in to xtraCHEF and open Extract Monitor.", "Choose your location and date range and a CSV extract type.", "Download the CSV and upload it in Kaivaryn → Imports.", "Optionally export recipe costing and inventory reports from the Reporting module."],
    INV_SHARE, ["Run the CSV extract weekly and upload it."],
    "https://support.toasttab.com/en/article/xtraCHEF-Extract-Monitor"),
];
