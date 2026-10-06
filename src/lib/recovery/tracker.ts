/**
 * Money recovered — proof-of-value tracker.
 *
 * Read-only view over a single tenant's own rows:
 *   - Opportunity  (Revenue Recovery)   found = potentialAmount, won back = recoveredAmount (verified = verifiedAmount)
 *   - Inefficiency (Operations Efficiency) found = projectedSavings (annual), won back = realizedSavings (annual)
 *
 * Rules (same as src/lib/money-glossary.ts and src/lib/financial-impact.ts):
 *   - "Found" is always an ESTIMATE. It is never counted as won back.
 *   - "Won back" only counts amounts a person recorded (recordRecovery / recordSavings / an approved
 *     HIGH_VALUE_* request). Intelligence and imports never write these fields.
 *   - Revenue cash (one-time) and operations savings (annual run-rate) are different units, so they are
 *     reported side by side and NEVER summed into one headline.
 *   - Nothing is padded or invented: no rows → empty state, every figure is a sum of listed items.
 *
 * This module does not write anything. Confirming a dollar goes through the existing, role-gated
 * server actions (record_financial = Manager+, amount limits + approval queue from OrgSettings).
 */
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { cashRecoveryRate } from "@/lib/money-glossary";
import { classifyLeakageType } from "@/lib/leakage-taxonomy";
import { clientTitle, humanizeLabel } from "@/lib/labels";

export type RecoveryCategory = "REVENUE_RECOVERY" | "OPERATIONS_EFFICIENCY";

/**
 * WON_BACK          a person recorded a dollar amount (> 0)
 * IN_PROGRESS       approved / being worked; still an estimate
 * OPEN              found, not started yet
 * CLOSED_NO_AMOUNT  marked done but nobody recorded a dollar amount — counted as $0 won back
 * DISMISSED         ruled out
 */
export type RecoveryStage = "WON_BACK" | "IN_PROGRESS" | "OPEN" | "CLOSED_NO_AMOUNT" | "DISMISSED";

export const STAGE_LABEL: Record<RecoveryStage, string> = {
  WON_BACK: "Won back",
  IN_PROGRESS: "Being worked on",
  OPEN: "Found, not started",
  CLOSED_NO_AMOUNT: "Closed, no amount recorded",
  DISMISSED: "Ruled out",
};

export const CATEGORY_LABEL: Record<RecoveryCategory, string> = {
  REVENUE_RECOVERY: "Revenue Recovery",
  OPERATIONS_EFFICIENCY: "Operations Efficiency",
};

const RR_IN_PROGRESS = new Set(["APPROVED", "IN_RECOVERY", "IN_PROGRESS", "PARTIALLY_RECOVERED"]);
const RR_CLOSED = new Set(["RECOVERED", "VERIFIED"]);
const OE_IN_PROGRESS = new Set(["APPROVED", "IMPLEMENTING", "IN_PROGRESS"]);
const OE_CLOSED = new Set(["REALIZED", "VERIFIED", "RESOLVED"]);
/** Status changes that represent a person recording a won-back amount. */
export const REALIZED_STATUSES = ["RECOVERED", "PARTIALLY_RECOVERED", "VERIFIED", "REALIZED", "RESOLVED"];

/** Normalised input row (one per Opportunity / Inefficiency). Pure — easy to test. */
export type RecoverySourceRow = {
  id: string;
  category: RecoveryCategory;
  title: string;
  status: string;
  /** Estimate. Opportunity.potentialAmount / Inefficiency.projectedSavings. */
  foundAmount: number;
  /** Recorded by a person. Opportunity.recoveredAmount / Inefficiency.realizedSavings. */
  realizedAmount: number;
  /** Subset of realizedAmount that was marked verified against evidence. */
  verifiedAmount: number;
  type: string | null;
  source: string | null;
  department: string | null;
  foundAt: Date;
  realizedAt: Date | null;
};

export type RecoveryConfirmation = {
  at: Date;
  byName: string | null;
  byRole: string | null;
  note: string | null;
  toStatus: string;
  /**
   * RECORDED: someone moved the item to a won-back status (record form or an approved request).
   * ENTERED_AT_CREATION: the item was created already marked as won back (no prior status) — shown as such.
   */
  kind: "RECORDED" | "ENTERED_AT_CREATION";
};

export type RecoveryLedgerItem = RecoverySourceRow & {
  stage: RecoveryStage;
  stageLabel: string;
  /** Status is still approved / in recovery / implementing (may already have a partial amount won back). */
  stillInProgress: boolean;
  typeLabel: string;
  sourceLabel: string;
  href: string;
  isVerified: boolean;
  /** Annual run-rate (operations savings) vs one-time cash (revenue). */
  unit: "cash" | "per_year";
  confirmation: RecoveryConfirmation | null;
  findingIds: string[];
  evidenceCount: number;
  initiatives: string[];
};

export type Breakdown = { key: string; label: string; count: number; found: number; wonBack: number };

export type CategoryTotals = {
  category: RecoveryCategory;
  label: string;
  unit: "cash" | "per_year";
  itemCount: number;
  /** Estimate — sum of foundAmount over every item (same as the /app dashboard). */
  found: number;
  /** Recorded — sum of realizedAmount over every item (same as the /app dashboard). */
  wonBack: number;
  verified: number;
  /** Estimate: not-yet-won remainder of items still being worked on. */
  inProgress: number;
  inProgressCount: number;
  openFound: number;
  openCount: number;
  dismissedFound: number;
  wonBackCount: number;
  closedNoAmountCount: number;
  /** wonBack ÷ found, percent with one decimal (money-glossary cashRecoveryRate). */
  conversionRate: number;
  byType: Breakdown[];
  bySource: Breakdown[];
};

export type TimelinePoint = { key: string; label: string; cashRecovered: number; realizedSavings: number };

export type RecoveryTracker = {
  organizationId: string;
  generatedAt: Date;
  hasData: boolean;
  hasWonBack: boolean;
  revenue: CategoryTotals;
  operations: CategoryTotals;
  /** Realized dollars by month of the recorded date (separate series, never summed). */
  timeline: TimelinePoint[];
  /** Won-back amounts with no recorded date — kept visible so the timeline always reconciles. */
  undated: { cashRecovered: number; realizedSavings: number; count: number };
  items: RecoveryLedgerItem[];
};

const n = (v: number | null | undefined) => (Number.isFinite(v) ? Math.max(0, Number(v)) : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export function classifyStage(category: RecoveryCategory, status: string, realizedAmount: number): RecoveryStage {
  const s = (status || "").toUpperCase();
  if (realizedAmount > 0) return "WON_BACK";
  if (s === "DISMISSED") return "DISMISSED";
  if (category === "REVENUE_RECOVERY") {
    if (RR_IN_PROGRESS.has(s)) return "IN_PROGRESS";
    if (RR_CLOSED.has(s)) return "CLOSED_NO_AMOUNT";
  } else {
    if (OE_IN_PROGRESS.has(s)) return "IN_PROGRESS";
    if (OE_CLOSED.has(s)) return "CLOSED_NO_AMOUNT";
  }
  return "OPEN";
}

/** Only Manager, Admin and Owner (and platform executives) may record a won-back dollar. Viewers/Analysts never. */
export function canConfirmRealized(role: string | null | undefined): boolean {
  return can(role, "record_financial");
}

function typeLabelFor(row: RecoverySourceRow): string {
  if (row.category === "REVENUE_RECOVERY") return classifyLeakageType(row.type).label;
  return row.type ? humanizeLabel(row.type) : "Other";
}

const SOURCE_LABELS: Record<string, string> = {
  crm: "CRM",
  ar_aging: "AR aging report",
  billing_export: "Billing export",
  payer_remittance: "Payer remittance",
  claims: "Claims",
  contracts: "Contracts",
  project_mgmt: "Project management",
  time_study: "Time study",
  process_map: "Process map",
  interview: "Interview",
  ticket_system: "Ticket system",
  observation: "Observation",
  csv_upload: "CSV upload",
  google_sheets: "Google Sheets",
  webhook: "Connected system",
  manual: "Added manually",
};

export function sourceLabelFor(source: string | null): string {
  if (!source || !source.trim()) return "Added manually";
  const key = source.trim().toLowerCase();
  if (key.startsWith("detection:") || key === "detection" || key.startsWith("si:")) return "Kaivaryn analysis of your data";
  if (SOURCE_LABELS[key]) return SOURCE_LABELS[key];
  const words = key.replace(/[_:.-]+/g, " ").replace(/\s+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Added manually";
}

export function isInProgressStatus(category: RecoveryCategory, status: string): boolean {
  const s = (status || "").toUpperCase();
  return category === "REVENUE_RECOVERY" ? RR_IN_PROGRESS.has(s) : OE_IN_PROGRESS.has(s);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

function breakdown(items: RecoveryLedgerItem[], keyOf: (i: RecoveryLedgerItem) => string): Breakdown[] {
  const map = new Map<string, Breakdown>();
  for (const i of items) {
    const label = keyOf(i);
    const b = map.get(label) ?? { key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"), label, count: 0, found: 0, wonBack: 0 };
    b.count += 1;
    b.found = r2(b.found + i.foundAmount);
    b.wonBack = r2(b.wonBack + i.realizedAmount);
    map.set(label, b);
  }
  return Array.from(map.values()).sort((a, b) => b.wonBack - a.wonBack || b.found - a.found);
}

function totalsFor(category: RecoveryCategory, items: RecoveryLedgerItem[]): CategoryTotals {
  const mine = items.filter((i) => i.category === category);
  const sum = (list: RecoveryLedgerItem[], f: (i: RecoveryLedgerItem) => number) => r2(list.reduce((s, i) => s + f(i), 0));
  // Still being worked: includes partly-won items; only the not-yet-won remainder of the estimate counts.
  const inProg = mine.filter((i) => i.stillInProgress);
  const open = mine.filter((i) => i.stage === "OPEN");
  const found = sum(mine, (i) => i.foundAmount);
  const wonBack = sum(mine, (i) => i.realizedAmount);
  return {
    category,
    label: CATEGORY_LABEL[category],
    unit: category === "REVENUE_RECOVERY" ? "cash" : "per_year",
    itemCount: mine.length,
    found,
    wonBack,
    verified: sum(mine, (i) => i.verifiedAmount),
    inProgress: sum(inProg, (i) => Math.max(0, i.foundAmount - i.realizedAmount)),
    inProgressCount: inProg.length,
    openFound: sum(open, (i) => i.foundAmount),
    openCount: open.length,
    dismissedFound: sum(mine.filter((i) => i.stage === "DISMISSED"), (i) => i.foundAmount),
    wonBackCount: mine.filter((i) => i.stage === "WON_BACK").length,
    closedNoAmountCount: mine.filter((i) => i.stage === "CLOSED_NO_AMOUNT").length,
    conversionRate: cashRecoveryRate(wonBack, found),
    byType: breakdown(mine, (i) => i.typeLabel),
    bySource: breakdown(mine, (i) => i.sourceLabel),
  };
}

/**
 * Pure aggregation. Every total is the sum of the returned `items`, so the page,
 * the CSV and the dashboard card always reconcile.
 */
export function buildRecoveryTracker(
  organizationId: string,
  rows: RecoverySourceRow[],
  extras: {
    confirmations?: Map<string, RecoveryConfirmation>;
    findings?: Map<string, string[]>;
    evidence?: Map<string, number>;
    initiatives?: Map<string, string[]>;
    now?: Date;
    months?: number;
  } = {}
): RecoveryTracker {
  const now = extras.now ?? new Date();
  const items: RecoveryLedgerItem[] = rows.map((row) => {
    const foundAmount = n(row.foundAmount);
    const realizedAmount = n(row.realizedAmount);
    // Verified can never exceed what was recorded (financial-impact.ts rule).
    const verifiedAmount = Math.min(n(row.verifiedAmount), realizedAmount);
    const clean = { ...row, foundAmount, realizedAmount, verifiedAmount, realizedAt: realizedAmount > 0 ? row.realizedAt : null };
    const stage = classifyStage(row.category, row.status, realizedAmount);
    const stillInProgress = isInProgressStatus(row.category, row.status);
    return {
      ...clean,
      title: clientTitle(row.title),
      stage,
      stageLabel: stage === "WON_BACK" && stillInProgress ? "Partly won back, still being worked" : STAGE_LABEL[stage],
      stillInProgress,
      typeLabel: typeLabelFor(row),
      sourceLabel: sourceLabelFor(row.source),
      href: row.category === "REVENUE_RECOVERY" ? `/app/revenue/${row.id}` : `/app/operations/${row.id}`,
      isVerified: verifiedAmount > 0,
      unit: row.category === "REVENUE_RECOVERY" ? "cash" : "per_year",
      confirmation: stage === "WON_BACK" ? extras.confirmations?.get(row.id) ?? null : null,
      findingIds: extras.findings?.get(row.id) ?? [],
      evidenceCount: extras.evidence?.get(row.id) ?? 0,
      initiatives: extras.initiatives?.get(row.id) ?? [],
    };
  });

  // Ledger order: won back (newest first), then in progress, open, closed-no-amount, dismissed.
  const order: RecoveryStage[] = ["WON_BACK", "IN_PROGRESS", "OPEN", "CLOSED_NO_AMOUNT", "DISMISSED"];
  items.sort((a, b) => {
    const s = order.indexOf(a.stage) - order.indexOf(b.stage);
    if (s) return s;
    if (a.stage === "WON_BACK") return (b.realizedAt?.getTime() ?? 0) - (a.realizedAt?.getTime() ?? 0) || b.realizedAmount - a.realizedAmount;
    return b.foundAmount - a.foundAmount;
  });

  // Timeline: last N months ending this month, extended back to the oldest dated won-back item.
  const won = items.filter((i) => i.stage === "WON_BACK");
  const dated = won.filter((i) => i.realizedAt);
  const months = Math.max(1, extras.months ?? 6);
  const keys: string[] = [];
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  const oldest = dated.reduce<Date | null>((m, i) => (!m || i.realizedAt! < m ? i.realizedAt! : m), null);
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const from = oldest && oldest < start ? new Date(oldest.getFullYear(), oldest.getMonth(), 1) : start;
  for (let d = new Date(from); d <= cursor; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) keys.push(monthKey(d));
  const timelineMap = new Map<string, TimelinePoint>(keys.map((k) => [k, { key: k, label: monthLabel(k), cashRecovered: 0, realizedSavings: 0 }]));
  const undated = { cashRecovered: 0, realizedSavings: 0, count: 0 };
  for (const i of won) {
    const point = i.realizedAt ? timelineMap.get(monthKey(i.realizedAt)) : undefined;
    if (!point) {
      // Undated, or dated in the future (clock skew) — keep visible, never drop.
      undated.count += 1;
      if (i.category === "REVENUE_RECOVERY") undated.cashRecovered = r2(undated.cashRecovered + i.realizedAmount);
      else undated.realizedSavings = r2(undated.realizedSavings + i.realizedAmount);
      continue;
    }
    if (i.category === "REVENUE_RECOVERY") point.cashRecovered = r2(point.cashRecovered + i.realizedAmount);
    else point.realizedSavings = r2(point.realizedSavings + i.realizedAmount);
  }

  const revenue = totalsFor("REVENUE_RECOVERY", items);
  const operations = totalsFor("OPERATIONS_EFFICIENCY", items);
  return {
    organizationId,
    generatedAt: now,
    hasData: items.length > 0,
    hasWonBack: revenue.wonBack > 0 || operations.wonBack > 0,
    revenue,
    operations,
    timeline: Array.from(timelineMap.values()),
    undated,
    items,
  };
}

/** Loads one tenant's rows (every query is scoped by organizationId) and builds the tracker. */
export async function getRecoveryTracker(organizationId: string, opts: { now?: Date; months?: number } = {}): Promise<RecoveryTracker> {
  if (!organizationId) throw new Error("Organization context required");
  const [opps, ineffs] = await Promise.all([
    prisma.opportunity.findMany({
      where: { organizationId },
      select: {
        id: true, title: true, status: true, potentialAmount: true, recoveredAmount: true, verifiedAmount: true,
        type: true, source: true, department: true, identifiedAt: true, recoveredAt: true, verifiedAt: true,
      },
    }),
    prisma.inefficiency.findMany({
      where: { organizationId },
      select: {
        id: true, title: true, status: true, projectedSavings: true, realizedSavings: true,
        type: true, source: true, department: true, identifiedAt: true, resolvedAt: true, verifiedAt: true,
      },
    }),
  ]);

  const rows: RecoverySourceRow[] = [
    ...opps.map((o) => ({
      id: o.id,
      category: "REVENUE_RECOVERY" as const,
      title: o.title,
      status: o.status,
      foundAmount: o.potentialAmount,
      realizedAmount: o.recoveredAmount,
      verifiedAmount: o.verifiedAmount,
      type: o.type,
      source: o.source,
      department: o.department,
      foundAt: o.identifiedAt,
      realizedAt: o.recoveredAt ?? o.verifiedAt ?? null,
    })),
    ...ineffs.map((i) => ({
      id: i.id,
      category: "OPERATIONS_EFFICIENCY" as const,
      title: i.title,
      status: i.status,
      foundAmount: i.projectedSavings,
      realizedAmount: i.realizedSavings,
      // OE has no separate verified amount; the whole realized figure is verified only when status is VERIFIED.
      verifiedAmount: i.status === "VERIFIED" ? i.realizedSavings : 0,
      type: i.type,
      source: i.source,
      department: i.department,
      foundAt: i.identifiedAt,
      realizedAt: i.resolvedAt ?? i.verifiedAt ?? null,
    })),
  ];

  const oppIds = opps.map((o) => o.id);
  const ineffIds = ineffs.map((i) => i.id);
  const wonIds = rows.filter((r) => r.realizedAmount > 0).map((r) => r.id);
  const allIds = [...oppIds, ...ineffIds];

  const [history, findings, evidence, links, members] = allIds.length
    ? await Promise.all([
        wonIds.length
          ? prisma.statusHistory.findMany({
              where: {
                organizationId,
                entityType: { in: ["Opportunity", "Inefficiency"] },
                entityId: { in: wonIds },
                toStatus: { in: REALIZED_STATUSES },
              },
              orderBy: { createdAt: "desc" },
              select: { entityId: true, fromStatus: true, toStatus: true, note: true, createdAt: true, actorId: true, actor: { select: { name: true, email: true } } },
            })
          : Promise.resolve([]),
        prisma.finding.findMany({
          where: { organizationId, OR: [{ opportunityId: { in: oppIds } }, { inefficiencyId: { in: ineffIds } }] },
          select: { id: true, opportunityId: true, inefficiencyId: true },
        }),
        prisma.evidence.groupBy({
          by: ["opportunityId", "inefficiencyId"],
          where: { organizationId, OR: [{ opportunityId: { in: oppIds } }, { inefficiencyId: { in: ineffIds } }] },
          _count: { _all: true },
        }),
        prisma.opInitiativeLink.findMany({
          where: { organizationId, entityType: { in: ["OPPORTUNITY", "INEFFICIENCY"] }, entityId: { in: allIds } },
          select: { entityId: true, initiative: { select: { name: true } } },
        }),
        prisma.membership.findMany({ where: { organizationId }, select: { userId: true, role: true } }),
      ])
    : [[], [], [], [], []];

  const roleOf = new Map(members.map((m) => [m.userId, m.role]));
  const confirmations = new Map<string, RecoveryConfirmation>();
  for (const h of history) {
    if (confirmations.has(h.entityId)) continue; // newest first
    confirmations.set(h.entityId, {
      at: h.createdAt,
      byName: h.actor ? h.actor.name || h.actor.email : null,
      byRole: h.actorId ? roleOf.get(h.actorId) ?? null : null,
      note: h.note,
      toStatus: h.toStatus,
      kind: h.fromStatus ? "RECORDED" : "ENTERED_AT_CREATION",
    });
  }
  const findingMap = new Map<string, string[]>();
  for (const f of findings) {
    const key = f.opportunityId ?? f.inefficiencyId;
    if (!key) continue;
    findingMap.set(key, [...(findingMap.get(key) ?? []), f.id]);
  }
  const evidenceMap = new Map<string, number>();
  for (const e of evidence) {
    const key = e.opportunityId ?? e.inefficiencyId;
    if (!key) continue;
    evidenceMap.set(key, (evidenceMap.get(key) ?? 0) + e._count._all);
  }
  const initiativeMap = new Map<string, string[]>();
  for (const l of links) initiativeMap.set(l.entityId, [...(initiativeMap.get(l.entityId) ?? []), l.initiative.name]);

  return buildRecoveryTracker(organizationId, rows, {
    confirmations,
    findings: findingMap,
    evidence: evidenceMap,
    initiatives: initiativeMap,
    now: opts.now,
    months: opts.months,
  });
}

/** CSV of the ledger. Every row says whether its number is an estimate or a recorded amount. */
export function recoveryLedgerToCsv(t: RecoveryTracker): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
  const header = [
    "category", "item_id", "title", "stage", "status", "type", "source",
    "found_estimated_usd", "won_back_recorded_usd", "verified_usd", "unit",
    "found_on", "won_back_on", "recorded_by", "recorded_by_role", "recorded_how", "record_note", "finding_ids", "evidence_items", "initiatives",
  ];
  const lines = [header.join(",")];
  for (const i of t.items) {
    lines.push([
      CATEGORY_LABEL[i.category], i.id, i.title, i.stageLabel, i.status, i.typeLabel, i.sourceLabel,
      r2(i.foundAmount), r2(i.realizedAmount), r2(i.verifiedAmount), i.unit === "cash" ? "one-time cash" : "per year",
      iso(i.foundAt), iso(i.realizedAt), i.confirmation?.byName ?? "", i.confirmation?.byRole ?? "",
      i.confirmation ? (i.confirmation.kind === "RECORDED" ? "recorded on item" : "entered when item was added") : i.stage === "WON_BACK" ? "no record" : "",
      i.confirmation?.note ?? "",
      i.findingIds.join(" "), i.evidenceCount, i.initiatives.join("; "),
    ].map(esc).join(","));
  }
  return lines.join("\n") + "\n";
}

/** Whole-dollar USD, same formatting as formatCurrency in src/lib/utils.ts (kept local so this file stays server/test friendly). */
export function usd(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

/**
 * Plain-English summary for business owners. Estimates and recorded amounts stay in separate
 * sentences, and the empty state contains no figures at all.
 */
export function describeRecovery(t: RecoveryTracker): { headline: string; detail: string; empty: boolean } {
  if (!t.hasData) {
    return {
      empty: true,
      headline: "Nothing to show yet — and we won't show a number we can't back up.",
      detail:
        "This page fills in from your own records. Once you import a file or connect a system, every issue Kaivaryn finds appears here with an estimated value. " +
        "When your team actually collects the money or locks in a saving, a manager, admin or owner records the real amount on that item. Only those recorded amounts count as won back.",
    };
  }
  const found: string[] = [];
  if (t.revenue.itemCount) found.push(`${usd(t.revenue.found)} in revenue to recover`);
  if (t.operations.itemCount) found.push(`${usd(t.operations.found)} a year in possible savings`);
  const won: string[] = [];
  if (t.revenue.wonBack > 0) won.push(`${usd(t.revenue.wonBack)} in recovered cash`);
  if (t.operations.wonBack > 0) won.push(`${usd(t.operations.wonBack)} a year in realized savings`);
  const headline = `Kaivaryn has found ${found.join(" and ")} (estimates).`;
  const detail = won.length
    ? `Your team has recorded ${won.join(" and ")} as actually won back, across ${t.revenue.wonBackCount + t.operations.wonBackCount} item${t.revenue.wonBackCount + t.operations.wonBackCount === 1 ? "" : "s"}. Every recorded amount is listed below with who recorded it and when.`
    : "Nothing has been recorded as won back yet. When money is collected or a saving is locked in, a manager, admin or owner records the actual amount on that item and it appears here.";
  return { empty: false, headline, detail };
}
