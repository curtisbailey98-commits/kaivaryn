/**
 * Provider-neutral contracts for Kaivaryn's internal acquisition engine.
 * These interfaces deliberately separate provider data from Kaivaryn's persisted model
 * so Apollo/Clay/intent/email/calendar vendors can be swapped without rewriting the core.
 */

export type ProviderIntentSignal = {
  company: string;
  domain?: string | null;
  type: string;
  category: string;
  source: string;
  sourceUrl?: string | null;
  evidence?: string | null;
  strength: number;
  confidence: number;
  occurredAt?: Date;
};

export type ProviderContact = {
  name?: string | null;
  email?: string | null;
  title?: string | null;
  phone?: string | null;
  publicProfile?: string | null;
  verified?: boolean;
};

export interface IntentProvider {
  readonly name: string;
  pullSignals(since?: Date): Promise<ProviderIntentSignal[]>;
}

export interface EnrichmentProvider {
  readonly name: string;
  enrichCompany(input: { company: string; domain?: string | null }): Promise<{
    website?: string | null;
    industry?: string | null;
    companySize?: string | null;
    estimatedRevenue?: number | null;
    location?: string | null;
    contacts?: ProviderContact[];
    facts?: string[];
  }>;
}

export interface CompanyResolver {
  resolve(input: { company?: string | null; domain?: string | null; website?: string | null }): Promise<{
    company: string;
    domain?: string | null;
    confidence: number;
  }>;
}

export interface ContactResolver {
  resolve(account: { company: string; domain?: string | null }): Promise<ProviderContact[]>;
}

export interface ResearchProvider {
  research(account: { company: string; domain?: string | null; website?: string | null }): Promise<{
    verifiedFacts: string[];
    hypotheses: string[];
    evidence: string[];
    technology?: string[];
  }>;
}

export interface CalendarProvider {
  createMeeting(input: { accountId: string; email: string; startsAt: Date; durationMinutes: number }): Promise<{
    providerRef: string;
    joinUrl?: string | null;
  }>;
}

export interface CRMAdapter {
  upsertAccount(input: { accountId: string; company: string; stage: string }): Promise<{ providerRef: string }>;
}
