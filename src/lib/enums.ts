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

export const OpportunityStatus = {
  NEW: "NEW",
  IN_PROGRESS: "IN_PROGRESS",
  RECOVERED: "RECOVERED",
  DISMISSED: "DISMISSED",
} as const;
export type OpportunityStatus = (typeof OpportunityStatus)[keyof typeof OpportunityStatus];

export const OpportunityPriority = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;
export type OpportunityPriority = (typeof OpportunityPriority)[keyof typeof OpportunityPriority];

export const InefficiencyStatus = {
  NEW: "NEW",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  DISMISSED: "DISMISSED",
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
