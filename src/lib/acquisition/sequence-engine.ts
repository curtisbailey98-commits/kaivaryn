import { prisma } from "@/lib/prisma";
import { getPlatformOrgId } from "./platform-org";
import { writeAudit } from "@/lib/audit";
import { generateReverseSellingMessage } from "./reverse-selling";

function domainOf(email: string | null | undefined): string | null {
  if (!email) return null;
  const parts = email.split("@");
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

/** Checked before every step is even drafted for a contact, and again
 *  before any send is requested — an opted-out contact must never re-enter
 *  a sequence, full stop. */
export async function isSuppressed(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const domain = domainOf(email);
  const hit = await prisma.suppressionEntry.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, ...(domain ? [{ domain }] : [])] },
  });
  return Boolean(hit);
}

export async function addSuppression(input: { email?: string; domain?: string; reason?: string }) {
  if (!input.email && !input.domain) throw new Error("email or domain required");
  return prisma.suppressionEntry.create({
    data: { email: input.email?.toLowerCase(), domain: input.domain?.toLowerCase(), reason: input.reason ?? "OPTED_OUT" },
  });
}

export async function enqueueSequence(input: { prospectAccountId: string; contactId: string; playbook: string; createdById: string }) {
  const contact = await prisma.prospectContact.findUniqueOrThrow({ where: { id: input.contactId } });
  if (await isSuppressed(contact.email)) {
    throw new Error(`Contact ${contact.email ?? contact.id} is on the suppression list — cannot enqueue.`);
  }

  const sequence = await prisma.outreachSequence.create({
    data: {
      prospectAccountId: input.prospectAccountId,
      contactId: input.contactId,
      playbook: input.playbook,
      state: "ACTIVE",
      currentStep: 0,
      createdById: input.createdById,
    },
  });
  await advanceSequence(sequence.id, input.createdById);
  return sequence;
}

/** Drafts the next message in the sequence. Never sends — see requestSend(). */
export async function advanceSequence(sequenceId: string, actorId: string) {
  const sequence = await prisma.outreachSequence.findUniqueOrThrow({
    where: { id: sequenceId },
    include: { contact: true, prospectAccount: true },
  });
  if (sequence.state !== "ACTIVE") return sequence;

  if (await isSuppressed(sequence.contact?.email)) {
    return prisma.outreachSequence.update({
      where: { id: sequenceId },
      data: { state: "OPTED_OUT", suppressedReason: "contact is on the suppression list" },
    });
  }

  const { subject, body } = await generateReverseSellingMessage(sequence.playbook, sequence.prospectAccountId);
  const personalizedBody = sequence.contact?.name ? body.replace("{{contact_first_name}}", sequence.contact.name.split(" ")[0]) : body.replace("{{contact_first_name}}", "there");

  const nextStep = sequence.currentStep + 1;
  await prisma.outreachMessage.create({
    data: {
      sequenceId,
      stepNumber: nextStep,
      channel: sequence.contact?.email ? "EMAIL" : "CALL_TASK",
      toAddress: sequence.contact?.email ?? null,
      subject,
      body: personalizedBody,
      status: "DRAFT",
      createdById: actorId,
    },
  });

  const updated = await prisma.outreachSequence.update({ where: { id: sequenceId }, data: { currentStep: nextStep } });
  if (sequence.prospectAccount.status === "AUDITED") {
    await prisma.prospectAccount.update({ where: { id: sequence.prospectAccountId }, data: { status: "OUTREACH_READY" } });
  }
  return updated;
}

export async function pauseSequence(sequenceId: string, reason: string) {
  return prisma.outreachSequence.update({ where: { id: sequenceId }, data: { state: "PAUSED", suppressedReason: reason } });
}

export async function stopSequence(sequenceId: string, reason: string) {
  return prisma.outreachSequence.update({ where: { id: sequenceId }, data: { state: "STOPPED", suppressedReason: reason } });
}

/**
 * Requests that a DRAFT message actually be sent. Mirrors
 * revenue/actions.ts's requestExternalAction exactly: creates an
 * ApprovalRequest, checks the registered send provider's
 * IntegrationConnection status, and NEVER executes here — approval and a
 * connected provider are both required before send-integration.ts (not yet
 * built; provider not yet connected) would actually fire. The message stays
 * DRAFT/PENDING until both are true.
 */
export async function requestOutreachSend(messageId: string, actorId: string) {
  const platformOrgId = await getPlatformOrgId();
  const message = await prisma.outreachMessage.findUniqueOrThrow({
    where: { id: messageId },
    include: { sequence: { include: { contact: true, prospectAccount: true } } },
  });

  if (await isSuppressed(message.toAddress)) {
    throw new Error("Recipient is on the suppression list — send blocked.");
  }

  const provider = message.channel === "EMAIL" ? "outreach_email" : "outreach_manual_task";
  const integration = await prisma.integrationConnection.findUnique({
    where: { organizationId_provider: { organizationId: platformOrgId, provider } },
  });
  const connected = integration?.status === "CONNECTED";
  const needsIntegration = connected ? null : provider;

  const approval = await prisma.approvalRequest.create({
    data: {
      organizationId: platformOrgId,
      type: "EXTERNAL_ACTION",
      title: `Send outreach step ${message.stepNumber} — ${message.sequence.prospectAccount.name}`,
      description: connected
        ? "Queued for approval. Will not send until approved AND credentials present."
        : `Needs integration: ${provider}. Credentials not connected — cannot send.`,
      status: "PENDING",
      needsIntegration,
      payloadJson: JSON.stringify({ messageId, provider, executesExternally: false, toAddress: message.toAddress }),
      requestedById: actorId,
    },
  });

  await writeAudit({
    organizationId: platformOrgId,
    actorId,
    action: "outreach_send.requested",
    entityType: "OutreachMessage",
    entityId: messageId,
    metadata: { needsIntegration, approvalId: approval.id },
  });

  if (connected) {
    await prisma.outreachMessage.update({ where: { id: messageId }, data: { status: "SCHEDULED" } });
  }

  return { approval, needsIntegration };
}
