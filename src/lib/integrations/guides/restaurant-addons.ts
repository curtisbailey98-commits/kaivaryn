import type { VendorGuide } from "./types";
import { CONFIRM } from "./shared";
import { g } from "./make";

const DELIVERY_SHARE = ["Order / transaction detail with fees and commissions", "Error charges, adjustments, and refunds", "Payout summary", "Store-level operations (cancellations, ratings) if available"];
const RES_SHARE = ["Reservations by date and shift (covers, party size, status)", "No-shows and cancellations", "Guest records you're allowed to share (visits, tags) — no card data"];

export const DELIVERY_GUIDES: VendorGuide[] = [
  g("doordash", "export", "delivery", "DoorDash's Merchant Portal report builder exports CSVs and can schedule them weekly or monthly. DoorDash also has a Reporting API; access is confirmed with DoorDash.",
    ["A Merchant Portal user with Admin or Manager access for the stores in scope."],
    ["Sign in to the DoorDash Merchant Portal and select Reports.", "Select Create report → Financial Report.", "Choose Recurring schedule → Weekly, and include transaction details and order item details.", "Download the first CSV and upload it in Kaivaryn → Imports.", "Add your store names and store IDs to the intake below."],
    DELIVERY_SHARE, ["Use the recurring weekly Financial Report — DoorDash emails a download link each time.", "Download links stay in Reports for 7 days, so upload each one to Kaivaryn within the week."],
    "https://help.doordash.com/en-us/merchants/article/merchant-portal-reports"),
  g("ubereats", "export", "delivery", "Uber Eats Manager lets you request Payment Details reports as CSV downloads.",
    ["An Uber Eats Manager login for the locations in scope."],
    ["Sign in to Uber Eats Manager (restaurant.uber.com) from a computer.", "Open Reports → Request Reports.", "Choose Payment Details, the locations, and up to 31 days.", "When the status shows Available, download the CSV and upload it in Kaivaryn → Imports.", "Add your store names and IDs to the intake below."],
    DELIVERY_SHARE, ["Request the Payment Details report weekly (it covers up to 31 days).", "Reports expire 48 hours after they're ready, so download promptly."],
    "https://help.uber.com/en/merchants-and-restaurants/article/download-comprehensive-payment-details-reports?nodeId=9b436c1f-485a-46d9-9361-12fec294c368"),
  g("grubhub", "export", "delivery", "Grubhub for Restaurants offers transaction CSV reports in its Financials area.",
    ["An administrator login for Grubhub for Restaurants."],
    ["Sign in to Grubhub for Restaurants.", "Open Financials → Reports and request a CSV transaction report for the last full week.", "Upload the CSV in Kaivaryn → Imports.", `Turn on daily transaction summary emails if available — menu ${CONFIRM}.`, "Add your restaurant names and IDs to the intake below."],
    DELIVERY_SHARE, ["Request the CSV report weekly and upload it to Kaivaryn."],
    "https://get.grubhub.com/help-center/grubhub-payments-finances/"),
  g("olo", "export", "delivery", "Olo is used by brands and groups; Olo Dashboard Insights reports download as CSV.",
    ["An Olo Dashboard user with access to Insights for your brand."],
    ["Sign in to the Olo Dashboard and open Insights.", "Choose the report, date range, and stores.", "Select Download CSV Report (it downloads a ZIP of CSVs).", "Upload the CSVs in Kaivaryn → Imports.", `Any direct data feed for your brand is ${CONFIRM}.`],
    ["Orders by store and channel", "Refunds and adjustments", "Store-level sales"], ["Download the Insights CSVs weekly and upload them to Kaivaryn."],
    "https://olosupport.zendesk.com/hc/en-us/articles/46309148654363-Download-CSV-Report"),
  g("chownow", "export", "delivery", "The ChowNow Dashboard exports order history and analytics as CSV.",
    ["A ChowNow Dashboard login for your locations."],
    ["Sign in at dashboard.chownow.com.", "Open Reports → Order History, pick the date range, and select Export.", "Optionally export Reports → Analytics too.", "Upload the CSVs in Kaivaryn → Imports."],
    ["Order history with totals, fees, and refunds", "Sales analytics"], ["Export Order History weekly and upload it to Kaivaryn."],
    "https://get.chownow.com/restaurant-support/how-to-run-reports/"),
];

export const RESERVATION_GUIDES: VendorGuide[] = [
  g("opentable", "export", "reservations", "OpenTable for Restaurants exports reservation reports and guest data from its Reporting area.",
    ["An OpenTable for Restaurants user with access to Reporting."],
    ["Sign in to OpenTable for Restaurants and open Reporting → Reservations.", "Set the date range and shift, add the columns you need, and select Export.", "Upload the file in Kaivaryn → Imports.", "Only if you choose to: Reporting → Guest Export emails a guest CSV link — share opted-in guests only.", "Add your venue names and restaurant IDs to the intake below."],
    RES_SHARE, ["Export the Reservations report weekly and upload it to Kaivaryn."],
    "https://support.opentable.com/s/article/Reservations-Report-in-GuestCenter"),
  g("resy", "export", "reservations", "ResyOS includes Resy Analytics reports. A direct data path is not self-serve.",
    ["A ResyOS login with access to Analytics."],
    ["Sign in to ResyOS and open Analytics.", `Open the reservations and covers reports and export them — export option ${CONFIRM}.`, "Upload the file in Kaivaryn → Imports.", "Add your venue names to the intake below."],
    RES_SHARE, ["Export the reservations report weekly and upload it to Kaivaryn."],
    "https://helpdesk.resy.com/resy-analytics-BJdQMvX8_"),
  g("yelp_guest_manager", "export", "reservations", "Yelp Guest Manager lets you download your guestbook; historical reservation files may need to be requested from Yelp.",
    ["A Yelp Guest Manager admin login."],
    ["Sign in to Yelp Guest Manager.", `Download your guestbook / reservation data — exact menu ${CONFIRM}.`, "If you need history, ask Yelp support for a reservation data file.", "Upload the file in Kaivaryn → Imports."],
    RES_SHARE, ["Repeat the download monthly and upload it to Kaivaryn."],
    "https://business.yelp.com/restaurants/products/new-yelp-for-restaurants-products-features/"),
  g("sevenrooms", "export", "reservations", "SevenRooms reports can be exported and scheduled; SevenRooms also has an API that it grants separately.",
    ["A SevenRooms user with access to Reports."],
    ["Sign in to SevenRooms and open Reports → Search Reservations.", "Set the date range and select Export.", "Upload the file in Kaivaryn → Imports.", "Schedule the report to send weekly if your account allows it.", `Any API access is requested through SevenRooms and ${CONFIRM}.`],
    RES_SHARE, ["Schedule the reservations report weekly and upload it to Kaivaryn."],
    "https://sevenrooms.com/platform/reporting/"),
  g("tock", "export", "reservations", "The Tock Dashboard's Operations reports export reservations as CSV.",
    ["A Tock Dashboard user with access to Operations."],
    ["Sign in to the Tock Dashboard and choose your restaurant.", "Open Operations → Reservations and set the date range (for example Last 7 days).", "Select the download icon to export CSV.", "Upload the CSV in Kaivaryn → Imports."],
    [...RES_SHARE, "Prepaid experiences and deposits"], ["Export Last 7 days every week and upload it to Kaivaryn."],
    "https://tock.zendesk.com/hc/en-us/articles/360039542812-Using-Operations-Reports"),
];
