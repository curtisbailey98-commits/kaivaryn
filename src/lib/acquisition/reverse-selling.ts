import { prisma } from "@/lib/prisma";
import { AcquisitionPlaybook } from "@/lib/enums";

const PLAYBOOK_FRAME: Record<string, { openLine: string; closingQuestion: string }> = {
  [AcquisitionPlaybook.REVENUE_RECOVERY]: {
    openLine: "we noticed some patterns worth flagging around lead follow-up and pipeline conversion",
    closingQuestion: "If that gap is real, is it something worth 20 minutes to size accurately?",
  },
  [AcquisitionPlaybook.OPERATIONS_EFFICIENCY]: {
    openLine: "we noticed some signals consistent with manual, process-heavy operations",
    closingQuestion: "Would it be useful to see where the biggest time-cost actually sits?",
  },
  [AcquisitionPlaybook.AI_AGENTS]: {
    openLine: "we noticed signals suggesting AI/automation is already on your radar",
    closingQuestion: "Worth comparing notes on where an AI agent would actually move a number for you?",
  },
  [AcquisitionPlaybook.SALES_AUTOMATION]: {
    openLine: "we noticed hiring/growth signals that often outpace manual sales processes",
    closingQuestion: "Is manual sales process still keeping pace with where the team is headed?",
  },
  [AcquisitionPlaybook.CUSTOMER_SERVICE_AUTOMATION]: {
    openLine: "we noticed signals consistent with a growing support/service load",
    closingQuestion: "Is response time or ticket volume becoming a real cost center?",
  },
  [AcquisitionPlaybook.LEAD_CONVERSION]: {
    openLine: "we noticed engagement signals that suggest real top-of-funnel interest",
    closingQuestion: "How much of that interest do you think is actually converting today?",
  },
  [AcquisitionPlaybook.WORKFLOW_AUTOMATION]: {
    openLine: "we noticed signals consistent with repetitive, manual workflow patterns",
    closingQuestion: "Is there a specific workflow that comes to mind as the obvious time sink?",
  },
};

/**
 * Generates a reverse-selling message: OBSERVATION → ECONOMIC HYPOTHESIS →
 * DIAGNOSTIC QUESTION. Deliberately avoids "we'd love to work with you"
 * framing — the prospect is asked a question, not pitched. Pulls only from
 * real MicroAudit/Finding content already on record; never invents a claim
 * about the prospect's business that isn't backed by a stored Finding.
 */
export async function generateReverseSellingMessage(playbook: string, prospectAccountId: string) {
  const account = await prisma.prospectAccount.findUniqueOrThrow({ where: { id: prospectAccountId } });
  const latestAudit = await prisma.microAudit.findFirst({ where: { prospectAccountId }, orderBy: { createdAt: "desc" } });
  const frame = PLAYBOOK_FRAME[playbook] ?? PLAYBOOK_FRAME[AcquisitionPlaybook.WORKFLOW_AUTOMATION];

  const observationLine = latestAudit
    ? latestAudit.summary
    : `${frame.openLine} at ${account.name}`;

  const subject = `Quick observation about ${account.name}`;
  const body = [
    `Hi {{contact_first_name}},`,
    "",
    `${frame.openLine.charAt(0).toUpperCase()}${frame.openLine.slice(1)}.`,
    "",
    observationLine,
    "",
    "Based on the available evidence, this may represent an opportunity — but we don't know yet whether the underlying numbers actually support that. Before recommending anything, we'd want to establish whether it's significant enough to be worth a closer look.",
    "",
    frame.closingQuestion,
    "",
    "No pitch attached — just trying to figure out if this is worth either of our time.",
    "",
    "— Kaivaryn",
  ].join("\n");

  return { subject, body, playbook };
}
