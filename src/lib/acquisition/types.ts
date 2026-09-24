import type { ScoreFactor } from "@/lib/scoring";

export type NeedsConfiguration = { status: "NEEDS_CONFIGURATION"; provider: string };

export type RawIntentSignal = {
  companyName: string;
  domain?: string;
  signalType: string;
  signalCategory: string;
  source: string;
  sourceId?: string;
  sourceUrl?: string;
  confidence?: "low" | "medium" | "high";
  strength?: number;
  reasoning?: string;
  rawData?: Record<string, unknown>;
};

export interface IntentProvider {
  name: string;
  fetchSignals(since: Date): Promise<RawIntentSignal[]>;
}

export type CompanyEnrichment = {
  industry?: string;
  employeeCountEstimate?: number;
  estimatedRevenueUsd?: number;
  location?: string;
  technologyStack?: string[];
  description?: string;
};

export type ContactCandidate = {
  name: string;
  title?: string;
  seniorityRole?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  isEconomicBuyer?: boolean;
};

export interface EnrichmentProvider {
  name: string;
  enrichCompany(domain: string): Promise<CompanyEnrichment | NeedsConfiguration>;
  findContacts(domain: string, roles: string[]): Promise<ContactCandidate[] | NeedsConfiguration>;
}

export type QualificationResult = {
  total: number;
  factors: ScoreFactor[];
  routing: "PRIORITY" | "NURTURE" | "HOLD";
};

export type AccountResearchResult =
  | { status: "INSUFFICIENT_DATA"; requiredSignals: string[] }
  | { status: "COMPLETE"; summary: string; verifiedFacts: Array<{ fact: string; source?: string }>; recentEvents: string[] };

export type PainHypothesisDraft = {
  category: string;
  hypothesis: string;
  confidence: "low" | "medium" | "high";
  reasoning: string;
  estimatedImpactUsd?: number;
  evidence: Array<{ summary: string; source?: string }>;
};

export interface CalendarProvider {
  name: string;
  proposeSlots(prospectAccountId: string): Promise<{ slots: string[] } | NeedsConfiguration>;
  bookMeeting(prospectAccountId: string, slotIso: string): Promise<{ meetingUrl: string } | NeedsConfiguration>;
}

export interface CRMAdapter {
  name: string;
  syncOut(prospectAccountId: string): Promise<{ status: "SYNCED" } | NeedsConfiguration>;
}

export type FunnelMetrics = {
  newIntent: number;
  priorityAccounts: number;
  qualifiedAccounts: number;
  researching: number;
  microAudits: number;
  outreachQueued: number;
  outreachSent: number;
  replies: number;
  positiveReplies: number;
  demosBooked: number;
  demosCompleted: number;
  checkoutReady: number;
  paymentPending: number;
  closedWon: number;
  onboarding: number;
  activeCustomers: number;
  closedLost: number;
  pipelineValueCents: number;
  collectedRevenueCents: number;
};
