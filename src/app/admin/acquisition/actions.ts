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
  nextActionForResponse,
  saveAccountResearch,
  scoreAcquisitionAccount,
  stageForResponse,
} from "@/lib/acquisition";
import { writeAudit } from "@/lib/audit";
import { sendAcquisitionOutreachEmail, syncGmailReplies } from "@/lib/acquisition-execution";
import { isE164Phone, startAcquisitionCall } from "@/lib/call-agent";
import { createGoogleCalendarDemo } from "@/lib/providers/google-workspace";

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
  const scheduledAtRaw = text(formData, "scheduledAt");
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
  if (scheduledAtRaw && Number.isNaN(scheduledAt?.getTime())) throw new Error("Invalid outreach schedule time.");
  const currentMessage = await prisma.outreachMessage.findUnique({ where: { id: messageId } });
  if (!currentMessage || currentMessage.accountId !== accountId) throw new Error("Outreach message not found.");
  if (status === "SENT" && !currentMessage.providerRef) throw new Error("Use Send through Gmail so SENT reflects a real provider delivery attempt.");
  const optedOut = status === "UNSUBSCRIBED" || responseClass === "UNSUBSCRIBE";
  await prisma.outreachMessage.update({
    where: { id: messageId },
    data: {
      subject: text(formData, "subject") || null,
      body: text(formData, "body"),
      status,
      sentAt: status === "SENT" ? (currentMessage.sentAt || new Date()) : undefined,
      repliedAt: responseClass ? new Date() : undefined,
      responseClass,
      optedOutAt: optedOut ? new Date() : undefined,
      scheduledAt: status === "QUEUED" ? scheduledAt : status === "DRAFT" ? null : undefined,
    },
  });
  const account = await prisma.acquisitionAccount.findUnique({ where: { id: accountId } });
  if (account) {
    let stage = account.stage;
    const protectedLateStage = ["DEMO_BOOKED", "DEMO_COMPLETED", "CHECKOUT_READY", "PAYMENT_SUCCEEDED", "ONBOARDING", "ACTIVE"].includes(account.stage);
    if (!protectedLateStage && status === "SENT") stage = "CONTACTED";
    stage = stageForResponse(stage, responseClass || (optedOut ? "UNSUBSCRIBE" : null));
    await prisma.acquisitionAccount.update({
      where: { id: accountId },
      data: {
        stage,
        nextAction: responseClass ? nextActionForResponse(responseClass) : account.nextAction,
      },
    });
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
  const phone = text(formData, "phone") || null;
  const title = text(formData, "title") || null;
  const phoneConsent = formData.get("phoneConsent") === "on";
  const phoneConsentSource = text(formData, "phoneConsentSource") || null;
  if (phone && !isE164Phone(phone)) throw new Error("Phone numbers used by the call agent must be E.164, for example +17045551212.");
  if (phoneConsent && !phoneConsentSource) throw new Error("Record the source of automated-call consent before enabling AI voice calls.");
  const account = await prisma.acquisitionAccount.findUnique({ where: { id: accountId } });
  const existing = email
    ? await prisma.acquisitionContact.findFirst({ where: { accountId, email } })
    : phone
      ? await prisma.acquisitionContact.findFirst({ where: { accountId, phone } })
      : null;
  if (existing) {
    await prisma.acquisitionContact.update({
      where: { id: existing.id },
      data: {
        name: text(formData, "name") || existing.name,
        title: title || existing.title,
        phone: phone || existing.phone,
        publicProfile: text(formData, "publicProfile") || existing.publicProfile,
        authorityScore: Math.max(existing.authorityScore, authorityScore(title)),
        verified: formData.get("verified") === "on" || existing.verified,
        timezone: text(formData, "timezone") || existing.timezone,
        phoneConsentAt: phoneConsent ? (existing.phoneConsentAt || new Date()) : existing.phoneConsentAt,
        phoneConsentSource: phoneConsent ? phoneConsentSource : existing.phoneConsentSource,
        doNotCallAt: formData.get("doNotCall") === "on" ? (existing.doNotCallAt || new Date()) : existing.doNotCallAt,
      },
    });
  } else {
    await prisma.acquisitionContact.create({
      data: {
        accountId,
        name: text(formData, "name") || null,
        email,
        title,
        phone,
        publicProfile: text(formData, "publicProfile") || null,
        authorityScore: authorityScore(title),
        verified: formData.get("verified") === "on",
        timezone: text(formData, "timezone") || null,
        phoneConsentAt: phoneConsent ? new Date() : null,
        phoneConsentSource: phoneConsent ? phoneConsentSource : null,
        doNotCallAt: formData.get("doNotCall") === "on" ? new Date() : null,
        source: text(formData, "source") || "MANUAL_RESEARCH",
        isPrimary: Boolean(email && account?.primaryEmail && email === account.primaryEmail),
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
  if (!current) throw new Error("Acquisition account not found");
  const nextStage = stageForResponse(current.stage, responseClass);
  await prisma.acquisitionAccount.update({
    where: { id: accountId },
    data: {
      stage: nextStage,
      nextAction: nextActionForResponse(responseClass),
    },
  });
  await addAcquisitionActivity(accountId, "INBOUND_RESPONSE", `Inbound response classified as ${responseClass}.`, { responseClass });
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.response_classified", entityType: "AcquisitionAccount", entityId: accountId, metadata: { responseClass } });
  revalidatePath(`/admin/acquisition/${accountId}`);
  revalidatePath("/admin/acquisition");
}


export async function sendOutreachEmailAction(accountId: string, messageId: string) {
  const ctx = await requireAdmin();
  await sendAcquisitionOutreachEmail(messageId);
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.gmail_sent", entityType: "OutreachMessage", entityId: messageId });
  revalidatePath(`/admin/acquisition/${accountId}`);
  revalidatePath("/admin/acquisition");
}

export async function syncGmailRepliesAction() {
  const ctx = await requireAdmin();
  const result = await syncGmailReplies(50);
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.gmail_sync", entityType: "AcquisitionProviderConnection", entityId: "GOOGLE_WORKSPACE", metadata: result });
  revalidatePath("/admin/acquisition");
  revalidatePath("/admin/acquisition/execution");
}

export async function startCallAgentAction(accountId: string, contactId: string) {
  const ctx = await requireAdmin();
  const call = await startAcquisitionCall(accountId, contactId);
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.ai_call_started", entityType: "AcquisitionCall", entityId: call.id, metadata: { accountId, contactId } });
  revalidatePath(`/admin/acquisition/${accountId}`);
  revalidatePath("/admin/acquisition/execution");
}

export async function scheduleGoogleDemoAction(accountId: string, formData: FormData) {
  const ctx = await requireAdmin();
  const account = await prisma.acquisitionAccount.findUnique({
    where: { id: accountId },
    include: { contacts: { orderBy: [{ isPrimary: "desc" }, { authorityScore: "desc" }] }, demoRequest: true },
  });
  if (!account) throw new Error("Acquisition account not found");
  const attendee = text(formData, "attendeeEmail").toLowerCase() || account.primaryEmail || account.contacts.find((c) => c.email)?.email;
  if (!attendee) throw new Error("A prospect email is required to schedule a Google Calendar demo.");
  const startsAtLocal = text(formData, "startsAtLocal");
  const timeZone = text(formData, "timeZone") || "America/New_York";
  const duration = Number(text(formData, "durationMinutes") || "30");
  if (!startsAtLocal) throw new Error("Demo start time is required.");
  const event = await createGoogleCalendarDemo({
    summary: `Kaivaryn executive demo — ${account.company}`,
    description: `Kaivaryn executive demo for ${account.company}. Acquisition account: ${account.id}.`,
    attendeeEmail: attendee,
    startsAtLocal,
    timeZone,
    durationMinutes: Number.isFinite(duration) ? Math.min(90, Math.max(15, duration)) : 30,
  });

  let demoRequestId = account.demoRequestId;
  if (account.demoRequest) {
    await prisma.demoRequest.update({
      where: { id: account.demoRequest.id },
      data: { status: "SCHEDULED", zoomLink: event.meetUrl || event.htmlLink || account.demoRequest.zoomLink },
    });
  } else {
    const demo = await prisma.demoRequest.create({
      data: {
        name: account.primaryName || account.contacts[0]?.name || "Prospect",
        email: attendee,
        company: account.company,
        title: account.primaryTitle || account.contacts[0]?.title || null,
        phone: account.phone || account.contacts[0]?.phone || null,
        products: account.selectedProduct || "AI_CONSULTING",
        companySize: account.companySize,
        message: account.painSummary || "Scheduled from Acquisition Intelligence",
        zoomLink: event.meetUrl || event.htmlLink,
        status: "SCHEDULED",
      },
    });
    demoRequestId = demo.id;
  }
  await prisma.acquisitionAccount.update({
    where: { id: account.id },
    data: { stage: "DEMO_BOOKED", demoRequestId },
  });
  await addAcquisitionActivity(account.id, "GOOGLE_DEMO_BOOKED", "Executive demo scheduled through Google Calendar.", { eventId: event.id, meetUrl: event.meetUrl, attendee });
  await writeAudit({ actorId: ctx.user.id, action: "acquisition.google_demo_booked", entityType: "AcquisitionAccount", entityId: account.id, metadata: { eventId: event.id } });
  revalidatePath(`/admin/acquisition/${account.id}`);
  revalidatePath("/admin/demos");
}
