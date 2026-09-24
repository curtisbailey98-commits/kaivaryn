import { prisma } from "@/lib/prisma";
import {
  addAcquisitionActivity,
  classifyResponseText,
  nextActionForResponse,
  stageForResponse,
} from "@/lib/acquisition";
import {
  listRecentGmailInboxMessages,
  noteGoogleSyncSuccess,
  sendGoogleWorkspaceEmail,
} from "@/lib/providers/google-workspace";


function dailyEmailLimit() {
  const raw = Number(process.env.ACQUISITION_DAILY_EMAIL_LIMIT || "25");
  return Number.isFinite(raw) ? Math.min(250, Math.max(1, Math.floor(raw))) : 25;
}

function parseProviderRef(value?: string | null) {
  if (!value?.startsWith("gmail:")) return { messageId: null, threadId: null };
  const [, messageId, threadId] = value.split(":");
  return { messageId: messageId || null, threadId: threadId || null };
}

export async function sendAcquisitionOutreachEmail(messageId: string) {
  const message = await prisma.outreachMessage.findUnique({
    where: { id: messageId },
    include: { account: true, contact: true },
  });
  if (!message) throw new Error("Outreach message not found.");
  if (message.optedOutAt || message.status === "UNSUBSCRIBED") throw new Error("This contact has opted out.");
  if (["UNSUBSCRIBED", "NOT_INTERESTED", "CLOSED_LOST", "DISQUALIFIED"].includes(message.account.stage)) {
    throw new Error(`Active outreach is blocked while account is ${message.account.stage}.`);
  }
  if (message.account.qualificationScore < 55 || message.account.qualificationBand === "HOLD") {
    throw new Error("Account is below the evidence threshold for provider-backed outreach.");
  }
  const to = message.contact?.email || message.account.primaryEmail;
  if (!to) throw new Error("A verified work email is required before sending outreach.");
  if (!message.contact || !message.contact.verified) throw new Error("A verified acquisition contact is required before sending provider-backed outreach.");
  const sentSince = new Date(Date.now() - 24 * 60 * 60_000);
  const sentToday = await prisma.outreachMessage.count({
    where: { status: "SENT", sentAt: { gte: sentSince }, providerRef: { startsWith: "gmail:" } },
  });
  if (sentToday >= dailyEmailLimit()) throw new Error(`Daily Gmail execution ceiling reached (${dailyEmailLimit()}).`);

  const recent = await prisma.outreachMessage.findFirst({
    where: {
      accountId: message.accountId,
      contactId: message.contact.id,
      id: { not: message.id },
      status: "SENT",
      sentAt: { gte: new Date(Date.now() - 48 * 60 * 60_000) },
    },
    orderBy: { sentAt: "desc" },
  });
  if (recent) throw new Error("A provider-backed email was already sent to this contact within the last 48 hours.");
  const subject = message.subject || `A question about ${message.account.company}`;
  const optOut = /reply\s+(stop|unsubscribe)|opt[- ]?out|rather not hear/i.test(message.body)
    ? ""
    : "\n\nIf you'd rather not hear from Kaivaryn, reply stop and we'll close the outreach.";
  const result = await sendGoogleWorkspaceEmail({ to, subject, body: `${message.body}${optOut}` });
  await prisma.outreachMessage.update({
    where: { id: message.id },
    data: {
      status: "SENT",
      sentAt: message.sentAt || new Date(),
      providerRef: `gmail:${result.id}:${result.threadId || ""}`,
    },
  });
  const late = ["DEMO_BOOKED", "DEMO_COMPLETED", "CHECKOUT_READY", "PAYMENT_SUCCEEDED", "ONBOARDING", "ACTIVE"].includes(message.account.stage);
  if (!late) {
    await prisma.acquisitionAccount.update({ where: { id: message.accountId }, data: { stage: "CONTACTED" } });
  }
  await addAcquisitionActivity(message.accountId, "EMAIL_SENT", `Reverse-selling outreach sent through Gmail to ${to}.`, {
    outreachMessageId: message.id,
    providerMessageId: result.id,
    threadId: result.threadId,
  });
  return result;
}

export async function syncGmailReplies(limit = 50) {
  const messages = await listRecentGmailInboxMessages(limit);
  let matched = 0;
  let recorded = 0;

  for (const incoming of messages) {
    if (!incoming.fromEmail || !incoming.body) continue;
    const existing = await prisma.acquisitionInboundEvent.findUnique({
      where: { provider_providerEventId: { provider: "GMAIL", providerEventId: incoming.id } },
    });
    if (existing) continue;

    const contact = await prisma.acquisitionContact.findFirst({
      where: { email: incoming.fromEmail },
      include: { account: true },
      orderBy: { updatedAt: "desc" },
    });
    const account = contact?.account || await prisma.acquisitionAccount.findFirst({
      where: { primaryEmail: incoming.fromEmail },
      orderBy: { updatedAt: "desc" },
    });
    if (!account) continue;

    const recentOutreach = await prisma.outreachMessage.findFirst({
      where: {
        accountId: account.id,
        status: "SENT",
        providerRef: { startsWith: "gmail:" },
        sentAt: { not: null },
        ...(contact?.id ? { OR: [{ contactId: contact.id }, { contactId: null }] } : {}),
      },
      orderBy: { sentAt: "desc" },
    });
    if (!recentOutreach) continue;
    const ref = parseProviderRef(recentOutreach.providerRef);
    if (ref.threadId && incoming.threadId && ref.threadId !== incoming.threadId) continue;
    matched += 1;

    const responseClass = classifyResponseText(incoming.body);
    await prisma.acquisitionInboundEvent.create({
      data: {
        provider: "GMAIL",
        providerEventId: incoming.id,
        accountId: account.id,
        contactId: contact?.id || null,
        channel: "EMAIL",
        sender: incoming.fromEmail,
        subject: incoming.subject,
        body: incoming.body,
        responseClass,
        receivedAt: incoming.receivedAt,
      },
    });

    await prisma.outreachMessage.update({
      where: { id: recentOutreach.id },
      data: {
        repliedAt: incoming.receivedAt,
        responseClass,
        responseJson: JSON.stringify({
          provider: "GMAIL",
          providerEventId: incoming.id,
          threadId: incoming.threadId,
          classifiedBy: "deterministic-v2",
          syncedAt: new Date().toISOString(),
        }),
      },
    });

    const nextStage = stageForResponse(account.stage, responseClass);
    await prisma.acquisitionAccount.update({
      where: { id: account.id },
      data: { stage: nextStage, nextAction: nextActionForResponse(responseClass) },
    });
    if (responseClass === "UNSUBSCRIBE") {
      await prisma.outreachMessage.update({ where: { id: recentOutreach.id }, data: { optedOutAt: incoming.receivedAt, status: "UNSUBSCRIBED" } });
      if (contact) await prisma.acquisitionContact.update({ where: { id: contact.id }, data: { doNotCallAt: contact.doNotCallAt || new Date() } });
    }
    await addAcquisitionActivity(account.id, "GMAIL_REPLY_SYNCED", `Gmail reply classified as ${responseClass}.`, {
      providerEventId: incoming.id,
      sender: incoming.fromEmail,
      subject: incoming.subject,
      threadId: incoming.threadId,
    });
    recorded += 1;
  }

  await noteGoogleSyncSuccess();
  return { inspected: messages.length, matched, recorded };
}

export async function runQueuedEmailExecution(max = 10) {
  const queued = await prisma.outreachMessage.findMany({
    where: {
      status: "QUEUED",
      optedOutAt: null,
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    },
    orderBy: { scheduledAt: "asc" },
    take: Math.min(25, Math.max(1, max)),
  });
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const message of queued) {
    try {
      await sendAcquisitionOutreachEmail(message.id);
      results.push({ id: message.id, ok: true });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown send failure";
      await prisma.outreachMessage.update({ where: { id: message.id }, data: { status: "PAUSED" } }).catch(() => undefined);
      await addAcquisitionActivity(message.accountId, "EMAIL_SEND_BLOCKED", reason, { outreachMessageId: message.id }).catch(() => undefined);
      results.push({ id: message.id, ok: false, error: reason });
    }
  }
  return results;
}
