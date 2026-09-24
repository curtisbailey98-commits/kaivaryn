import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

/**
 * Resolve (or create) the single ProspectAccount for a company. Dedup key is
 * the normalized domain — the only durable, database-level unique identifier
 * a company has (ProspectAccount.domain is @unique). A signal with no domain
 * falls back to an exact, case-insensitive company-name match flagged for
 * manual review rather than silently merged (avoids false-positive merges).
 */
export async function resolveOrCreateProspectAccount(input: {
  companyName: string;
  domain?: string | null;
  actorId?: string | null;
}): Promise<{ prospectAccountId: string; created: boolean; needsManualReview: boolean }> {
  const domain = normalizeDomain(input.domain);

  if (domain) {
    const existing = await prisma.prospectAccount.findUnique({ where: { domain } });
    if (existing) {
      return { prospectAccountId: existing.id, created: false, needsManualReview: false };
    }
    const created = await prisma.prospectAccount.create({
      data: { name: input.companyName, domain, status: "DETECTED" },
    });
    await writeAudit({
      actorId: input.actorId,
      action: "PROSPECT_ACCOUNT_CREATED",
      entityType: "ProspectAccount",
      entityId: created.id,
      metadata: { domain, source: "company-resolution" },
    });
    return { prospectAccountId: created.id, created: true, needsManualReview: false };
  }

  // No domain — try an exact case-insensitive name match among existing
  // domain-less accounts only (never merge into a domain-verified account on
  // name alone; a domain match is the only thing we trust for auto-merge).
  // NOTE: Prisma's SQLite connector has no `mode: "insensitive"` filter
  // (that's Postgres/MySQL-only), so the compare happens in application code
  // against the bounded set of domain-less accounts.
  const normalizedTarget = input.companyName.trim().toLowerCase();
  const domainlessAccounts = await prisma.prospectAccount.findMany({
    where: { domain: null },
    select: { id: true, name: true },
    take: 5000,
  });
  const nameMatch = domainlessAccounts.find((a) => a.name.trim().toLowerCase() === normalizedTarget);
  if (nameMatch) {
    return { prospectAccountId: nameMatch.id, created: false, needsManualReview: true };
  }
  const created = await prisma.prospectAccount.create({
    data: { name: input.companyName, status: "DETECTED" },
  });
  await writeAudit({
    actorId: input.actorId,
    action: "PROSPECT_ACCOUNT_CREATED",
    entityType: "ProspectAccount",
    entityId: created.id,
    metadata: { domain: null, source: "company-resolution", note: "no domain — flagged for manual dedup review" },
  });
  return { prospectAccountId: created.id, created: true, needsManualReview: true };
}

/** Attach an unresolved IntentSignal to its ProspectAccount (creating one if needed). */
export async function resolveIntentSignal(intentSignalId: string, actorId?: string | null) {
  const signal = await prisma.intentSignal.findUniqueOrThrow({ where: { id: intentSignalId } });
  if (signal.prospectAccountId) return { prospectAccountId: signal.prospectAccountId, created: false };

  const { prospectAccountId, created } = await resolveOrCreateProspectAccount({
    companyName: signal.companyName,
    domain: signal.domain,
    actorId,
  });

  await prisma.$transaction([
    prisma.intentSignal.update({ where: { id: intentSignalId }, data: { prospectAccountId, status: "RESOLVED" } }),
    prisma.prospectAccount.update({
      where: { id: prospectAccountId },
      data: {
        status: "RESOLVED",
        intentScore: { increment: Math.min(20, Math.round((signal.strength ?? 0) / 5)) },
      },
    }),
  ]);

  return { prospectAccountId, created };
}
