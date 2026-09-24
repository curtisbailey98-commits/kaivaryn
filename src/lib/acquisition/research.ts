import { prisma } from "@/lib/prisma";
import type { AccountResearchResult } from "./types";

/**
 * Assembles what's actually known about an account from data already in our
 * own system (intent signals, contacts, prior notes) into a VERIFIED FACTS
 * list, distinct from any hypothesis. Returns INSUFFICIENT_DATA honestly
 * when there's nothing verifiable yet — mirrors intelligence.ts exactly.
 * A real EnrichmentProvider/ResearchProvider can extend the fact list once
 * connected; this never fabricates a fact that isn't traceable to a source.
 */
export async function buildAccountResearch(prospectAccountId: string): Promise<AccountResearchResult> {
  const account = await prisma.prospectAccount.findUniqueOrThrow({
    where: { id: prospectAccountId },
    include: {
      intentSignals: { orderBy: { detectedAt: "desc" } },
      contacts: true,
    },
  });

  const verifiedFacts: Array<{ fact: string; source?: string }> = [];
  if (account.industry) verifiedFacts.push({ fact: `Industry: ${account.industry}`, source: "manual/enrichment" });
  if (account.employeeCountEstimate) verifiedFacts.push({ fact: `Estimated headcount: ${account.employeeCountEstimate}`, source: "manual/enrichment" });
  if (account.estimatedRevenueUsd) verifiedFacts.push({ fact: `Estimated revenue: $${account.estimatedRevenueUsd.toLocaleString()}`, source: "manual/enrichment" });
  if (account.technologyStackJson) {
    try {
      const stack = JSON.parse(account.technologyStackJson) as string[];
      if (stack.length) verifiedFacts.push({ fact: `Observed technology: ${stack.join(", ")}`, source: "manual/enrichment" });
    } catch {
      /* ignore malformed JSON rather than throw */
    }
  }
  for (const signal of account.intentSignals) {
    verifiedFacts.push({ fact: `${signal.signalType.replace(/_/g, " ")} (${signal.signalCategory}): ${signal.reasoning ?? "no detail recorded"}`, source: signal.sourceUrl ?? signal.source });
  }
  for (const contact of account.contacts) {
    verifiedFacts.push({ fact: `Contact on file: ${contact.name}${contact.title ? `, ${contact.title}` : ""}`, source: contact.source ?? "manual" });
  }

  const recentEvents = account.intentSignals
    .filter((s) => ["funding", "expansion", "leadership", "hiring"].includes(s.signalCategory))
    .map((s) => `${s.signalCategory}: ${s.reasoning ?? s.signalType}`);

  const requiredSignals = [
    "At least one IntentSignal (form activity, engagement, or a connected provider)",
    "Company size/revenue from enrichment, or manually entered",
    "At least one ProspectContact",
  ];

  const status: AccountResearchResult["status"] = verifiedFacts.length === 0 ? "INSUFFICIENT_DATA" : "COMPLETE";

  await prisma.accountResearch.upsert({
    where: { prospectAccountId },
    update: {
      summary: status === "COMPLETE" ? `${verifiedFacts.length} verified facts on record for ${account.name}.` : null,
      verifiedFactsJson: JSON.stringify(verifiedFacts),
      recentEventsJson: JSON.stringify(recentEvents),
      status,
      requiredSignalsJson: status === "INSUFFICIENT_DATA" ? JSON.stringify(requiredSignals) : null,
      generatedAt: new Date(),
    },
    create: {
      prospectAccountId,
      summary: status === "COMPLETE" ? `${verifiedFacts.length} verified facts on record for ${account.name}.` : null,
      verifiedFactsJson: JSON.stringify(verifiedFacts),
      recentEventsJson: JSON.stringify(recentEvents),
      status,
      requiredSignalsJson: status === "INSUFFICIENT_DATA" ? JSON.stringify(requiredSignals) : null,
    },
  });

  if (status === "INSUFFICIENT_DATA") {
    return { status: "INSUFFICIENT_DATA", requiredSignals };
  }
  return {
    status: "COMPLETE",
    summary: `${verifiedFacts.length} verified facts on record for ${account.name}.`,
    verifiedFacts,
    recentEvents,
  };
}
