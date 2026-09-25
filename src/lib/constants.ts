export const APP_NAME = "Kaivaryn";
export const STRIPE_PAYMENT_LINK_FALLBACK =
  "https://buy.stripe.com/14AaEZgJsdDNeTFePLeUU01";

export const ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "ADMIN",
  "MANAGER",
  "ANALYST",
  "VIEWER",
] as const;

export const PRODUCTS = ["REVENUE_RECOVERY", "OPERATIONS_EFFICIENCY"] as const;

export const ONBOARDING_STEPS = [
  { id: "welcome", title: "Welcome", description: "Confirm organization profile and operating role" },
  { id: "products", title: "Objectives", description: "Select Revenue Recovery and/or Operations Efficiency" },
  { id: "integrations", title: "Data sources", description: "Review available data connections" },
  { id: "team", title: "Users & roles", description: "Invite colleagues (optional)" },
  { id: "done", title: "Workspace", description: "Set first-month success and enter the command center" },
] as const;
