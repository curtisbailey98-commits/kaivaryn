import { z } from "zod";
import type { ProviderContact, ProviderIntentSignal } from "@/lib/acquisition-providers";

/**
 * Clay tables can send arbitrary columns to a webhook. This adapter deliberately
 * accepts a small canonical contract so the Clay table can map columns without
 * coupling Kaivaryn to a specific Clay enrichment recipe.
 */
export const clayWebhookSchema = z.object({
  company: z.string().min(1).max(200),
  domain: z.string().max(250).optional().nullable(),
  website: z.string().max(500).optional().nullable(),
  industry: z.string().max(120).optional().nullable(),
  company_size: z.union([z.string(), z.number()]).optional().nullable(),
  estimated_revenue: z.union([z.number(), z.string()]).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  contact_name: z.string().max(160).optional().nullable(),
  contact_email: z.string().email().optional().nullable(),
  contact_title: z.string().max(160).optional().nullable(),
  contact_phone: z.string().max(80).optional().nullable(),
  contact_profile: z.string().max(1000).optional().nullable(),
  contact_verified: z.boolean().optional().default(false),
  signal_type: z.string().min(1).max(120),
  signal_category: z.string().min(1).max(120),
  signal_source: z.string().max(200).optional().default("CLAY"),
  signal_source_url: z.string().url().max(1000).optional().nullable(),
  signal_evidence: z.string().max(5000).optional().nullable(),
  signal_strength: z.coerce.number().min(0).max(100).optional().default(50),
  signal_confidence: z.coerce.number().min(0).max(100).optional().default(50),
  signal_occurred_at: z.string().datetime().optional().nullable(),
  selected_product: z.string().max(120).optional().nullable(),
}).passthrough();

export type ClayWebhookPayload = z.infer<typeof clayWebhookSchema>;

function nullableNumber(value: unknown) {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(number) ? number : null;
}

export function mapClayContact(input: ClayWebhookPayload): ProviderContact | null {
  if (!input.contact_name && !input.contact_email && !input.contact_title) return null;
  return {
    name: input.contact_name || null,
    email: input.contact_email?.toLowerCase() || null,
    title: input.contact_title || null,
    phone: input.contact_phone || null,
    publicProfile: input.contact_profile || null,
    verified: input.contact_verified,
  };
}

export function mapClaySignal(input: ClayWebhookPayload): ProviderIntentSignal {
  return {
    company: input.company,
    domain: input.domain || null,
    type: input.signal_type,
    category: input.signal_category,
    source: input.signal_source || "CLAY",
    sourceUrl: input.signal_source_url || null,
    evidence: input.signal_evidence || null,
    strength: input.signal_strength,
    confidence: input.signal_confidence,
    occurredAt: input.signal_occurred_at ? new Date(input.signal_occurred_at) : undefined,
  };
}

export function mapClayCompany(input: ClayWebhookPayload) {
  return {
    company: input.company,
    domain: input.domain || null,
    website: input.website || null,
    industry: input.industry || null,
    companySize: input.company_size == null ? null : String(input.company_size),
    estimatedRevenue: nullableNumber(input.estimated_revenue),
    location: input.location || null,
    selectedProduct: input.selected_product || null,
  };
}
