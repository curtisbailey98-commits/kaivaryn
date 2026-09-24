import { prisma } from "@/lib/prisma";
import type { IntentProvider, RawIntentSignal } from "./types";

/**
 * LIVE, credential-free intent source: Kaivaryn's own public "Request a
 * Demo" form (DemoRequest) is itself the strongest first-party intent
 * signal there is — someone told us directly they're interested. This
 * provider needs no configuration and is always available.
 */
export const firstPartySignalProvider: IntentProvider = {
  name: "first_party_demo_request",
  async fetchSignals(since: Date): Promise<RawIntentSignal[]> {
    const requests = await prisma.demoRequest.findMany({
      where: { createdAt: { gte: since }, prospectAccountId: null },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return requests.map((r) => ({
      companyName: r.company,
      domain: domainFromEmail(r.email),
      signalType: "demo_request_submitted",
      signalCategory: "engagement",
      source: "first_party_demo_request",
      sourceId: r.id,
      confidence: "high",
      strength: 90,
      reasoning: `Submitted the public demo request form for: ${r.products}.`,
      rawData: { name: r.name, email: r.email, title: r.title, phone: r.phone, products: r.products, companySize: r.companySize, message: r.message },
    }));
  },
};

function domainFromEmail(email: string): string | undefined {
  const parts = email.split("@");
  if (parts.length !== 2) return undefined;
  const domain = parts[1].toLowerCase().trim();
  // Ignore free/consumer mail providers — not useful as a company identifier.
  const consumer = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com"]);
  return consumer.has(domain) ? undefined : domain;
}

/** All registered providers. Add real ones here once credentials exist —
 * every additional provider must return NEEDS_CONFIGURATION honestly
 * (see IntegrationConnection) rather than silently no-op. */
export const INTENT_PROVIDERS: IntentProvider[] = [firstPartySignalProvider];

/** Pull signals from every registered provider and persist them as
 * IntentSignal rows, deduplicated by (source, sourceId). */
export async function ingestIntentSignals(since: Date) {
  let created = 0;
  let skipped = 0;
  for (const provider of INTENT_PROVIDERS) {
    const raw = await provider.fetchSignals(since);
    for (const signal of raw) {
      const existing = signal.sourceId
        ? await prisma.intentSignal.findUnique({ where: { source_sourceId: { source: signal.source, sourceId: signal.sourceId } } })
        : null;
      if (existing) {
        skipped += 1;
        continue;
      }
      await prisma.intentSignal.create({
        data: {
          companyName: signal.companyName,
          domain: signal.domain,
          signalType: signal.signalType,
          signalCategory: signal.signalCategory,
          source: signal.source,
          sourceId: signal.sourceId,
          sourceUrl: signal.sourceUrl,
          confidence: signal.confidence ?? "low",
          strength: signal.strength ?? 0,
          reasoning: signal.reasoning,
          rawDataJson: signal.rawData ? JSON.stringify(signal.rawData) : null,
        },
      });
      created += 1;
    }
  }
  return { created, skipped };
}
