import type { VendorGuide } from "./types";
import { CONFIRM } from "./shared";
import { g } from "./make";

const CRM_SHARE = ["Opportunities / deals with stage, amount, close date, and owner", "Accounts / companies and contacts (business fields only)", "Stage history and activity dates", "Users / owners and teams"];
const CRM_EXPORT = (where: string) => [`Export opportunities / deals and accounts from ${where} as CSV.`, "Upload them once in Kaivaryn → Imports to map columns.", `Schedule a recurring export (weekly) where your plan allows — exact option ${CONFIRM}.`];

export const CRM_GUIDES: VendorGuide[] = [
  g("salesforce", "oauth", "crm", "Salesforce grants access through a connected app and OAuth sign-in, using a dedicated integration user with read-only permissions.",
    ["A Salesforce admin.", "Enterprise, Unlimited, Performance, or Developer Edition (API included). Professional Edition needs the Web Services API add-on; Group and Essentials editions don't offer API access."],
    ["Your admin creates a dedicated integration user (the Salesforce Integration user license works well) with the API Enabled permission.", "Give that user a read-only permission set covering Opportunities, Accounts, Contacts, and Users.", "On the setup call, sign in as that user on Salesforce's own authorization screen and approve access.", "Add your pipelines, stages, and team structure to the intake below."],
    CRM_SHARE, CRM_EXPORT("Salesforce Reports (or Data Export in Setup)"),
    "https://help.salesforce.com/s/articleView?id=000326486&language=en_US&type=1"),
  g("hubspot", "api_credentials", "crm", "HubSpot super admins (or users with Developer tools access) can create a private app limited to the read scopes you choose.",
    ["A HubSpot super admin, or a user with the Developer tools access permission.", "Some objects (for example custom objects) depend on your HubSpot tier."],
    ["In HubSpot, open Development → Legacy apps → Create legacy app → Private (labels can change; your lead confirms on the call).", "Name it “Kaivaryn (read-only)” and add only read scopes: deals, companies, contacts, owners.", "Create the app and hand the access token to your Kaivaryn lead live on the call — never by email or in this form.", "Add your pipelines, deal stages, and teams to the intake below."],
    CRM_SHARE, CRM_EXPORT("HubSpot (Deals view → Export)"),
    "https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview"),
  g("dynamics365", "api_credentials", "crm", "Dynamics 365 / Dataverse uses a Microsoft Entra app registration plus an application user with a least-privilege security role.",
    ["A Microsoft Entra admin to register the app.", "A Power Platform admin for the target environment."],
    ["Your Entra admin registers an app for Kaivaryn in the Microsoft Entra admin center.", "In the Power Platform admin center: Environments → your environment → Settings → Users + permissions → Application users → New app user.", "Add the app, pick the business unit, and assign a custom read-only security role (not System Administrator).", "Hand the app credentials to your Kaivaryn lead live on the call.", "Add your environment name, pipelines, and teams to the intake below."],
    CRM_SHARE, CRM_EXPORT("Dynamics 365 views (Export to Excel)"),
    "https://learn.microsoft.com/en-us/power-apps/developer/data-platform/walkthrough-register-app-azure-active-directory"),
  g("zoho", "oauth", "crm", "Zoho CRM API access uses OAuth clients registered in the Zoho Developer Console, approved by a Zoho CRM admin.",
    ["A Zoho CRM administrator.", `API availability by Zoho CRM edition — ${CONFIRM}.`],
    ["On the setup call, your admin approves Kaivaryn's read-only access on Zoho's own consent screen.", "Limit scopes to reading deals, accounts, contacts, and users.", "Add your pipelines, stages, and roles to the intake below."],
    CRM_SHARE, CRM_EXPORT("Zoho CRM (Setup → Data Administration → Export)"),
    "https://www.zoho.com/crm/developer/docs/api/v8/register-client.html"),
  g("pipedrive", "oauth", "crm", "Pipedrive apps use OAuth; the user approves listed scopes on Pipedrive's install screen. Kaivaryn has no Marketplace app, so your lead confirms the route.",
    ["A Pipedrive admin (some scopes require admin rights)."],
    ["On the setup call, your Kaivaryn lead confirms the access route for your account.", "If OAuth: approve read-only scopes on Pipedrive's screen (deals, organizations, people, users).", "Otherwise export deals and organizations as CSV and upload them in Kaivaryn → Imports.", "Add your pipelines and stages to the intake below."],
    CRM_SHARE, CRM_EXPORT("Pipedrive (Deals list → Export)"),
    "https://pipedrive.readme.io/docs/marketplace-oauth-authorization"),
];
