import type { VendorGuide } from "./types";
import { g } from "./make";

const SUPPORT_SHARE = ["Tickets / conversations with status, priority, assignee, and created / resolved times", "Queues / groups and SLA targets", "Agent / team roster"];
const COMMERCE_SHARE = ["Orders with line items, discounts, refunds, and fulfillment status", "Customers (business fields)", "Products and variants", "Abandoned checkouts (if tracked)"];

export const SUPPORT_GUIDES: VendorGuide[] = [
  g("zendesk", "api_credentials", "support", "Zendesk admins can create an API token or an OAuth client in Admin Center.",
    ["A Zendesk admin."],
    ["In Admin Center, open Apps and integrations → APIs.", "On the setup call, create an API token for a dedicated agent, or an OAuth client for Kaivaryn, with your lead on screen.", "Hand the token / credentials over live — never by email or in this form.", "Add your queues, SLA targets, and business hours to the intake below."],
    SUPPORT_SHARE, ["Export tickets from Views / Explore as CSV and upload them in Kaivaryn → Imports."],
    "https://support.zendesk.com/hc/en-us/articles/8889508417946-Managing-OAuth-token-access-to-the-API"),
  g("intercom", "api_credentials", "support", "Intercom workspace admins install an app in the Developer Hub and receive a workspace access token.",
    ["An Intercom workspace admin / owner."],
    ["On the setup call, your Kaivaryn lead confirms the Intercom app install for your workspace.", "Approve the install in Intercom's Developer Hub / App Store flow.", "Hand the access token over live — never by email or in this form.", "Add your inboxes / teams and business hours to the intake below."],
    SUPPORT_SHARE, ["Export conversation reports from Intercom Reports and upload them in Kaivaryn → Imports."],
    "https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/installing-uninstalling-apps"),
  g("servicenow", "api_credentials", "support", "ServiceNow grants access through an OAuth Application Registry entry and a dedicated integration user with a least-privilege role.",
    ["A ServiceNow admin who can create users and OAuth clients."],
    ["Create a dedicated integration user with a read-only role covering the tables in scope (for example incident, sc_req_item).", "Create System OAuth → Application Registry → Create an OAuth API endpoint for external clients.", "On the setup call, complete the OAuth handshake with your Kaivaryn lead.", "Add your queues / assignment groups and SLA targets to the intake below."],
    SUPPORT_SHARE, ["Export incidents / requests from a list view as CSV and upload them in Kaivaryn → Imports."],
    "https://www.servicenow.com/docs/r/washingtondc/application-development/app-engine-studio/create-oauth-api-endpoints-for-external-clients.html"),
  g("jira_service", "oauth", "support", "Jira Service Management is authorized through Atlassian's OAuth (3LO) or an API token created by an admin.",
    ["A Jira / Atlassian admin for the site."],
    ["On the setup call, approve Kaivaryn's read-only access on Atlassian's authorization screen, or create an API token for a dedicated user.", "Limit access to the Service projects and request types in scope.", "Add your queues and SLAs to the intake below."],
    SUPPORT_SHARE, ["Export issues from a JQL filter as CSV and upload them in Kaivaryn → Imports."],
    "https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/"),
];

export const COMMERCE_GUIDES: VendorGuide[] = [
  g("shopify", "oauth", "commerce", "Shopify store owners install a custom app (or approve an OAuth install link) and grant the listed scopes.",
    ["The Shopify store owner (or a staff member with permission to install apps).", "Custom apps must be enabled for the store."],
    ["On the setup call, open the install link your Kaivaryn lead sends, or create a custom app under Settings → Apps and sales channels → Develop apps.", "Approve read scopes for orders, products, customers, and inventory.", "Hand any Admin API access token over live — never by email or in this form.", "Add your store names and currency to the intake below."],
    COMMERCE_SHARE, ["Export Orders from Shopify Admin → Orders → Export and upload them in Kaivaryn → Imports."],
    "https://shopify.dev/docs/apps/launch/distribution/select-distribution-method"),
  g("woocommerce", "api_credentials", "commerce", "WooCommerce REST API keys are created in WordPress under WooCommerce → Settings → Advanced → REST API.",
    ["A WordPress admin for the store.", "WooCommerce permalinks set to anything other than Plain."],
    ["In WordPress, open WooCommerce → Settings → Advanced → REST API → Add key.", "Set permissions to Read and assign it to a dedicated user.", "Hand the consumer key and secret to your Kaivaryn lead live on the call.", "Add your store names and currency to the intake below."],
    COMMERCE_SHARE, ["Export orders from WooCommerce → Reports / Orders and upload them in Kaivaryn → Imports."],
    "https://woocommerce.com/document/woocommerce-rest-api/"),
  g("magento", "api_credentials", "commerce", "Adobe Commerce / Magento creates Integration tokens under System → Extensions → Integrations.",
    ["A Magento admin with access to System → Extensions → Integrations."],
    ["Create a new Integration named “Kaivaryn (read-only)” with only the resource scopes agreed on the call.", "Activate and authorize the integration on the setup call; hand the access token over live.", "Add your store views and currency to the intake below."],
    COMMERCE_SHARE, ["Export orders from Magento reports and upload them in Kaivaryn → Imports."],
    "https://developer.adobe.com/commerce/webapi/get-started/authentication/gs-authentication-token/"),
  g("chargebee", "api_credentials", "subscriptions", "Chargebee API keys are created in Settings → Configure Chargebee → API Keys, with read-only keys available.",
    ["A Chargebee admin."],
    ["In Chargebee, open Settings → Configure Chargebee → API Keys.", "Create a Read-Only key named “Kaivaryn”.", "Hand the key to your Kaivaryn lead live on the call.", "Add your plans and dunning policy to the intake below."],
    ["Subscriptions and invoices", "Customers", "Cancellations and refunds", "Plans and prices"],
    ["Export subscriptions / invoices from Chargebee reports and upload them in Kaivaryn → Imports."],
    "https://www.chargebee.com/docs/2.0/api_keys.html"),
];
