/** String enums for SQLite (Prisma SQLite has no native enums). */

export const Role = {
  SUPER_ADMIN: "SUPER_ADMIN",
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  ANALYST: "ANALYST",
  VIEWER: "VIEWER",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Product = {
  REVENUE_RECOVERY: "REVENUE_RECOVERY",
  OPERATIONS_EFFICIENCY: "OPERATIONS_EFFICIENCY",
} as const;
export type Product = (typeof Product)[keyof typeof Product];

/** RR lifecycle — financial stages align with potential/approved/in-progress/recovered/verified */
export const OpportunityStatus = {
  IDENTIFIED: "IDENTIFIED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  IN_RECOVERY: "IN_RECOVERY",
  PARTIALLY_RECOVERED: "PARTIALLY_RECOVERED",
  RECOVERED: "RECOVERED",
  VERIFIED: "VERIFIED",
  DISMISSED: "DISMISSED",
  // legacy aliases accepted in transitions
  NEW: "NEW",
  IN_PROGRESS: "IN_PROGRESS",
} as const;
export type OpportunityStatus = (typeof OpportunityStatus)[keyof typeof OpportunityStatus];

export const OpportunityPriority = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;
export type OpportunityPriority = (typeof OpportunityPriority)[keyof typeof OpportunityPriority];

/** OE lifecycle — projected vs realized */
export const InefficiencyStatus = {
  IDENTIFIED: "IDENTIFIED",
  ANALYZING: "ANALYZING",
  APPROVED: "APPROVED",
  IMPLEMENTING: "IMPLEMENTING",
  REALIZED: "REALIZED",
  VERIFIED: "VERIFIED",
  DISMISSED: "DISMISSED",
  NEW: "NEW",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
} as const;
export type InefficiencyStatus = (typeof InefficiencyStatus)[keyof typeof InefficiencyStatus];

export const InefficiencyPriority = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;
export type InefficiencyPriority = (typeof InefficiencyPriority)[keyof typeof InefficiencyPriority];

export const DemoRequestStatus = {
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  QUALIFIED: "QUALIFIED",
  SCHEDULED: "SCHEDULED",
  DEMO_COMPLETED: "DEMO_COMPLETED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  CLOSED_WON: "CLOSED_WON",
  CLOSED_LOST: "CLOSED_LOST",
} as const;
export type DemoRequestStatus = (typeof DemoRequestStatus)[keyof typeof DemoRequestStatus];

export const IntegrationStatus = {
  AVAILABLE: "AVAILABLE",
  CONNECTED: "CONNECTED",
  NEEDS_CONFIG: "NEEDS_CONFIG",
  ERROR: "ERROR",
} as const;
export type IntegrationStatus = (typeof IntegrationStatus)[keyof typeof IntegrationStatus];

export const RR_STATUSES = [
  "IDENTIFIED",
  "UNDER_REVIEW",
  "APPROVED",
  "IN_RECOVERY",
  "PARTIALLY_RECOVERED",
  "RECOVERED",
  "VERIFIED",
  "DISMISSED",
] as const;

export const OE_STATUSES = [
  "IDENTIFIED",
  "ANALYZING",
  "APPROVED",
  "IMPLEMENTING",
  "REALIZED",
  "VERIFIED",
  "DISMISSED",
] as const;
