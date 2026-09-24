import { prisma } from "@/lib/prisma";
import { getPlatformOrgId } from "./platform-org";

/**
 * Assembles the accepted (or still-open, if none explicitly accepted yet)
 * pain-hypothesis Findings for an account into one MicroAudit document:
 * what we observed, why it matters, supporting evidence, likely economic
 * consequence (always labeled an estimate), and the questions that need
 * answering. This is the artifact reverse-selling.ts turns into outreach
 * copy — it never invents content beyond what the underlying Findings say.
 */
export async function assembleMicroAudit(prospectAccountId: string, createdById: string) {
  const platformOrgId = await getPlatformOrgId();
  const account = await prisma.prospectAccount.findUniqueOrThrow({ where: { id: prospectAccountId } });

  const findings = await prisma.finding.findMany({
    where: { organizationId: platformOrgId, prospectAccountId, product: "CLIENT_ACQUISITION", status: { in: ["OPEN", "ACCEPTED"] } },
    orderBy: { createdAt: "asc" },
  });

  if (findings.length === 0) {
    throw new Error("No pain hypotheses on record for this account yet — run the pain engine first.");
  }

  const totalEstimate = findings.reduce((sum, f) => sum + (f.impactEstimate ?? 0), 0);

  const sections = findings.map((f, i) => {
    const explain = f.explainJson ? (JSON.parse(f.explainJson) as { label?: string }) : {};
    return [
      `### ${i + 1}. ${explain.label ?? f.ruleId}`,
      "",
      `**What we observed:** ${f.evidenceSummary ?? "—"}`,
      `**Why it may matter:** ${f.analysis ?? "—"}`,
      f.impactEstimate ? `**Estimated economic impact (modeled, unconfirmed):** ~$${Math.round(f.impactEstimate).toLocaleString()}` : `**Estimated economic impact:** not yet modeled — insufficient sizing data.`,
      `**Confidence:** ${f.confidence}`,
    ].join("\n");
  });

  const bodyMarkdown = [
    `## What Kaivaryn observed about ${account.name}`,
    "",
    ...sections,
    "",
    "### Questions that would need answering before recommending anything",
    "- Do these patterns match what you're actually seeing internally?",
    "- Roughly how large is the gap in your own numbers, if any?",
    "- Who would need to be involved in evaluating this?",
    "",
    "_Every dollar figure above is a modeled estimate, not a claim about your business — it exists to determine whether it's worth a closer look, not to be taken as fact._",
  ].join("\n");

  const microAudit = await prisma.microAudit.create({
    data: {
      prospectAccountId,
      title: `Kaivaryn observations — ${account.name}`,
      summary:
        totalEstimate > 0
          ? `${findings.length} observation(s), modeled combined impact ~$${Math.round(totalEstimate).toLocaleString()} (estimate, unconfirmed).`
          : `${findings.length} observation(s); economic sizing not yet available.`,
      bodyMarkdown,
      status: "DRAFT",
      findingIds: JSON.stringify(findings.map((f) => f.id)),
      createdById,
    },
  });

  await prisma.prospectAccount.update({ where: { id: prospectAccountId }, data: { status: "AUDITED" } });

  return microAudit;
}
