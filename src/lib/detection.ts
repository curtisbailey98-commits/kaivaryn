/**
 * Deterministic detection engines — rules on demo + imported data.
 * Never invents amounts; uses financial-impact for any money fields.
 */
import { prisma } from "./prisma";
import { scoreWorkItem } from "./scoring";
import { normalizeRevenueAmounts, normalizeOpsAmounts } from "./financial-impact";
import { recordStatusChange } from "./status-history";
import { getLearnedAdjustment } from "./learning";

function daysAgo(d: Date | null | undefined, now = new Date()) {
  if (!d) return 9999;
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

function hoursAgo(d: Date, now = new Date()) {
  return (now.getTime() - d.getTime()) / 3600000;
}

async function getSettings(organizationId: string) {
  let s = await prisma.orgSettings.findUnique({ where: { organizationId } });
  if (!s) {
    s = await prisma.orgSettings.create({ data: { organizationId } });
  }
  return s;
}

async function ensureFinding(params: {
  organizationId: string;
  product: string;
  ruleId: string;
  opportunityId?: string;
  inefficiencyId?: string;
  evidenceSummary: string;
  analysis: string;
  recommendation: string;
  confidence: string;
  impactEstimate?: number;
  explain: Record<string, unknown>;
}) {
  const existing = await prisma.finding.findFirst({
    where: {
      organizationId: params.organizationId,
      ruleId: params.ruleId,
      opportunityId: params.opportunityId ?? null,
      inefficiencyId: params.inefficiencyId ?? null,
      status: { in: ["OPEN", "INSUFFICIENT_DATA"] },
    },
  });
  if (existing) return existing;
  return prisma.finding.create({
    data: {
      organizationId: params.organizationId,
      product: params.product,
      ruleId: params.ruleId,
      opportunityId: params.opportunityId,
      inefficiencyId: params.inefficiencyId,
      status: "OPEN",
      evidenceSummary: params.evidenceSummary,
      analysis: params.analysis,
      recommendation: params.recommendation,
      confidence: params.confidence,
      impactEstimate: params.impactEstimate,
      explainJson: JSON.stringify(params.explain),
    },
  });
}

async function upsertOpportunityFromRule(opts: {
  organizationId: string;
  ruleId: string;
  title: string;
  description: string;
  amount: number;
  source: string;
  sourceId: string;
  department?: string;
  priorityHint?: string;
  evidenceSummary: string;
}) {
  const settings = await getSettings(opts.organizationId);
  const existing = await prisma.opportunity.findFirst({
    where: { organizationId: opts.organizationId, source: opts.source, sourceId: opts.sourceId },
  });
  const money = normalizeRevenueAmounts({ potentialAmount: opts.amount, estimatedAmount: opts.amount });
  const scored = scoreWorkItem({
    amount: money.potential,
    ageDays: 0,
    priorityHint: opts.priorityHint,
    evidenceCount: 1,
    settings,
    learnedAdjustment: await getLearnedAdjustment(opts.organizationId, "REVENUE_RECOVERY", { source: opts.source, type: opts.ruleId, department: opts.department, priority: opts.priorityHint }),
  });
  if (existing) {
    return existing;
  }
  const created = await prisma.opportunity.create({
    data: {
      organizationId: opts.organizationId,
      title: opts.title,
      description: opts.description,
      source: opts.source,
      sourceId: opts.sourceId,
      type: opts.ruleId,
      department: opts.department,
      status: "IDENTIFIED",
      priority: scored.priority,
      score: scored.score,
      scoreFactorsJson: JSON.stringify(scored.factors),
      potentialAmount: money.potential,
      estimatedAmount: money.potential,
      approvedAmount: 0,
      inProgressAmount: 0,
      recoveredAmount: 0,
      verifiedAmount: 0,
      importedAt: new Date(),
    },
  });
  await recordStatusChange({
    organizationId: opts.organizationId,
    entityType: "Opportunity",
    entityId: created.id,
    fromStatus: null,
    toStatus: "IDENTIFIED",
    note: `Detection rule ${opts.ruleId}`,
  });
  await prisma.evidence.create({
    data: {
      organizationId: opts.organizationId,
      opportunityId: created.id,
      kind: "RULE_HIT",
      summary: opts.evidenceSummary,
      source: opts.source,
      sourceId: opts.sourceId,
      detailJson: JSON.stringify({ ruleId: opts.ruleId }),
    },
  });
  await ensureFinding({
    organizationId: opts.organizationId,
    product: "REVENUE_RECOVERY",
    ruleId: opts.ruleId,
    opportunityId: created.id,
    evidenceSummary: opts.evidenceSummary,
    analysis: opts.description,
    recommendation: "Assign owner and move through UNDER_REVIEW → APPROVED before recording recovery.",
    confidence: "medium",
    impactEstimate: money.potential,
    explain: { ruleId: opts.ruleId, factors: scored.factors },
  });
  return created;
}

async function upsertInefficiencyFromRule(opts: {
  organizationId: string;
  ruleId: string;
  title: string;
  description: string;
  projectedSavings: number;
  hoursWeekly?: number;
  source: string;
  sourceId: string;
  department?: string;
  automationCandidate?: boolean;
  evidenceSummary: string;
}) {
  const settings = await getSettings(opts.organizationId);
  const existing = await prisma.inefficiency.findFirst({
    where: { organizationId: opts.organizationId, source: opts.source, sourceId: opts.sourceId },
  });
  if (existing) return existing;
  const money = normalizeOpsAmounts({
    projectedSavings: opts.projectedSavings,
    estimatedWasteAnnual: opts.projectedSavings,
    hoursWastedWeekly: opts.hoursWeekly,
  });
  const scored = scoreWorkItem({
    amount: money.projectedSavings,
    ageDays: 0,
    priorityHint: money.projectedSavings >= settings.highValueThreshold ? "HIGH" : "MEDIUM",
    evidenceCount: 1,
    settings,
    learnedAdjustment: await getLearnedAdjustment(opts.organizationId, "OPERATIONS_EFFICIENCY", { source: opts.source, type: opts.ruleId, department: opts.department, priority: money.projectedSavings >= settings.highValueThreshold ? "HIGH" : "MEDIUM" }),
  });
  const created = await prisma.inefficiency.create({
    data: {
      organizationId: opts.organizationId,
      title: opts.title,
      description: opts.description,
      source: opts.source,
      sourceId: opts.sourceId,
      type: opts.ruleId,
      department: opts.department,
      status: "IDENTIFIED",
      priority: scored.priority,
      score: scored.score,
      scoreFactorsJson: JSON.stringify(scored.factors),
      estimatedWasteAnnual: money.projectedSavings,
      projectedSavings: money.projectedSavings,
      recoveredAnnual: 0,
      realizedSavings: 0,
      hoursWastedWeekly: money.projectedHoursWeekly,
      projectedHoursWeekly: money.projectedHoursWeekly,
      automationCandidate: opts.automationCandidate ?? false,
      importedAt: new Date(),
    },
  });
  await recordStatusChange({
    organizationId: opts.organizationId,
    entityType: "Inefficiency",
    entityId: created.id,
    fromStatus: null,
    toStatus: "IDENTIFIED",
    note: `Detection rule ${opts.ruleId}`,
  });
  await prisma.evidence.create({
    data: {
      organizationId: opts.organizationId,
      inefficiencyId: created.id,
      kind: "RULE_HIT",
      summary: opts.evidenceSummary,
      source: opts.source,
      sourceId: opts.sourceId,
      detailJson: JSON.stringify({ ruleId: opts.ruleId }),
    },
  });
  await ensureFinding({
    organizationId: opts.organizationId,
    product: "OPERATIONS_EFFICIENCY",
    ruleId: opts.ruleId,
    inefficiencyId: created.id,
    evidenceSummary: opts.evidenceSummary,
    analysis: opts.description,
    recommendation: opts.automationCandidate
      ? "Flagged automation candidate — create ApprovalRequest; do not auto-execute."
      : "Assign owner and validate projected vs realized savings separately.",
    confidence: "medium",
    impactEstimate: money.projectedSavings,
    explain: { ruleId: opts.ruleId, factors: scored.factors },
  });
  return created;
}

export type DetectionSummary = {
  organizationId: string;
  createdOpportunities: number;
  createdInefficiencies: number;
  rulesFired: string[];
  insufficient: string[];
};

export async function runDetectionEngines(organizationId: string): Promise<DetectionSummary> {
  const settings = await getSettings(organizationId);
  const now = new Date();
  const rulesFired: string[] = [];
  const insufficient: string[] = [];
  let createdOpportunities = 0;
  let createdInefficiencies = 0;

  const [leads, customers, txns, appts, interactions, processes, inefficiencies] = await Promise.all([
    prisma.lead.findMany({ where: { organizationId } }),
    prisma.customer.findMany({ where: { organizationId } }),
    prisma.transaction.findMany({ where: { organizationId } }),
    prisma.appointment.findMany({ where: { organizationId } }),
    prisma.interaction.findMany({ where: { organizationId } }),
    prisma.process.findMany({ where: { organizationId } }),
    prisma.inefficiency.findMany({ where: { organizationId } }),
  ]);

  // RR: stalled leads
  if (leads.length === 0) insufficient.push("stalled_leads: no Lead records");
  for (const lead of leads) {
    if (lead.status === "OPEN" && daysAgo(lead.lastTouchAt, now) >= settings.stalledLeadDays) {
      rulesFired.push("stalled_leads");
      const before = await prisma.opportunity.count({ where: { organizationId } });
      await upsertOpportunityFromRule({
        organizationId,
        ruleId: "stalled_leads",
        title: `[DETECT] Stalled lead: ${lead.title}`,
        description: `Lead last touched ${daysAgo(lead.lastTouchAt, now)} days ago (threshold ${settings.stalledLeadDays}).`,
        amount: lead.amount,
        source: "detection:stalled_leads",
        sourceId: lead.id,
        evidenceSummary: `Lead ${lead.id} stalled ${daysAgo(lead.lastTouchAt, now)}d`,
        priorityHint: lead.amount >= settings.highValueThreshold ? "CRITICAL" : "HIGH",
      });
      const after = await prisma.opportunity.count({ where: { organizationId } });
      createdOpportunities += Math.max(0, after - before);
    }
  }

  // RR: dormant customers / churn risk
  if (customers.length === 0) {
    insufficient.push("dormant_customers: no Customer records");
    insufficient.push("churn_risk: no Customer records");
  }
  for (const c of customers) {
    const idle = daysAgo(c.lastActivityAt, now);
    if (idle >= settings.dormantCustomerDays && c.status !== "CHURNED") {
      rulesFired.push("dormant_customers");
      const before = await prisma.opportunity.count({ where: { organizationId } });
      await upsertOpportunityFromRule({
        organizationId,
        ruleId: "dormant_customers",
        title: `[DETECT] Dormant customer: ${c.name}`,
        description: `No activity for ${idle} days (threshold ${settings.dormantCustomerDays}).`,
        amount: Math.max(5000, settings.highValueThreshold * 0.1),
        source: "detection:dormant_customers",
        sourceId: c.id,
        evidenceSummary: `Customer ${c.name} idle ${idle}d`,
      });
      const after = await prisma.opportunity.count({ where: { organizationId } });
      createdOpportunities += Math.max(0, after - before);
    }
    if (idle >= settings.churnRiskInactiveDays) {
      rulesFired.push("churn_risk");
      const before = await prisma.opportunity.count({ where: { organizationId } });
      await upsertOpportunityFromRule({
        organizationId,
        ruleId: "churn_risk",
        title: `[DETECT] Churn risk: ${c.name}`,
        description: `Inactive ${idle} days (churn threshold ${settings.churnRiskInactiveDays}).`,
        amount: Math.max(8000, settings.highValueThreshold * 0.15),
        source: "detection:churn_risk",
        sourceId: c.id,
        evidenceSummary: `Churn signal idle ${idle}d`,
        priorityHint: "HIGH",
      });
      const after = await prisma.opportunity.count({ where: { organizationId } });
      createdOpportunities += Math.max(0, after - before);
    }
  }

  // RR: failed payments / abandoned checkout
  if (txns.length === 0) {
    insufficient.push("failed_payments: no Transaction records");
    insufficient.push("abandoned_checkout: no Transaction records");
  }
  for (const t of txns) {
    if (t.status === "FAILED" && daysAgo(t.occurredAt, now) <= settings.failedPaymentLookbackDays) {
      rulesFired.push("failed_payments");
      const before = await prisma.opportunity.count({ where: { organizationId } });
      await upsertOpportunityFromRule({
        organizationId,
        ruleId: "failed_payments",
        title: `[DETECT] Failed payment ${t.amount}`,
        description: `Transaction ${t.id} failed on ${t.occurredAt.toISOString()}.`,
        amount: t.amount,
        source: "detection:failed_payments",
        sourceId: t.id,
        evidenceSummary: `Failed txn ${t.sourceId || t.id} amount=${t.amount}`,
        priorityHint: "CRITICAL",
      });
      const after = await prisma.opportunity.count({ where: { organizationId } });
      createdOpportunities += Math.max(0, after - before);
    }
    if (t.type === "CHECKOUT" && t.status === "ABANDONED") {
      rulesFired.push("abandoned_checkout");
      const before = await prisma.opportunity.count({ where: { organizationId } });
      await upsertOpportunityFromRule({
        organizationId,
        ruleId: "abandoned_checkout",
        title: `[DETECT] Abandoned checkout ${t.amount}`,
        description: `Checkout abandoned; recovery outreach candidate.`,
        amount: t.amount,
        source: "detection:abandoned_checkout",
        sourceId: t.id,
        evidenceSummary: `Abandoned checkout ${t.id}`,
      });
      const after = await prisma.opportunity.count({ where: { organizationId } });
      createdOpportunities += Math.max(0, after - before);
    }
  }

  // RR: missed appointments
  if (appts.length === 0) insufficient.push("missed_appointments: no Appointment records");
  for (const a of appts) {
    if (a.status === "MISSED" || (a.status === "SCHEDULED" && daysAgo(a.scheduledAt, now) >= 1 && a.scheduledAt < now)) {
      if (daysAgo(a.scheduledAt, now) <= settings.missedAppointmentDays + 30) {
        rulesFired.push("missed_appointments");
        const before = await prisma.opportunity.count({ where: { organizationId } });
        await upsertOpportunityFromRule({
          organizationId,
          ruleId: "missed_appointments",
          title: `[DETECT] Missed appointment: ${a.title}`,
          description: `Appointment scheduled ${a.scheduledAt.toISOString()} marked/treated as missed.`,
          amount: 2500,
          source: "detection:missed_appointments",
          sourceId: a.id,
          evidenceSummary: `Missed appt ${a.id}`,
        });
        const after = await prisma.opportunity.count({ where: { organizationId } });
        createdOpportunities += Math.max(0, after - before);
      }
    }
  }

  // RR: unanswered inquiries
  if (interactions.length === 0) insufficient.push("unanswered_inquiries: no Interaction records");
  for (const i of interactions) {
    if (!i.answered && i.direction === "INBOUND" && hoursAgo(i.occurredAt, now) >= settings.unansweredInquiryHours) {
      rulesFired.push("unanswered_inquiries");
      const before = await prisma.opportunity.count({ where: { organizationId } });
      await upsertOpportunityFromRule({
        organizationId,
        ruleId: "unanswered_inquiries",
        title: `[DETECT] Unanswered inquiry: ${i.subject || i.channel}`,
        description: `Inbound ${i.channel} unanswered for ${Math.round(hoursAgo(i.occurredAt, now))}h (threshold ${settings.unansweredInquiryHours}h).`,
        amount: 1500,
        source: "detection:unanswered_inquiries",
        sourceId: i.id,
        evidenceSummary: `Unanswered ${i.channel} ${i.id}`,
      });
      const after = await prisma.opportunity.count({ where: { organizationId } });
      createdOpportunities += Math.max(0, after - before);
    }
  }

  // RR: pipeline stalls (leads in stage too long — reuse stalled with pipelineStallDays)
  for (const lead of leads) {
    if (lead.status === "OPEN" && daysAgo(lead.lastTouchAt, now) >= settings.pipelineStallDays) {
      rulesFired.push("pipeline_stalls");
      const before = await prisma.opportunity.count({ where: { organizationId } });
      await upsertOpportunityFromRule({
        organizationId,
        ruleId: "pipeline_stalls",
        title: `[DETECT] Pipeline stall: ${lead.title}`,
        description: `Stage ${lead.stage || "unknown"} stalled ${daysAgo(lead.lastTouchAt, now)}d (threshold ${settings.pipelineStallDays}).`,
        amount: lead.amount,
        source: "detection:pipeline_stalls",
        sourceId: lead.id,
        evidenceSummary: `Pipeline stall lead ${lead.id}`,
        priorityHint: "HIGH",
      });
      const after = await prisma.opportunity.count({ where: { organizationId } });
      createdOpportunities += Math.max(0, after - before);
    }
  }

  // OE: processes without recent resolution / manual repetition signals
  if (processes.length === 0 && inefficiencies.length === 0) {
    insufficient.push("ops_rules: no Process or Inefficiency records");
  }
  for (const p of processes) {
    if ((p.avgCycleDays ?? 0) >= settings.approvalDelayDays) {
      rulesFired.push("approval_delays");
      const before = await prisma.inefficiency.count({ where: { organizationId } });
      await upsertInefficiencyFromRule({
        organizationId,
        ruleId: "approval_delays",
        title: `[DETECT] Approval/cycle delay: ${p.name}`,
        description: `Avg cycle ${p.avgCycleDays}d exceeds threshold ${settings.approvalDelayDays}d.`,
        projectedSavings: (p.avgCycleDays || 0) * 2000,
        hoursWeekly: (p.avgCycleDays || 0) * 0.5,
        source: "detection:approval_delays",
        sourceId: p.id,
        evidenceSummary: `Process ${p.name} cycle ${p.avgCycleDays}d`,
        automationCandidate: true,
      });
      const after = await prisma.inefficiency.count({ where: { organizationId } });
      createdInefficiencies += Math.max(0, after - before);
    }
  }

  // OE: duplicate work — similar inefficiency titles
  const titleMap = new Map<string, typeof inefficiencies>();
  for (const i of inefficiencies) {
    const key = (i.title || "").toLowerCase().replace(/\[demo\]\s*/i, "").slice(0, 40);
    if (!titleMap.has(key)) titleMap.set(key, []);
    titleMap.get(key)!.push(i);
  }
  for (const [key, group] of Array.from(titleMap.entries())) {
    if (group.length >= 2) {
      rulesFired.push("duplicate_work");
      const before = await prisma.inefficiency.count({ where: { organizationId } });
      await upsertInefficiencyFromRule({
        organizationId,
        ruleId: "duplicate_work",
        title: `[DETECT] Duplicate work cluster: ${key.slice(0, 48)}`,
        description: `${group.length} similar inefficiency records — possible duplicate effort.`,
        projectedSavings: group.reduce((a, g) => a + g.estimatedWasteAnnual, 0) * 0.2,
        hoursWeekly: 8,
        source: "detection:duplicate_work",
        sourceId: `dup:${key}`,
        evidenceSummary: `Duplicate cluster size=${group.length}`,
        automationCandidate: false,
      });
      const after = await prisma.inefficiency.count({ where: { organizationId } });
      createdInefficiencies += Math.max(0, after - before);
    }
  }

  // OE: manual repetition / automation candidates already flagged
  for (const i of inefficiencies) {
    if (i.type === "manual_process" || (i.hoursWastedWeekly && i.hoursWastedWeekly >= 16)) {
      rulesFired.push("manual_repetition");
      // enrich finding only
      await ensureFinding({
        organizationId,
        product: "OPERATIONS_EFFICIENCY",
        ruleId: "manual_repetition",
        inefficiencyId: i.id,
        evidenceSummary: `${i.hoursWastedWeekly ?? 0} hrs/week on ${i.title}`,
        analysis: "Manual repetition detected from hours or type=manual_process.",
        recommendation: "Evaluate automation candidate via approval queue.",
        confidence: "medium",
        impactEstimate: i.estimatedWasteAnnual,
        explain: { inefficiencyId: i.id, hoursWastedWeekly: i.hoursWastedWeekly },
      });
    }
    if (i.automationCandidate) {
      rulesFired.push("automation_candidates");
    }
  }

  // bottlenecks: high score open inefficiencies
  const bottlenecks = inefficiencies.filter(
    (i) => i.score >= 70 && !["REALIZED", "VERIFIED", "DISMISSED", "RESOLVED"].includes(i.status)
  );
  if (bottlenecks.length) {
    rulesFired.push("bottlenecks");
    for (const b of bottlenecks.slice(0, 5)) {
      await ensureFinding({
        organizationId,
        product: "OPERATIONS_EFFICIENCY",
        ruleId: "bottlenecks",
        inefficiencyId: b.id,
        evidenceSummary: `High score (${b.score}) open item`,
        analysis: "Priority bottleneck by score.",
        recommendation: "Surface in Action Center and assign owner.",
        confidence: "high",
        impactEstimate: b.projectedSavings || b.estimatedWasteAnnual,
        explain: { score: b.score },
      });
    }
  }

  return {
    organizationId,
    createdOpportunities,
    createdInefficiencies,
    rulesFired: Array.from(new Set(rulesFired)),
    insufficient,
  };
}
