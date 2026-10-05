import type { VendorGuide } from "./types";
import { CONFIRM } from "./shared";
import { g } from "./make";

const ACCT_SHARE = ["Chart of accounts", "Invoices and payments (AR)", "Bills and payments (AP) if in scope", "Customers / vendors", "Bank reconciliation status (summary)"];
const ACCT_EXPORT = (where: string) => [`Export invoices, payments, and the chart of accounts from ${where} as CSV or Excel.`, "Upload them once in Kaivaryn → Imports.", `Schedule a recurring export if available — ${CONFIRM}.`];

export const FINANCE_GUIDES: VendorGuide[] = [
  g("stripe", "api_credentials", "payments", "Stripe lets you create a restricted API key with Read-only permissions for the resources you choose.",
    ["A Stripe Dashboard user who can create API keys (typically an admin)."],
    ["In Stripe Dashboard, open Developers → API keys → Create restricted key.", "Name it “Kaivaryn (read-only)” and start from zero permissions.", "Set Read on Charges, Customers, Invoices, Subscriptions, Refunds, Disputes, Balance transactions, and Payouts — leave everything else None.", "Create the key and hand it to your Kaivaryn lead live on the call — never by email or in this form.", "Add your account name(s) and currency to the intake below."],
    ["Charges, refunds, and disputes", "Invoices and subscriptions", "Payouts and balance transactions", "Customer records (business fields)"],
    ["Export Payments and Invoices from the Dashboard as CSV and upload them in Kaivaryn → Imports."],
    "https://docs.stripe.com/keys/restricted-api-keys"),
  g("quickbooks", "oauth", "accounting", "QuickBooks Online apps are authorized by a company admin on Intuit's own sign-in screen.",
    ["A QuickBooks Online company admin (primary admin / company admin).", "QuickBooks Online (Desktop is a different path — tell your lead if you're on Desktop)."],
    ["On the setup call, open the Intuit authorization link your Kaivaryn lead sends.", "Sign in as company admin and approve the read-only scopes (Accounting).", "You can disconnect the app later from QuickBooks → Apps.", "Add your fiscal year start, chart-of-accounts approach, AR terms, and entities to the intake below."],
    ACCT_SHARE, ACCT_EXPORT("QuickBooks Online (Reports → Export)"),
    "https://help.developer.intuit.com/s/article/Platform-Which-users-can-subscribe-to-QBO-apps"),
  g("xero", "oauth", "accounting", "Xero apps are authorized by a user with Standard, Adviser, or Administrator access and the Connected Apps permission.",
    ["A Xero user with Standard, Adviser, or Administrator access and Connected Apps permission.", "Reports access if reporting data is in scope; Payroll Admin if payroll is in scope."],
    ["On the setup call, open the Xero authorization link your Kaivaryn lead sends.", "Choose the organisation and approve access.", "You can disconnect later from Xero → Settings → Connected apps.", "Add your fiscal calendar, entities, and AR terms to the intake below."],
    ACCT_SHARE, ACCT_EXPORT("Xero (Reports → Export)"),
    "https://developer.xero.com/faq/permissions"),
  g("netsuite", "api_credentials", "erp", "NetSuite uses Token-Based Authentication with a dedicated integration record and a least-privilege role.",
    ["A NetSuite administrator.", "Token-Based Authentication enabled (Setup → Company → Enable Features → SuiteCloud → Manage Authentication)."],
    ["Create a dedicated NetSuite role with only the read permissions Kaivaryn needs, plus “Log in using Access Tokens”.", "Assign that role to a dedicated integration user.", "Create Setup → Integration → Manage Integrations → New with Token-based Authentication checked.", "On the setup call, create the access token and hand the credentials to your Kaivaryn lead live — never by email or in this form.", "Add your subsidiaries, fiscal calendar, and modules to the intake below."],
    [...ACCT_SHARE, "Sales orders and inventory (if in scope)", "Subsidiaries / entities"],
    ACCT_EXPORT("NetSuite saved searches / SuiteAnalytics"),
    "https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/bridgehead_4248124361.html"),
  g("sap", "partner_request", "erp", "SAP S/4HANA Cloud integrations use communication arrangements and communication users set up by your Basis / IT team. On-premise SAP is a different path.",
    ["Your SAP Basis / IT contact.", "Whether you're on S/4HANA Cloud or on-premise."],
    ["Tell your Kaivaryn lead which SAP product and edition you run.", "Your IT team creates a communication arrangement and a least-privilege communication user for the APIs agreed on the call.", "Hand access over live with your Kaivaryn lead; never share passwords by email.", "Meanwhile, export AR aging, open invoices, and P&L by company code from SAP and upload them in Kaivaryn → Imports."],
    [...ACCT_SHARE, "Company codes / plants in scope"],
    ACCT_EXPORT("SAP reporting / FI extracts"),
    "https://learning.sap.com/courses/implementing-sap-s-4hana-cloud-public-edition-sourcing-and-procurement/setting-up-communication-management_a913171c-c96d-47a9-81ec-dc9ee8754320"),
  g("sage", "partner_request", "accounting", "Sage covers several products (Intacct, 50, 100, X3). Intacct uses Web Services users and a Sender ID; others usually start with exports.",
    ["Confirm which Sage product you use.", "An admin for that product."],
    ["Tell your Kaivaryn lead which Sage product (Intacct, 50, 100, X3, or other).", "Sage Intacct: create a Web Services–only user with a least-privilege role; Kaivaryn's Sender ID is authorized under Company → Security on a call.", "Other Sage products: export AR, AP, and the chart of accounts and upload them in Kaivaryn → Imports.", "Add your entities and fiscal calendar to the intake below."],
    ACCT_SHARE, ACCT_EXPORT("your Sage reports"),
    "https://developer.intacct.com/support/faq/"),
];
