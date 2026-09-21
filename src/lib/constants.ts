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
  { id: "welcome", title: "Welcome", description: "Confirm organization profile" },
  { id: "products", title: "Products", description: "Select Revenue Recovery and/or Operations Efficiency" },
  { id: "integrations", title: "Integrations", description: "Review available data connections" },
  { id: "team", title: "Team", description: "Invite colleagues (optional)" },
  { id: "done", title: "Ready", description: "Enter the command center" },
] as const;
