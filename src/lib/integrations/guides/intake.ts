import type { IntakeField, IntakeKind } from "./types";

const t = (id: string, label: string, help?: string, placeholder?: string): IntakeField => ({ id, label, type: "text", help, placeholder });
const n = (id: string, label: string, help?: string): IntakeField => ({ id, label, type: "number", help });
const a = (id: string, label: string, help?: string, placeholder?: string): IntakeField => ({ id, label, type: "textarea", help, placeholder });
const s = (id: string, label: string, options: string[], help?: string): IntakeField => ({ id, label, type: "select", options, help });

const contact = t("adminContact", "Main admin contact", "Name and email of the person who can grant access in this system.", "Jordan Lee, jordan@yourco.com");
const tz = t("timezone", "Report time zone", undefined, "America/New_York");

/** Business-specific information Kaivaryn needs per kind of system. Never secrets. */
export const INTAKE_FIELDS: Record<IntakeKind, IntakeField[]> = {
  pos: [
    n("locationCount", "Number of locations"),
    a("locationNames", "Location names", "One per line, as they appear in your POS.", "Main St\nHarbor View"),
    t("accountIds", "POS account / restaurant IDs", "Location or restaurant IDs shown in your POS back office (not passwords).", "e.g. restaurant GUID or merchant ID"),
    contact,
    tz,
    t("businessDayCutoff", "Business-day cutoff", "When your POS rolls over to the next business day.", "4:00 AM"),
  ],
  delivery: [
    a("storeNames", "Store names on the platform", "One per line, as listed on the delivery app."),
    t("storeIds", "Store / merchant IDs", "Shown in the merchant portal (not passwords)."),
    t("payoutCadence", "Payout cadence", undefined, "Weekly"),
    contact,
  ],
  reservations: [
    a("venueNames", "Venue names", "One per line."),
    t("venueIds", "Venue / restaurant IDs", "Shown in the reservation system's admin (not passwords)."),
    t("noShowPolicy", "No-show / deposit policy", undefined, "Card hold for parties of 6+"),
    contact,
  ],
  labor: [
    a("locationNames", "Locations / departments", "One per line."),
    t("payPeriod", "Pay period", undefined, "Biweekly, starting Monday"),
    t("overtimeRule", "Overtime rule", undefined, "Over 40 hours/week"),
    t("laborTarget", "Labor-cost target", undefined, "28% of sales"),
    contact,
  ],
  inventory: [
    a("locationNames", "Locations", "One per line."),
    t("countCadence", "Inventory count cadence", undefined, "Weekly, Sunday close"),
    t("foodCostTarget", "Food-cost target", undefined, "30%"),
    a("mainVendors", "Main suppliers", "One per line.", "Sysco\nLocal produce co."),
    contact,
  ],
  crm: [
    a("pipelines", "Pipeline names", "One per line.", "New business\nRenewals"),
    a("dealStages", "Deal stages", "In order, one per line."),
    a("ownerStructure", "Owner / team structure", "Who owns deals, and how teams roll up.", "3 AEs report to the VP Sales"),
    t("fiscalQuarterStart", "Fiscal quarter start", undefined, "January"),
    contact,
  ],
  accounting: [
    t("fiscalYearStart", "Fiscal year start", undefined, "January 1"),
    s("coaApproach", "Chart-of-accounts approach", ["Standard / default", "Customized by our accountant", "By location or class", "Not sure"]),
    t("arTerms", "AR terms", undefined, "Net 30"),
    a("entities", "Entities / companies", "One per line if you have more than one."),
    contact,
  ],
  payments: [
    t("accountName", "Account name(s)", "As shown in the dashboard (not keys)."),
    t("currency", "Main currency", undefined, "USD"),
    t("refundPolicy", "Refund / dispute policy", undefined, "Refunds within 30 days"),
    contact,
  ],
  erp: [
    a("subsidiaries", "Subsidiaries / entities", "One per line."),
    t("fiscalYearStart", "Fiscal year start", undefined, "January 1"),
    t("arTerms", "AR terms", undefined, "Net 30"),
    a("modules", "Modules in use", "e.g. AR, AP, Orders, Inventory, Procurement."),
    contact,
  ],
  support: [
    a("queues", "Queues / groups", "One per line."),
    a("slaTargets", "SLA targets", undefined, "First response 4h, resolution 2 business days"),
    t("businessHours", "Business hours", undefined, "Mon–Fri 8–6 ET"),
    contact,
  ],
  commerce: [
    a("storeNames", "Stores / storefronts", "One per line."),
    t("currency", "Main currency", undefined, "USD"),
    t("returnPolicy", "Return policy", undefined, "30 days"),
    contact,
  ],
  subscriptions: [
    a("plans", "Plans / price points", "One per line."),
    t("dunningPolicy", "Failed-payment (dunning) policy", undefined, "3 retries over 14 days"),
    t("currency", "Main currency", undefined, "USD"),
    contact,
  ],
  work: [
    a("workspaces", "Projects / boards / workspaces in scope", "One per line."),
    a("statuses", "Status flow", "In order, one per line.", "Backlog\nIn progress\nDone"),
    a("teams", "Teams involved"),
    contact,
  ],
  data: [
    a("schemas", "Databases / schemas / views in scope", "One per line."),
    t("refreshCadence", "Refresh cadence", undefined, "Nightly"),
    t("itContact", "IT / data owner", "Who creates the read-only user.", "Sam Patel, sam@yourco.com"),
    a("dataNotes", "Anything restricted", "Tables or fields Kaivaryn must not read."),
  ],
  collab: [
    a("spaces", "Channels / sites / shared drives in scope", "One per line."),
    t("tenantDomain", "Company domain", undefined, "yourco.com"),
    contact,
  ],
  hr: [
    a("departments", "Departments", "One per line."),
    n("headcount", "Approximate headcount"),
    t("payPeriod", "Pay period", undefined, "Biweekly"),
    contact,
  ],
  payroll: [
    a("payGroups", "Pay groups / locations", "One per line."),
    t("payPeriod", "Pay period", undefined, "Biweekly"),
    t("overtimeRule", "Overtime rule", undefined, "Over 40 hours/week"),
    contact,
  ],
  flexible: [
    a("sourceSystem", "What system does this data come from?"),
    t("cadence", "How often can you send it?", undefined, "Weekly"),
    contact,
  ],
};

const MAX = 600;
const SECRET_ID = /pass|secret|token|apikey|api_key|credential|pin/i;
const SECRET_VALUE = /(sk|rk|pk)_(live|test)_[A-Za-z0-9]{8,}|xox[abp]-|AKIA[0-9A-Z]{12,}|-----BEGIN|\bpassword\s*[:=]/i;

/** True if a value looks like a password/key — such values are rejected, never stored. */
export const looksLikeSecret = (v: string) => SECRET_VALUE.test(v);

/** Keep only known fields, trim and cap values, and drop anything that looks like a secret. */
export function sanitizeIntake(fields: IntakeField[], raw: Record<string, unknown>): { values: Record<string, string>; rejected: string[] } {
  const values: Record<string, string> = {};
  const rejected: string[] = [];
  for (const f of fields) {
    if (SECRET_ID.test(f.id)) continue;
    const v = raw[f.id];
    if (typeof v !== "string") continue;
    const clean = v.trim().slice(0, MAX);
    if (!clean) continue;
    if (looksLikeSecret(clean)) { rejected.push(f.id); continue; }
    if (f.type === "select" && f.options && !f.options.includes(clean)) continue;
    if (f.type === "number" && !/^\d{1,6}$/.test(clean)) continue;
    values[f.id] = clean;
  }
  return { values, rejected };
}
