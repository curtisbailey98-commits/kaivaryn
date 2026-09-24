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

/** Client Acquisition Intelligence System — Kaivaryn's own sales pipeline. */
export const ProspectAccountStatus = {
  DETECTED: "DETECTED",
  RESOLVED: "RESOLVED",
  PREQUALIFIED: "PREQUALIFIED",
  RESEARCHING: "RESEARCHING",
  QUALIFIED: "QUALIFIED",
  AUDITED: "AUDITED",
  OUTREACH_READY: "OUTREACH_READY",
  CONTACTED: "CONTACTED",
  ENGAGED: "ENGAGED",
  SALES_QUALIFIED: "SALES_QUALIFIED",
  DEMO_BOOKED: "DEMO_BOOKED",
  DEMO_COMPLETED: "DEMO_COMPLETED",
  QUALIFIED_TO_BUY: "QUALIFIED_TO_BUY",
  CHECKOUT_READY: "CHECKOUT_READY",
  CHECKOUT_STARTED: "CHECKOUT_STARTED",
  PAYMENT_SUCCEEDED: "PAYMENT_SUCCEEDED",
  ONBOARDING: "ONBOARDING",
  ACTIVE: "ACTIVE",
  NURTURE: "NURTURE",
  DISQUALIFIED: "DISQUALIFIED",
  NOT_INTERESTED: "NOT_INTERESTED",
  UNSUBSCRIBED: "UNSUBSCRIBED",
  LOST: "LOST",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  ABANDONED: "ABANDONED",
  HOLD: "HOLD",
} as const;
export type ProspectAccountStatus = (typeof ProspectAccountStatus)[keyof typeof ProspectAccountStatus];

/** Forward-only backbone of the acquisition lifecycle (validated in deal-intelligence.ts).
 *  NURTURE / DISQUALIFIED / NOT_INTERESTED / UNSUBSCRIBED / HOLD / LOST / PAYMENT_FAILED / ABANDONED
 *  are reachable as exit/side states from anywhere in the backbone, not part of the linear order. */
export const PROSPECT_STATUS_BACKBONE = [
  "DETECTED",
  "RESOLVED",
  "PREQUALIFIED",
  "RESEARCHING",
  "QUALIFIED",
  "AUDITED",
  "OUTREACH_READY",
  "CONTACTED",
  "ENGAGED",
  "SALES_QUALIFIED",
  "DEMO_BOOKED",
  "DEMO_COMPLETED",
  "QUALIFIED_TO_BUY",
  "CHECKOUT_READY",
  "CHECKOUT_STARTED",
  "PAYMENT_SUCCEEDED",
  "ONBOARDING",
  "ACTIVE",
] as const;
export const PROSPECT_EXIT_STATUSES = [
  "NURTURE",
  "DISQUALIFIED",
  "NOT_INTERESTED",
  "UNSUBSCRIBED",
  "LOST",
  "PAYMENT_FAILED",
  "ABANDONED",
  "HOLD",
] as const;

export const IntentSignalStatus = { NEW: "NEW", RESOLVED: "RESOLVED", DISCARDED: "DISCARDED" } as const;
export type IntentSignalStatus = (typeof IntentSignalStatus)[keyof typeof IntentSignalStatus];

export const OutreachMessageStatus = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  BOUNCED: "BOUNCED",
  REPLIED: "REPLIED",
  FAILED: "FAILED",
} as const;
export type OutreachMessageStatus = (typeof OutreachMessageStatus)[keyof typeof OutreachMessageStatus];

export const SequenceState = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  STOPPED: "STOPPED",
  OPTED_OUT: "OPTED_OUT",
} as const;
export type SequenceState = (typeof SequenceState)[keyof typeof SequenceState];

export const ReplyIntent = {
  INTERESTED: "INTERESTED",
  CURIOUS: "CURIOUS",
  NEEDS_INFO: "NEEDS_INFO",
  PRICING_QUESTION: "PRICING_QUESTION",
  TECHNICAL_QUESTION: "TECHNICAL_QUESTION",
  NOT_NOW: "NOT_NOW",
  OBJECTION: "OBJECTION",
  REFERRAL: "REFERRAL",
  WRONG_PERSON: "WRONG_PERSON",
  NOT_INTERESTED: "NOT_INTERESTED",
  UNSUBSCRIBE: "UNSUBSCRIBE",
  MEETING_REQUEST: "MEETING_REQUEST",
  OTHER: "OTHER",
} as const;
export type ReplyIntent = (typeof ReplyIntent)[keyof typeof ReplyIntent];

export const AcquisitionPlaybook = {
  REVENUE_RECOVERY: "revenue_recovery",
  OPERATIONS_EFFICIENCY: "operations_efficiency",
  AI_AGENTS: "ai_agents",
  SALES_AUTOMATION: "sales_automation",
  CUSTOMER_SERVICE_AUTOMATION: "customer_service_automation",
  LEAD_CONVERSION: "lead_conversion",
  WORKFLOW_AUTOMATION: "workflow_automation",
} as const;
export type AcquisitionPlaybook = (typeof AcquisitionPlaybook)[keyof typeof AcquisitionPlaybook];
