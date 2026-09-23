import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getPricingConfig } from "@/lib/pricing";
import { Product, Role } from "@/lib/enums";

export const ACQUISITION_STAGES = [
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
  "CHECKOUT_READY",
  "PAYMENT_SUCCEEDED",
  "ONBOARDING",
  "ACTIVE",
] as const;

export type AcquisitionStage = (typeof ACQUISITION_STAGES)[number];
export const ACQUISITION_EXIT_STAGES = ["NURTURE", "HOLD", "DISQUALIFIED", "NOT_INTERESTED", "UNSUBSCRIBED", "CLOSED_LOST"] as const;

const stageRank = new Map<string, number>(ACQUISITION_STAGES.map((stage, index) => [stage, index]));

export function normalizeDomain(value?: string | null) {
  if (!value) return null;
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null;
  }
}

export function authorityScore(title?: string | null) {
  const t = (title || "").toLowerCase();
  if (!t) return 0;
  if (/\b(ceo|chief executive|founder|owner|president)\b/.test(t)) return 10;
  if (/\b(coo|cro|cto|cio|chief operating|chief revenue|chief technology|chief information)\b/.test(t)) return 10;
  if (/\b(vp|vice president|head of)\b/.test(t)) return 8;
  if (/\b(director|general manager|gm)\b/.test(t)) return 6;
  if (/\b(manager|lead)\b/.test(t)) return 4;
  return 2;
}

function companySizeScore(size?: string | null) {
  const normalized = (size || "").toLowerCase().replace(/,/g, "");
  const nums = normalized.match(/\d+/g)?.map(Number) || [];
  const max = nums.length ? Math.max(...nums) : 0;
  if (/enterprise|1000\+|1001/.test(normalized) || max >= 1000) return { icp: 25, economic: 15 };
  if (max >= 200) return { icp: 23, economic: 14 };
  if (max >= 50) return { icp: 21, economic: 12 };
  if (max >= 10) return { icp: 17, economic: 9 };
  if (max > 0) return { icp: 10, economic: 5 };
  return { icp: 15, economic: 8 };
}

function safeArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function newestStage(current: string, candidate: AcquisitionStage) {
  const currentRank = stageRank.get(current);
  const candidateRank = stageRank.get(candidate) ?? 0;
  if (currentRank === undefined) return candidate;
  return candidateRank > currentRank ? candidate : current;
}

export async function addAcquisitionActivity(accountId: string, type: string, summary: string, data?: unknown) {
  return prisma.acquisitionActivity.create({
    data: {
      accountId,
      type,
      summary,
      dataJson: data === undefined ? null : JSON.stringify(data),
    },
  });
}

export function signalFingerprint(input: {
  accountKey: string;
  type: string;
  source: string;
  sourceUrl?: string | null;
  evidence?: string | null;
  occurredAt?: Date;
}) {
  const dateBucket = (input.occurredAt || new Date()).toISOString().slice(0, 10);
  return createHash("sha256")
    .update([input.accountKey, input.type, input.source, input.sourceUrl || "", input.evidence || "", dateBucket].join("|"))
    .digest("hex");
}

export async function findOrCreateAcquisitionAccount(input: {
  company: string;
  domain?: string | null;
  website?: string | null;
  industry?: string | null;
  companySize?: string | null;
  location?: string | null;
  source?: string | null;
  primaryName?: string | null;
  primaryEmail?: string | null;
  primaryTitle?: string | null;
  phone?: string | null;
  selectedProduct?: string | null;
  demoRequestId?: string | null;
}) {
  const domain = normalizeDomain(input.domain || input.website);
  const email = input.primaryEmail?.trim().toLowerCase() || null;

  let existing = input.demoRequestId
    ? await prisma.acquisitionAccount.findFirst({ where: { demoRequestId: input.demoRequestId } })
    : null;
  if (!existing && domain) existing = await prisma.acquisitionAccount.findFirst({ where: { domain } });
  if (!existing && email) existing = await prisma.acquisitionAccount.findFirst({ where: { primaryEmail: email } });
  if (!existing) existing = await prisma.acquisitionAccount.findFirst({ where: { company: input.company } });

  const account = existing
    ? await prisma.acquisitionAccount.update({
        where: { id: existing.id },
        data: {
          company: input.company || existing.company,
          domain: domain || existing.domain,
          website: input.website || existing.website,
          industry: input.industry || existing.industry,
          companySize: input.companySize || existing.companySize,
          location: input.location || existing.location,
          source: input.source || existing.source,
          primaryName: input.primaryName || existing.primaryName,
          primaryEmail: email || existing.primaryEmail,
          primaryTitle: input.primaryTitle || existing.primaryTitle,
          phone: input.phone || existing.phone,
          selectedProduct: input.selectedProduct || existing.selectedProduct,
          demoRequestId: input.demoRequestId || existing.demoRequestId,
          stage: newestStage(existing.stage, "RESOLVED"),
        },
      })
    : await prisma.acquisitionAccount.create({
        data: {
          company: input.company,
          domain,
          website: input.website,
          industry: input.industry,
          companySize: input.companySize,
          location: input.location,
          source: input.source,
          primaryName: input.primaryName,
          primaryEmail: email,
          primaryTitle: input.primaryTitle,
          phone: input.phone,
          selectedProduct: input.selectedProduct,
          demoRequestId: input.demoRequestId,
          stage: "RESOLVED",
        },
      });

  if (email || input.primaryName || input.primaryTitle) {
    const found = email
      ? await prisma.acquisitionContact.findFirst({ where: { accountId: account.id, email } })
      : null;
    if (found) {
      await prisma.acquisitionContact.update({
        where: { id: found.id },
        data: {
          name: input.primaryName || found.name,
          title: input.primaryTitle || found.title,
          phone: input.phone || found.phone,
          authorityScore: Math.max(found.authorityScore, authorityScore(input.primaryTitle)),
          isPrimary: true,
          source: input.source || found.source,
        },
      });
    } else {
      await prisma.acquisitionContact.create({
        data: {
          accountId: account.id,
          name: input.primaryName,
          email,
          title: input.primaryTitle,
          phone: input.phone,
          authorityScore: authorityScore(input.primaryTitle),
          isPrimary: true,
          source: input.source,
        },
      });
    }
  }
  return account;
}

export async function addIntentSignal(input: {
  accountId: string;
  type: string;
  category: string;
  source: string;
  sourceUrl?: string | null;
  evidence?: string | null;
  strength?: number;
  confidence?: number;
  occurredAt?: Date;
}) {
  const account = await prisma.acquisitionAccount.findUnique({ where: { id: input.accountId } });
  if (!account) throw new Error("Acquisition account not found");
  const fingerprint = signalFingerprint({
    accountKey: account.domain || account.id,
    type: input.type,
    source: input.source,
    sourceUrl: input.sourceUrl,
    evidence: input.evidence,
    occurredAt: input.occurredAt,
  });
  const strength = Math.max(0, Math.min(100, Math.round(input.strength ?? 50)));
  const confidence = Math.max(0, Math.min(100, Math.round(input.confidence ?? 50)));
  const signal = await prisma.intentSignal.upsert({
    where: { fingerprint },
    update: { strength, confidence, evidence: input.evidence, sourceUrl: input.sourceUrl },
    create: {
      accountId: input.accountId,
      fingerprint,
      type: input.type,
      category: input.category,
      source: input.source,
      sourceUrl: input.sourceUrl,
      evidence: input.evidence,
      strength,
      confidence,
      occurredAt: input.occurredAt || new Date(),
    },
  });
  await addAcquisitionActivity(input.accountId, "INTENT_SIGNAL", `${input.type} from ${input.source}`, { strength, confidence });
  return signal;
}

export async function scoreAcquisitionAccount(accountId: string) {
  const account = await prisma.acquisitionAccount.findUnique({
    where: { id: accountId },
    include: { intentSignals: true, contacts: true, research: true },
  });
  if (!account) throw new Error("Acquisition account not found");

  const size = companySizeScore(account.companySize);
  const icpFit = size.icp;
  const weightedSignal = account.intentSignals.reduce((best, signal) => {
    const weighted = Math.round((signal.strength * signal.confidence) / 100);
    return Math.max(best, weighted);
  }, 0);
  const intentStrength = Math.min(25, Math.round(weightedSignal * 0.25));
  const researchHypotheses = safeArray(account.research?.painHypothesesJson);
  const painOpportunity = Math.min(20, (account.painSummary ? 12 : 6) + Math.min(8, researchHypotheses.length * 2));
  const economicValue = account.estimatedRevenue
    ? account.estimatedRevenue >= 50_000_000 ? 15 : account.estimatedRevenue >= 10_000_000 ? 13 : account.estimatedRevenue >= 1_000_000 ? 10 : 6
    : size.economic;
  const bestAuthority = Math.max(authorityScore(account.primaryTitle), ...account.contacts.map((c) => c.authorityScore), 0);
  const decisionMakerAccess = Math.min(10, bestAuthority);
  const now = Date.now();
  const recentStrong = account.intentSignals.some((s) => now - s.occurredAt.getTime() <= 14 * 86400000 && s.strength >= 70);
  const timingUrgency = recentStrong ? 5 : account.intentSignals.length ? 3 : 1;
  const total = Math.min(100, icpFit + intentStrength + painOpportunity + economicValue + decisionMakerAccess + timingUrgency);
  const band = total >= 75 ? "PRIORITY" : total >= 55 ? "NURTURE" : "HOLD";
  const reasoning = {
    icpFit: `Company-size fit contributed ${icpFit}/25.`,
    intentStrength: `${account.intentSignals.length} recorded intent signal(s); strongest confidence-weighted signal ${weightedSignal}/100.`,
    painOpportunity: account.painSummary || researchHypotheses.length ? "Pain/opportunity evidence is present." : "Pain remains mostly unverified and should be researched.",
    economicValue: `Economic-fit contribution ${economicValue}/15 based on known revenue/size evidence.`,
    decisionMakerAccess: bestAuthority ? `Best known authority score ${bestAuthority}/10.` : "No senior decision-maker is confirmed yet.",
    timingUrgency: recentStrong ? "Recent strong signal detected within 14 days." : "No recent strong trigger confirmed.",
  };

  await prisma.qualificationSnapshot.create({
    data: { accountId, icpFit, intentStrength, painOpportunity, economicValue, decisionMakerAccess, timingUrgency, total, band, reasoningJson: JSON.stringify(reasoning), version: "v1" },
  });

  const nextStage = band === "PRIORITY" ? newestStage(account.stage, "PREQUALIFIED") : account.stage;
  await prisma.acquisitionAccount.update({
    where: { id: accountId },
    data: { intentScore: weightedSignal, qualificationScore: total, qualificationBand: band, stage: nextStage },
  });
  await addAcquisitionActivity(accountId, "QUALIFICATION", `Pre-qualification scored ${total}/100 (${band})`, reasoning);
  return { total, band, reasoning, components: { icpFit, intentStrength, painOpportunity, economicValue, decisionMakerAccess, timingUrgency } };
}

export async function syncDemoToAcquisition(demoRequestId: string) {
  const demo = await prisma.demoRequest.findUnique({ where: { id: demoRequestId } });
  if (!demo) throw new Error("Demo request not found");
  const domain = demo.email.split("@")[1] || null;
  const account = await findOrCreateAcquisitionAccount({
    company: demo.company,
    domain,
    companySize: demo.companySize,
    source: "FIRST_PARTY_DEMO_REQUEST",
    primaryName: demo.name,
    primaryEmail: demo.email,
    primaryTitle: demo.title,
    phone: demo.phone,
    selectedProduct: demo.products,
    demoRequestId: demo.id,
  });
  await addIntentSignal({
    accountId: account.id,
    type: "DEMO_REQUEST",
    category: "FIRST_PARTY_ENGAGEMENT",
    source: "KAIVARYN_WEBSITE",
    evidence: demo.message || `Requested demo for ${demo.products}`,
    strength: 90,
    confidence: 100,
    occurredAt: demo.createdAt,
  });
  if (demo.message) {
    await prisma.acquisitionAccount.update({ where: { id: account.id }, data: { painSummary: demo.message } });
  }
  await scoreAcquisitionAccount(account.id);
  return account;
}

export async function saveAccountResearch(accountId: string, input: {
  businessModel?: string | null;
  revenueModel?: string | null;
  verifiedFacts?: string[];
  hypotheses?: string[];
  techStack?: string[];
  painHypotheses?: string[];
  evidence?: string[];
}) {
  const row = await prisma.accountResearch.upsert({
    where: { accountId },
    update: {
      status: "COMPLETE",
      businessModel: input.businessModel || null,
      revenueModel: input.revenueModel || null,
      verifiedFactsJson: JSON.stringify(input.verifiedFacts || []),
      hypothesesJson: JSON.stringify(input.hypotheses || []),
      techStackJson: JSON.stringify(input.techStack || []),
      painHypothesesJson: JSON.stringify(input.painHypotheses || []),
      evidenceJson: JSON.stringify(input.evidence || []),
      researchedAt: new Date(),
    },
    create: {
      accountId,
      status: "COMPLETE",
      businessModel: input.businessModel || null,
      revenueModel: input.revenueModel || null,
      verifiedFactsJson: JSON.stringify(input.verifiedFacts || []),
      hypothesesJson: JSON.stringify(input.hypotheses || []),
      techStackJson: JSON.stringify(input.techStack || []),
      painHypothesesJson: JSON.stringify(input.painHypotheses || []),
      evidenceJson: JSON.stringify(input.evidence || []),
      researchedAt: new Date(),
    },
  });
  const account = await prisma.acquisitionAccount.findUnique({ where: { id: accountId } });
  if (account) await prisma.acquisitionAccount.update({ where: { id: accountId }, data: { stage: newestStage(account.stage, "QUALIFIED") } });
  await addAcquisitionActivity(accountId, "RESEARCH", "Account research updated with facts, hypotheses, and evidence.");
  await scoreAcquisitionAccount(accountId);
  return row;
}

export async function generateMicroAudit(accountId: string) {
  const account = await prisma.acquisitionAccount.findUnique({
    where: { id: accountId },
    include: { intentSignals: { orderBy: [{ strength: "desc" }, { occurredAt: "desc" }] }, research: true, contacts: true },
  });
  if (!account) throw new Error("Acquisition account not found");
  const strongest = account.intentSignals[0];
  const facts = safeArray(account.research?.verifiedFactsJson);
  const observation = strongest?.evidence
    ? `Observable signal: ${strongest.evidence}`
    : strongest
      ? `Observable signal: ${strongest.type} (${strongest.source}).`
      : facts[0]
        ? `Verified fact: ${facts[0]}`
        : `Kaivaryn has an account-level opportunity hypothesis for ${account.company}, but more evidence is required.`;
  const evidenceSummary = [strongest?.sourceUrl ? `Source: ${strongest.sourceUrl}` : null, ...facts.slice(0, 3)].filter(Boolean).join(" | ") || "No external evidence URL has been recorded yet; treat the finding as a hypothesis until validated.";
  const economicHypothesis = account.economicHypothesis || account.painSummary
    ? `If the observed condition is materially affecting ${account.painSummary || "revenue or operating throughput"}, the economics may justify intervention. This is a modeled hypothesis, not a verified loss figure.`
    : `If the observable signals map to a material revenue or operating constraint, the economics may justify intervention. The impact must be validated during discovery.`;
  const diagnosticQuestions = [
    "How often does this condition occur in a normal month?",
    "What is the current conversion, labor, or revenue impact when it occurs?",
    "Who owns the process today, and what systems are involved?",
    "What would need to be true for fixing this to justify a Kaivaryn engagement?",
  ];
  const recommendedIntervention = account.selectedProduct?.includes("OPERATIONS")
    ? "Validate the process bottleneck, baseline cycle time/cost, then model an Operations Efficiency intervention."
    : account.selectedProduct?.includes("REVENUE")
      ? "Validate the leakage point, baseline conversion/recovery economics, then model a Revenue Recovery intervention."
      : "Validate whether Revenue Recovery, Operations Efficiency, or a combined intervention best matches the economics.";
  const reverseSellMessage = `${account.primaryName ? `${account.primaryName}, ` : ""}we noticed ${observation.replace(/^Observable signal:\s*/i, "").replace(/\.$/, "")}. Based on what is observable, there may be an opportunity worth validating—but we would not recommend implementation until the economics prove it. If the underlying numbers are material, we can show you exactly where Kaivaryn would intervene. The first question is simple: how often does this happen, and what does it cost when it does?`;

  const audit = await prisma.microAudit.create({
    data: {
      accountId,
      observation,
      evidenceSummary,
      economicHypothesis,
      diagnosticQuestionsJson: JSON.stringify(diagnosticQuestions),
      recommendedIntervention,
      reverseSellMessage,
      status: "DRAFT",
    },
  });
  const primary = account.contacts.find((c) => c.isPrimary) || account.contacts[0];
  await prisma.outreachMessage.create({
    data: {
      accountId,
      contactId: primary?.id,
      channel: "EMAIL",
      subject: `A question about ${account.company}'s current workflow`,
      body: reverseSellMessage,
      status: "DRAFT",
    },
  });
  await prisma.acquisitionAccount.update({ where: { id: accountId }, data: { stage: newestStage(account.stage, "AUDITED") } });
  await addAcquisitionActivity(accountId, "MICRO_AUDIT", "Evidence-backed micro-audit and reverse-selling draft generated.", { auditId: audit.id });
  return audit;
}

export async function markDemoCompleted(accountId: string) {
  const account = await prisma.acquisitionAccount.findUnique({ where: { id: accountId }, include: { demoRequest: true } });
  if (!account) throw new Error("Acquisition account not found");
  const token = account.checkoutToken || randomBytes(24).toString("hex");
  const now = new Date();
  const updated = await prisma.acquisitionAccount.update({
    where: { id: accountId },
    data: {
      stage: "CHECKOUT_READY",
      demoCompletedAt: account.demoCompletedAt || now,
      checkoutToken: token,
      checkoutReadyAt: now,
      paymentStatus: account.paymentStatus === "PAID" ? "PAID" : "READY",
    },
  });
  if (account.demoRequestId) {
    await prisma.demoRequest.update({ where: { id: account.demoRequestId }, data: { status: "DEMO_COMPLETED" } });
  }
  await addAcquisitionActivity(accountId, "DEMO_COMPLETED", "Demo completed; post-demo Stripe checkout unlocked.");
  return updated;
}

export async function buildCheckoutLink(accountId: string) {
  const [account, pricing] = await Promise.all([
    prisma.acquisitionAccount.findUnique({ where: { id: accountId } }),
    getPricingConfig(),
  ]);
  if (!account) throw new Error("Acquisition account not found");
  if (!account.checkoutReadyAt || !["READY", "PENDING"].includes(account.paymentStatus)) return null;
  const url = new URL(pricing.stripePaymentLink);
  if (!account.checkoutToken) return null;
  url.searchParams.set("client_reference_id", account.checkoutToken);
  if (account.primaryEmail) url.searchParams.set("prefilled_email", account.primaryEmail);
  return url.toString();
}

async function uniqueOrgSlug(baseName: string) {
  const base = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "client";
  let slug = base;
  let index = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) slug = `${base}-${index++}`;
  return slug;
}

function productsFor(account: { selectedProduct: string | null }) {
  const selected = (account.selectedProduct || "").toUpperCase();
  const products: string[] = [];
  if (!selected || selected.includes("REVENUE") || selected.includes("BOTH")) products.push(Product.REVENUE_RECOVERY);
  if (!selected || selected.includes("OPERATIONS") || selected.includes("BOTH")) products.push(Product.OPERATIONS_EFFICIENCY);
  return Array.from(new Set(products));
}

export async function provisionPaidAcquisitionAccount(accountId: string, opts?: { amountCents?: number | null; stripeRef?: string | null }) {
  let account = await prisma.acquisitionAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Acquisition account not found");
  let orgId = account.onboardingOrganizationId;

  if (!orgId) {
    const user = account.primaryEmail ? await prisma.user.findUnique({ where: { email: account.primaryEmail.toLowerCase() }, include: { memberships: { take: 1 } } }) : null;
    if (user?.memberships[0]?.organizationId) {
      orgId = user.memberships[0].organizationId;
    } else {
      const slug = await uniqueOrgSlug(account.company);
      const org = await prisma.organization.create({ data: { name: account.company, slug, isDemo: false } });
      orgId = org.id;
    }
    account = await prisma.acquisitionAccount.update({ where: { id: accountId }, data: { onboardingOrganizationId: orgId } });
  }

  for (const product of productsFor(account)) {
    await prisma.entitlement.upsert({
      where: { organizationId_product: { organizationId: orgId, product } },
      update: { active: true },
      create: { organizationId: orgId, product, active: true },
    });
  }

  if (opts?.stripeRef) {
    const existingSub = await prisma.subscription.findFirst({ where: { organizationId: orgId, stripeRef: opts.stripeRef } });
    if (!existingSub) {
      await prisma.subscription.create({
        data: { organizationId: orgId, status: "ACTIVE", priceCents: opts.amountCents || account.estimatedDealValueCents || 1_000_000, stripeRef: opts.stripeRef, startedAt: new Date() },
      });
    }
  }

  if (account.primaryEmail) {
    const user = await prisma.user.findUnique({ where: { email: account.primaryEmail.toLowerCase() } });
    if (user) {
      await prisma.membership.upsert({
        where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
        update: { role: Role.OWNER },
        create: { organizationId: orgId, userId: user.id, role: Role.OWNER },
      });
      await prisma.onboardingProgress.upsert({
        where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
        update: {},
        create: { organizationId: orgId, userId: user.id, currentStep: 0, completedSteps: "[]", dataJson: JSON.stringify({ acquisitionAccountId: account.id }) },
      });
    }
  }

  await prisma.acquisitionAccount.update({ where: { id: accountId }, data: { stage: "ONBOARDING", onboardingOrganizationId: orgId } });
  await addAcquisitionActivity(accountId, "ONBOARDING_STARTED", "Payment verified; client workspace and entitlements provisioned.", { organizationId: orgId });
  return orgId;
}

export async function recordStripePayment(input: {
  accountId: string;
  eventId: string;
  type: string;
  amountCents?: number | null;
  currency?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeRef?: string | null;
}) {
  const account = await prisma.acquisitionAccount.findUnique({ where: { id: input.accountId } });
  if (!account) throw new Error("Acquisition account not found");
  if (!account.demoCompletedAt || !account.checkoutReadyAt) {
    throw new Error("Stripe payment reference is not attached to a completed, checkout-ready demo.");
  }

  // Upsert the event, but do not return early on duplicates. If a prior webhook
  // persisted the event and provisioning failed, Stripe's retry must be able to
  // resume the idempotent provisioning path.
  const event = await prisma.paymentEvent.upsert({
    where: { eventId: input.eventId },
    update: {
      amountCents: input.amountCents,
      currency: input.currency,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
    },
    create: {
      accountId: input.accountId,
      eventId: input.eventId,
      type: input.type,
      amountCents: input.amountCents,
      currency: input.currency,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
    },
  });

  const alreadyPaid = account.paymentStatus === "PAID";
  await prisma.acquisitionAccount.update({
    where: { id: input.accountId },
    data: {
      paymentStatus: "PAID",
      paidAt: account.paidAt || new Date(),
      stage: account.stage === "ACTIVE" ? "ACTIVE" : "PAYMENT_SUCCEEDED",
      stripeRef: account.stripeRef || input.stripeRef || input.stripeSubscriptionId || input.stripeCustomerId || input.eventId,
      winReason: account.winReason || "Verified post-demo Stripe payment",
    },
  });
  if (!alreadyPaid) {
    await addAcquisitionActivity(input.accountId, "PAYMENT_SUCCEEDED", "Stripe payment verified server-side.", { eventId: input.eventId, amountCents: input.amountCents });
  }
  await provisionPaidAcquisitionAccount(input.accountId, { amountCents: input.amountCents, stripeRef: input.stripeRef || input.stripeSubscriptionId || input.eventId });
  return event;
}


export function classifyResponseText(text: string) {
  const value = text.toLowerCase();
  if (/unsubscribe|remove me|stop emailing|do not contact|don't contact/.test(value)) return "UNSUBSCRIBE";
  if (/wrong person|not the right person|reach out to|contact my/.test(value)) return "REFERRAL";
  if (/not interested|no thanks|pass on this|not a fit/.test(value)) return "NOT_INTERESTED";
  if (/not now|later this year|next quarter|circle back|follow up in/.test(value)) return "NOT_NOW";
  if (/book|schedule|calendar|meeting|demo|available (monday|tuesday|wednesday|thursday|friday)/.test(value)) return "MEETING_REQUEST";
  if (/price|pricing|cost|budget|how much/.test(value)) return "PRICING";
  if (/api|integration|security|technical|architecture|stack|data/.test(value)) return "TECHNICAL";
  if (/interested|tell me more|sounds useful|let's talk|lets talk|curious/.test(value)) return "INTERESTED";
  if (/why|how would|what do you mean|can you explain|more information/.test(value)) return "NEEDS_INFORMATION";
  if (/concern|already use|vendor|contract|too expensive|not convinced/.test(value)) return "OBJECTION";
  return "OTHER";
}

export async function findPaidAcquisitionForEmail(email: string) {
  const normalized = email.toLowerCase().trim();
  return prisma.acquisitionAccount.findFirst({
    where: {
      paymentStatus: "PAID",
      OR: [
        { primaryEmail: normalized },
        { contacts: { some: { email: normalized } } },
      ],
    },
    orderBy: { paidAt: "desc" },
  });
}
