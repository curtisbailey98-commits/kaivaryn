"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/tenant";
import {
  addAcquisitionActivity,
  addIntentSignal,
  authorityScore,
  classifyResponseText,
  findOrCreateAcquisitionAccount,
  generateMicroAudit,
  markDemoCompleted,
  saveAccountResearch,
  scoreAcquisitionAccount,
} from "@/lib/acquisition";
import { writeAudit } from "@/lib/audit";

async function requireAdmin() {
  const ctx = await getSessionContext();
  if (!ctx?.isSuperAdmin) throw new Error("Forbidden");
  return ctx;
}

const text = (fd: FormData, key: string) => String(fd.get(key) || "").trim();
const lines = (value: string) => value.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);

export async function createAcquisitionAccount(formData: FormData) {
  const ctx = await requireAdmin();
  const company = text(formData, "company");
  if (!company) return;
  const account = await findOrCreateAcquisitionAccount({
    company,
    domain: text(formData, "domain") || null,
    website: text(formData, "website") || null,
    industry: text(formData, "industry") || null,
    companySize: text(formData, "companySize") || null,
    source: text(formData, "source") || "MANUAL",
    primaryName: text(formData, "primaryName") || null,
    primaryEmail: text(formData, "primaryEmail") || null,
    primaryTitle: text(formData, "primaryTitle") || null,
    selectedProduct: text(formData, "selectedProduct") || null,
  });
  await addAcquisitionActivity(account.id, "ACCOUNT_CREATED", "Account entered into Kaivaryn acquisition intelligence.");
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.account_created", entityType: "AcquisitionAccount", entityId: account.id, metadata: { company } });
  redirect(`/admin/acquisition/${account.id}`);
}

export async function updateAcquisitionAccount(accountId: string, formData: FormData) {
  const ctx = await requireAdmin();
  const estimatedDealValue = Number(text(formData, "estimatedDealValue"));
  await prisma.acquisitionAccount.update({
    where: { id: accountId },
    data: {
      industry: text(formData, "industry") || null,
      companySize: text(formData, "companySize") || null,
      primaryName: text(formData, "primaryName") || null,
      primaryEmail: text(formData, "primaryEmail").toLowerCase() || null,
      primaryTitle: text(formData, "primaryTitle") || null,
      selectedProduct: text(formData, "selectedProduct") || null,
      painSummary: text(formData, "painSummary") || null,
      economicHypothesis: text(formData, "economicHypothesis") || null,
      estimatedDealValueCents: Number.isFinite(estimatedDealValue) && estimatedDealValue > 0 ? Math.round(estimatedDealValue * 100) : null,
    },
  });
  await addAcquisitionActivity(accountId, "ACCOUNT_UPDATED", "Account intelligence and commercial context updated.");
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.account_updated", entityType: "AcquisitionAccount", entityId: accountId });
  revalidatePath(`/admin/acquisition/${accountId}`);
}

export async function addIntentSignalAction(accountId: string, formData: FormData) {
  const ctx = await requireAdmin();
  await addIntentSignal({
    accountId,
    type: text(formData, "type") || "OBSERVED_SIGNAL",
    category: text(formData, "category") || "PUBLIC_SIGNAL",
    source: text(formData, "source") || "MANUAL_RESEARCH",
    sourceUrl: text(formData, "sourceUrl") || null,
    evidence: text(formData, "evidence") || null,
    strength: Number(text(formData, "strength") || 50),
    confidence: Number(text(formData, "confidence") || 50),
  });
  await scoreAcquisitionAccount(accountId);
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.intent_added", entityType: "AcquisitionAccount", entityId: accountId });
  revalidatePath(`/admin/acquisition/${accountId}`);
  revalidatePath("/admin/acquisition");
}

export async function runQualificationAction(accountId: string) {
  const ctx = await requireAdmin();
  await scoreAcquisitionAccount(accountId);
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.qualification_scored", entityType: "AcquisitionAccount", entityId: accountId });
  revalidatePath(`/admin/acquisition/${accountId}`);
  revalidatePath("/admin/acquisition");
}

export async function saveResearchAction(accountId: string, formData: FormData) {
  const ctx = await requireAdmin();
  await saveAccountResearch(accountId, {
    businessModel: text(formData, "businessModel") || null,
    revenueModel: text(formData, "revenueModel") || null,
    verifiedFacts: lines(text(formData, "verifiedFacts")),
    hypotheses: lines(text(formData, "hypotheses")),
    techStack: lines(text(formData, "techStack")),
    painHypotheses: lines(text(formData, "painHypotheses")),
    evidence: lines(text(formData, "evidence")),
  });
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.research_updated", entityType: "AcquisitionAccount", entityId: accountId });
  revalidatePath(`/admin/acquisition/${accountId}`);
}

export async function generateMicroAuditAction(accountId: string) {
  const ctx = await requireAdmin();
  await generateMicroAudit(accountId);
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.micro_audit_generated", entityType: "AcquisitionAccount", entityId: accountId });
  revalidatePath(`/admin/acquisition/${accountId}`);
}

export async function saveOutreachAction(accountId: string, messageId: string, formData: FormData) {
  const ctx = await requireAdmin();
  const status = text(formData, "status") || "DRAFT";
  const responseClass = text(formData, "responseClass") || null;
  const optedOut = status === "UNSUBSCRIBED";
  await prisma.outreachMessage.update({
    where: { id: messageId },
    data: {
      subject: text(formData, "subject") || null,
      body: text(formData, "body"),
      status,
      sentAt: status === "SENT" ? new Date() : undefined,
      repliedAt: responseClass ? new Date() : undefined,
      responseClass,
      optedOutAt: optedOut ? new Date() : undefined,
    },
  });
  const account = await prisma.acquisitionAccount.findUnique({ where: { id: accountId } });
  if (account) {
    let stage = account.stage;
    const protectedLateStage = ["DEMO_BOOKED", "DEMO_COMPLETED", "CHECKOUT_READY", "PAYMENT_SUCCEEDED", "ONBOARDING", "ACTIVE"].includes(account.stage);
    if (!protectedLateStage && status === "SENT") stage = "CONTACTED";
    if (!protectedLateStage && responseClass && ["INTERESTED", "CURIOUS", "MEETING_REQUEST"].includes(responseClass)) stage = "ENGAGED";
    if (responseClass === "UNSUBSCRIBE" || optedOut) stage = "UNSUBSCRIBED";
    await prisma.acquisitionAccount.update({ where: { id: accountId }, data: { stage } });
  }
  await addAcquisitionActivity(accountId, "OUTREACH_UPDATED", `Outreach ${status}${responseClass ? `; response ${responseClass}` : ""}.`);
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.outreach_updated", entityType: "OutreachMessage", entityId: messageId });
  revalidatePath(`/admin/acquisition/${accountId}`);
}

export async function markDemoCompletedAction(accountId: string) {
  const ctx = await requireAdmin();
  await markDemoCompleted(accountId);
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.demo_completed_checkout_unlocked", entityType: "AcquisitionAccount", entityId: accountId });
  revalidatePath(`/admin/acquisition/${accountId}`);
  revalidatePath("/admin/acquisition");
  revalidatePath("/admin/demos");
}

export async function markDemoBookedAction(accountId: string) {
  const ctx = await requireAdmin();
  await prisma.acquisitionAccount.update({ where: { id: accountId }, data: { stage: "DEMO_BOOKED" } });
  const account = await prisma.acquisitionAccount.findUnique({ where: { id: accountId } });
  if (account?.demoRequestId) await prisma.demoRequest.update({ where: { id: account.demoRequestId }, data: { status: "SCHEDULED" } });
  await addAcquisitionActivity(accountId, "DEMO_BOOKED", "Executive consultation/demo booked.");
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.demo_booked", entityType: "AcquisitionAccount", entityId: accountId });
  revalidatePath(`/admin/acquisition/${accountId}`);
}


export async function addContactAction(accountId: string, formData: FormData) {
  const ctx = await requireAdmin();
  const email = text(formData, "email").toLowerCase() || null;
  const title = text(formData, "title") || null;
  const existing = email ? await prisma.acquisitionContact.findFirst({ where: { accountId, email } }) : null;
  if (existing) {
    await prisma.acquisitionContact.update({
      where: { id: existing.id },
      data: {
        name: text(formData, "name") || existing.name,
        title: title || existing.title,
        phone: text(formData, "phone") || existing.phone,
        publicProfile: text(formData, "publicProfile") || existing.publicProfile,
        authorityScore: Math.max(existing.authorityScore, authorityScore(title)),
        verified: formData.get("verified") === "on" || existing.verified,
      },
    });
  } else {
    await prisma.acquisitionContact.create({
      data: {
        accountId,
        name: text(formData, "name") || null,
        email,
        title,
        phone: text(formData, "phone") || null,
        publicProfile: text(formData, "publicProfile") || null,
        authorityScore: authorityScore(title),
        verified: formData.get("verified") === "on",
        source: text(formData, "source") || "MANUAL_RESEARCH",
      },
    });
  }
  await scoreAcquisitionAccount(accountId);
  await addAcquisitionActivity(accountId, "CONTACT_ENRICHED", `Decision-maker/contact intelligence updated${email ? ` for ${email}` : ""}.`);
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.contact_upserted", entityType: "AcquisitionAccount", entityId: accountId });
  revalidatePath(`/admin/acquisition/${accountId}`);
}

export async function saveSecondaryQualificationAction(accountId: string, formData: FormData) {
  const ctx = await requireAdmin();
  const data = {
    need: text(formData, "need"),
    economicCost: text(formData, "economicCost"),
    authority: text(formData, "authority"),
    stakeholders: text(formData, "stakeholders"),
    budgetSignal: text(formData, "budgetSignal"),
    timing: text(formData, "timing"),
    currentSolution: text(formData, "currentSolution"),
    costOfInaction: text(formData, "costOfInaction"),
    implementationConstraints: text(formData, "implementationConstraints"),
    salesQualified: formData.get("salesQualified") === "on",
  };
  const objections = lines(text(formData, "objections"));
  const stakeholders = lines(data.stakeholders);
  const account = await prisma.acquisitionAccount.findUnique({ where: { id: accountId } });
  const preserveLateStage = account && ["DEMO_BOOKED", "DEMO_COMPLETED", "CHECKOUT_READY", "PAYMENT_SUCCEEDED", "ONBOARDING", "ACTIVE"].includes(account.stage);
  await prisma.acquisitionAccount.update({
    where: { id: accountId },
    data: {
      secondaryQualificationJson: JSON.stringify(data),
      objectionsJson: JSON.stringify(objections),
      stakeholdersJson: JSON.stringify(stakeholders),
      nextAction: text(formData, "nextAction") || null,
      stage: data.salesQualified && !preserveLateStage ? "SALES_QUALIFIED" : undefined,
    },
  });
  await addAcquisitionActivity(accountId, "SECONDARY_QUALIFICATION", data.salesQualified ? "Prospect passed conversational secondary qualification." : "Secondary qualification updated; opportunity remains under evaluation.", data);
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.secondary_qualification_updated", entityType: "AcquisitionAccount", entityId: accountId });
  revalidatePath(`/admin/acquisition/${accountId}`);
}

export async function recordInboundResponseAction(accountId: string, formData: FormData) {
  const ctx = await requireAdmin();
  const body = text(formData, "response");
  if (!body) return;
  const responseClass = classifyResponseText(body);
  await prisma.outreachMessage.create({
    data: {
      accountId,
      channel: text(formData, "channel") || "EMAIL",
      body,
      status: "REPLIED",
      repliedAt: new Date(),
      responseClass,
      responseJson: JSON.stringify({ classifiedBy: "deterministic-v1", capturedAt: new Date().toISOString() }),
    },
  });
  const current = await prisma.acquisitionAccount.findUnique({ where: { id: accountId } });
  const protectedLateStage = current && ["DEMO_BOOKED", "DEMO_COMPLETED", "CHECKOUT_READY", "PAYMENT_SUCCEEDED", "ONBOARDING", "ACTIVE"].includes(current.stage);
  const nextStage = responseClass === "UNSUBSCRIBE"
    ? "UNSUBSCRIBED"
    : responseClass === "NOT_INTERESTED"
      ? "NOT_INTERESTED"
      : !protectedLateStage && ["INTERESTED", "MEETING_REQUEST", "PRICING", "TECHNICAL", "NEEDS_INFORMATION"].includes(responseClass)
        ? "ENGAGED"
        : undefined;
  if (nextStage) await prisma.acquisitionAccount.update({ where: { id: accountId }, data: { stage: nextStage } });
  await addAcquisitionActivity(accountId, "INBOUND_RESPONSE", `Inbound response classified as ${responseClass}.`, { responseClass });
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.response_classified", entityType: "AcquisitionAccount", entityId: accountId, metadata: { responseClass } });
  revalidatePath(`/admin/acquisition/${accountId}`);
  revalidatePath("/admin/acquisition");
}
