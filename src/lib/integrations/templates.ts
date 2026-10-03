/**
 * Import templates — column mappings + deterministic transforms for common exports.
 * Pure (no DB): used by the guided import UI (client-side preview), the server import,
 * Google Sheets sync, and the inbound API. Money produced here is always an ESTIMATE
 * (potential / projected); recovered and realized amounts are never set by an import.
 */

export type ImportKind = "opportunities" | "inefficiencies" | "customers" | "processes";
export type FieldType = "text" | "money" | "number" | "date" | "bool";

export type TemplateField = { key: string; label: string; required?: boolean; type: FieldType; synonyms: string[]; help?: string };

export type CanonicalRecord = Record<string, string>;

export type TransformResult = { record: CanonicalRecord } | { skip: string } | { error: string };

export type ImportTemplate = {
  slug: string;
  name: string;
  group: "Revenue Recovery" | "Operations Efficiency" | "Kaivaryn standard";
  kind: ImportKind;
  summary: string;
  creates: string;
  fields: TemplateField[];
  sample: string;
  transform: (v: Record<string, string>, rowNumber: number) => TransformResult;
  aggregate?: (rows: Array<Record<string, string>>) => Array<Record<string, string>>;
};

// ———————————————————————— value helpers ————————————————————————

/** "$1,234.50" · "(1,234.50)" · "1.234,50"(no) → number | null */
export function parseMoney(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  let t = String(raw).trim();
  if (!t) return null;
  const neg = /^\(.*\)$/.test(t) || /^-/.test(t);
  t = t.replace(/[()$€£\s,]/g, "").replace(/^-/, "").replace(/usd$/i, "");
  if (!/^\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

export function parseNum(raw: string | undefined | null): number | null {
  return parseMoney(raw);
}

export function parseBool(raw: string | undefined | null): boolean {
  return ["1", "true", "yes", "y", "x", "manual"].includes(String(raw ?? "").trim().toLowerCase());
}

const money2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function normHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Auto-map template fields to file headers by synonyms (exact normalized match first, then contains). */
export function autoMap(template: ImportTemplate, headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  const normed = headers.map((h) => ({ h, n: normHeader(h) }));
  for (const f of template.fields) {
    const cands = [f.key, f.label, ...f.synonyms].map(normHeader);
    const exact = normed.find((x) => !used.has(x.h) && cands.includes(x.n));
    if (exact) {
      map[f.key] = exact.h;
      used.add(exact.h);
    }
  }
  for (const f of template.fields) {
    if (map[f.key]) continue;
    const cands = [f.key, ...f.synonyms].map(normHeader).filter((c) => c.length >= 4);
    const loose = normed.find((x) => !used.has(x.h) && cands.some((c) => x.n.includes(c)));
    if (loose) {
      map[f.key] = loose.h;
      used.add(loose.h);
    }
  }
  return map;
}

/** Delimited text → rows. Handles quotes, CRLF, and comma / tab (pasted from Excel or Sheets) / semicolon. */
export function parseDelimited(text: string): { headers: string[]; rows: Array<Record<string, string>>; delimiter: string } {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const counts: Array<[string, number]> = [",", "\t", ";"].map((d) => [d, firstLine.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  const delimiter = counts[0]![1] > 0 ? counts[0]![0] : ",";
  const records: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (inQ) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delimiter) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cur);
      records.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur);
    records.push(row);
  }
  const nonEmpty = records.filter((r) => r.some((c) => c.trim().length));
  if (!nonEmpty.length) return { headers: [], rows: [], delimiter };
  const headers = nonEmpty[0]!.map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((cols) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) o[h] = (cols[i] ?? "").trim();
    });
    return o;
  });
  return { headers: headers.filter(Boolean), rows, delimiter };
}

/** Apply a mapping (template field → file header) to a raw row. Unmapped fields fall back to a same-named header. */
export function pickFields(template: ImportTemplate, raw: Record<string, string>, mapping: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of template.fields) {
    const header = mapping[f.key];
    out[f.key] = String((header ? raw[header] : raw[f.key]) ?? "").trim();
  }
  return out;
}

export type TemplatePreview = { total: number; willCreate: number; skipped: number; errors: number; estimate: number; samples: Array<{ row: number; outcome: string }>; missingRequired: string[] };

/** Dry run — what an import would do. Same transform as the server, so the preview is honest. */
export function previewTemplate(template: ImportTemplate, rows: Array<Record<string, string>>, mapping: Record<string, string>): TemplatePreview {
  const missingRequired = template.fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);
  let picked = rows.map((r) => pickFields(template, r, mapping));
  if (template.aggregate) picked = template.aggregate(picked);
  let willCreate = 0;
  let skipped = 0;
  let errors = 0;
  let estimate = 0;
  const samples: TemplatePreview["samples"] = [];
  picked.forEach((v, i) => {
    const res = template.transform(v, i + 2);
    if ("record" in res) {
      willCreate++;
      estimate += Number(res.record.estimatedAmount || res.record.estimatedWasteAnnual || 0) || 0;
      if (samples.length < 4) samples.push({ row: i + 2, outcome: `${res.record.title || res.record.name}${res.record.estimatedAmount ? ` · ${fmt(Number(res.record.estimatedAmount))}` : res.record.estimatedWasteAnnual && Number(res.record.estimatedWasteAnnual) ? ` · ${fmt(Number(res.record.estimatedWasteAnnual))}/yr` : ""}` });
    } else if ("skip" in res) skipped++;
    else errors++;
  });
  return { total: picked.length, willCreate, skipped, errors, estimate: Math.round(estimate * 100) / 100, samples, missingRequired };
}

const req = (v: Record<string, string>, keys: string[]): string | null => {
  const miss = keys.filter((k) => !v[k]);
  return miss.length ? `missing ${miss.join(", ")}` : null;
};

// ———————————————————————— templates ————————————————————————

export const IMPORT_TEMPLATES: ImportTemplate[] = [
  {
    slug: "billing_export",
    name: "Billing export (invoices)",
    group: "Revenue Recovery",
    kind: "opportunities",
    summary: "Invoice-level export from your billing system with the amount billed and the amount that should have been billed.",
    creates: "One revenue item per invoice billed below its expected amount. The gap is an estimate.",
    fields: [
      { key: "invoice_id", label: "Invoice #", required: true, type: "text", synonyms: ["invoice", "invoice number", "invoice no", "inv", "inv no", "document number", "bill id"] },
      { key: "customer", label: "Customer", required: true, type: "text", synonyms: ["client", "account", "customer name", "bill to", "company"] },
      { key: "billed", label: "Amount billed", required: true, type: "money", synonyms: ["billed amount", "invoice amount", "amount", "invoice total", "total billed", "charged"] },
      { key: "expected", label: "Expected amount", required: true, type: "money", synonyms: ["expected", "contracted amount", "contract amount", "should bill", "list amount", "rate card amount", "standard amount"] },
      { key: "invoice_date", label: "Invoice date", type: "date", synonyms: ["date", "bill date", "issued"] },
      { key: "description", label: "Service / description", type: "text", synonyms: ["service", "item", "memo", "line description"] },
    ],
    sample: "Invoice #,Customer,Amount billed,Expected amount,Invoice date,Service\nINV-1042,Northwind Clinic,4200,5100,2026-09-03,Monthly retainer\nINV-1043,Harbor Dental,1800,1800,2026-09-04,Support plan",
    transform: (v) => {
      const miss = req(v, ["invoice_id", "customer", "billed", "expected"]);
      if (miss) return { error: miss };
      const billed = parseMoney(v.billed);
      const expected = parseMoney(v.expected);
      if (billed == null || expected == null) return { error: "billed/expected amount is not a number" };
      const gap = expected - billed;
      if (gap <= 0.005) return { skip: "billed at or above expected" };
      return {
        record: {
          title: `Underbilled invoice ${v.invoice_id} · ${v.customer}`.slice(0, 200),
          description: `Billed ${fmt(billed)} vs expected ${fmt(expected)}${v.invoice_date ? ` on ${v.invoice_date}` : ""}${v.description ? ` · ${v.description}` : ""}. Gap is an estimate until confirmed.`,
          estimatedAmount: money2(gap),
          type: "underbilling",
          source: "billing_export",
          sourceId: `inv:${v.invoice_id}`,
        },
      };
    },
  },
  {
    slug: "payer_remittance",
    name: "Payer remittance (835-style summary)",
    group: "Revenue Recovery",
    kind: "opportunities",
    summary: "Claim-level remittance summary: billed, allowed, paid, and any denial / adjustment code.",
    creates: "One revenue item per denied claim or claim paid below the allowed amount. Amounts are estimates.",
    fields: [
      { key: "claim_id", label: "Claim #", required: true, type: "text", synonyms: ["claim", "claim number", "claim no", "icn", "patient control number", "pcn"] },
      { key: "payer", label: "Payer", required: true, type: "text", synonyms: ["insurer", "insurance", "plan", "payer name", "carrier"] },
      { key: "billed", label: "Billed / charge", type: "money", synonyms: ["charge", "charges", "billed amount", "total charge", "submitted"] },
      { key: "allowed", label: "Allowed", type: "money", synonyms: ["allowed amount", "contracted", "expected payment", "approved"] },
      { key: "paid", label: "Paid", required: true, type: "money", synonyms: ["paid amount", "payment", "amount paid", "plan paid", "insurance paid"] },
      { key: "patient_resp", label: "Patient responsibility", type: "money", synonyms: ["patient responsibility", "pt resp", "patient portion", "copay", "deductible"] },
      { key: "denial_code", label: "Denial / adjustment code", type: "text", synonyms: ["carc", "reason code", "adjustment code", "denial reason", "remark code", "status"] },
    ],
    sample: "Claim #,Payer,Charge,Allowed,Paid,Patient responsibility,Reason code\nC-88121,Aetna,1250,980,610,120,CO-45\nC-88122,Cigna,640,520,0,0,CO-197\nC-88123,BCBS,300,240,220,20,",
    transform: (v) => {
      const miss = req(v, ["claim_id", "payer", "paid"]);
      if (miss) return { error: miss };
      const paid = parseMoney(v.paid);
      const allowed = parseMoney(v.allowed);
      const billed = parseMoney(v.billed);
      const pr = parseMoney(v.patient_resp) ?? 0;
      if (paid == null) return { error: "paid is not a number" };
      const code = (v.denial_code || "").trim();
      const denied = paid === 0 && (code.length > 0 || allowed == null);
      if (denied) {
        const amt = allowed ?? billed;
        if (amt == null || amt <= 0) return { error: "denied claim needs an allowed or billed amount" };
        return {
          record: {
            title: `Denied claim ${v.claim_id} · ${v.payer}${code ? ` (${code})` : ""}`.slice(0, 200),
            description: `Paid $0 against ${allowed != null ? `allowed ${fmt(allowed)}` : `billed ${fmt(billed!)}`}${code ? `, reason ${code}` : ""}. Estimated recoverable until worked.`,
            estimatedAmount: money2(amt),
            type: "denied_claim",
            source: "payer_remittance",
            sourceId: `claim:${v.claim_id}`,
          },
        };
      }
      if (allowed == null) return { skip: "no allowed amount to compare" };
      const gap = allowed - paid - pr;
      if (gap <= 0.005) return { skip: "paid as allowed" };
      return {
        record: {
          title: `Underpaid claim ${v.claim_id} · ${v.payer}`.slice(0, 200),
          description: `Allowed ${fmt(allowed)}, paid ${fmt(paid)}${pr ? `, patient responsibility ${fmt(pr)}` : ""}${code ? `, code ${code}` : ""}. Gap is an estimate.`,
          estimatedAmount: money2(gap),
          type: "payer_underpayment",
          source: "payer_remittance",
          sourceId: `claim:${v.claim_id}`,
        },
      };
    },
  },
  {
    slug: "contract_pricing",
    name: "Contracts / price list vs billed",
    group: "Revenue Recovery",
    kind: "opportunities",
    summary: "Contracted price per customer and item next to what was actually billed.",
    creates: "One revenue item per customer + item billed below contract. (Contract − billed) × quantity is an estimate.",
    fields: [
      { key: "customer", label: "Customer", required: true, type: "text", synonyms: ["client", "account", "customer name"] },
      { key: "item", label: "Item / SKU", required: true, type: "text", synonyms: ["sku", "product", "service", "line item", "code", "cpt"] },
      { key: "contract_price", label: "Contract price", required: true, type: "money", synonyms: ["contracted price", "contract rate", "list price", "agreed price", "price list"] },
      { key: "billed_price", label: "Billed price", required: true, type: "money", synonyms: ["actual price", "invoiced price", "unit price billed", "billed rate", "charged price"] },
      { key: "quantity", label: "Quantity", type: "number", synonyms: ["qty", "units", "volume", "count"] },
      { key: "period", label: "Period / invoice ref", type: "text", synonyms: ["month", "invoice", "period", "billing period"] },
    ],
    sample: "Customer,SKU,Contract price,Billed price,Qty,Period\nAcme Logistics,PRO-SEAT,95,79,40,2026-09\nAcme Logistics,API-CALLS,0.02,0.02,500000,2026-09",
    transform: (v, row) => {
      const miss = req(v, ["customer", "item", "contract_price", "billed_price"]);
      if (miss) return { error: miss };
      const cp = parseMoney(v.contract_price);
      const bp = parseMoney(v.billed_price);
      const qty = v.quantity ? parseNum(v.quantity) : 1;
      if (cp == null || bp == null || qty == null) return { error: "price or quantity is not a number" };
      const gap = (cp - bp) * qty;
      if (gap <= 0.005) return { skip: "billed at or above contract" };
      return {
        record: {
          title: `Below-contract pricing · ${v.customer} · ${v.item}`.slice(0, 200),
          description: `Contract ${fmt(cp)} vs billed ${fmt(bp)} × ${qty}${v.period ? ` (${v.period})` : ""}. Gap is an estimate.`,
          estimatedAmount: money2(gap),
          type: "price_variance",
          source: "contract_pricing",
          sourceId: `px:${v.customer}:${v.item}:${v.period || `row${row}`}`.slice(0, 190),
        },
      };
    },
  },
  {
    slug: "ar_aging",
    name: "AR aging report",
    group: "Revenue Recovery",
    kind: "opportunities",
    summary: "Open receivables with balance and days past due (or an aging bucket like 61–90 / 90+).",
    creates: "One revenue item per balance 60+ days past due. The balance at risk is an estimate, not cash collected.",
    fields: [
      { key: "customer", label: "Customer", required: true, type: "text", synonyms: ["client", "account", "customer name", "debtor"] },
      { key: "invoice_id", label: "Invoice #", type: "text", synonyms: ["invoice", "invoice number", "document", "ref"] },
      { key: "balance", label: "Open balance", required: true, type: "money", synonyms: ["balance", "amount due", "outstanding", "open amount", "balance due", "amount"] },
      { key: "days_past_due", label: "Days past due", type: "number", synonyms: ["days overdue", "dpd", "age", "days", "aging days", "days outstanding"] },
      { key: "bucket", label: "Aging bucket", type: "text", synonyms: ["aging", "aging bucket", "bucket", "period"] },
    ],
    sample: "Customer,Invoice,Balance,Days past due\nBlue Harbor LLC,INV-7712,12400,94\nGreenway Co,INV-7790,3100,35",
    transform: (v, row) => {
      const miss = req(v, ["customer", "balance"]);
      if (miss) return { error: miss };
      const bal = parseMoney(v.balance);
      if (bal == null) return { error: "balance is not a number" };
      if (bal <= 0) return { skip: "no open balance" };
      let days = v.days_past_due ? parseNum(v.days_past_due) : null;
      if (days == null && v.bucket) {
        const nums = (v.bucket.match(/\d+/g) ?? []).map(Number);
        days = nums.length ? Math.max(...nums) : null;
        if (/\+|over|>/.test(v.bucket) && nums.length) days = nums[0]! + 1;
      }
      if (days == null) return { error: "needs days past due or an aging bucket" };
      if (days < 60) return { skip: "under 60 days past due" };
      return {
        record: {
          title: `Aged receivable · ${v.customer}${v.invoice_id ? ` · ${v.invoice_id}` : ""} (${Math.round(days)} days)`.slice(0, 200),
          description: `Open balance ${fmt(bal)}, ${Math.round(days)} days past due. Balance at risk — an estimate, not cash collected.`,
          estimatedAmount: money2(bal),
          type: "aged_receivable",
          source: "ar_aging",
          sourceId: `ar:${v.customer}:${v.invoice_id || `row${row}`}`.slice(0, 190),
        },
      };
    },
  },
  {
    slug: "timesheets",
    name: "Timesheets / process log",
    group: "Operations Efficiency",
    kind: "inefficiencies",
    summary: "Hours spent per process or activity (rows per person or per day are fine — they are totalled per process).",
    creates: "One operations item per process with weekly hours and, if you include an hourly rate, the projected annual cost of that effort.",
    fields: [
      { key: "process", label: "Process / activity", required: true, type: "text", synonyms: ["activity", "task", "workflow", "process name", "category", "project"] },
      { key: "hours", label: "Hours", required: true, type: "number", synonyms: ["hours spent", "duration hours", "time hours", "hrs", "total hours", "time"] },
      { key: "weeks", label: "Weeks covered", type: "number", synonyms: ["period weeks", "weeks in period", "number of weeks"], help: "How many weeks the log covers (default 1)." },
      { key: "rate", label: "Hourly rate", type: "money", synonyms: ["hourly rate", "cost per hour", "loaded rate", "rate per hour", "wage"] },
      { key: "manual", label: "Manual work?", type: "bool", synonyms: ["is manual", "manual flag", "rework", "automatable"] },
      { key: "department", label: "Department", type: "text", synonyms: ["team", "dept", "group"] },
    ],
    sample: "Activity,Hours,Hourly rate,Manual,Team\nInvoice re-keying,6.5,48,yes,Finance\nInvoice re-keying,7,48,yes,Finance\nPrior auth follow-up,11,42,yes,Front desk",
    aggregate: (rows) => {
      const groups = new Map<string, Record<string, string> & { _h: string }>();
      for (const r of rows) {
        const key = `${(r.process || "").toLowerCase()}|${(r.department || "").toLowerCase()}`;
        const h = parseNum(r.hours) ?? 0;
        const g = groups.get(key);
        if (!g) groups.set(key, { ...r, _h: String(h) });
        else {
          g._h = String(Number(g._h) + h);
          if (!g.rate && r.rate) g.rate = r.rate;
          if (!parseBool(g.manual) && parseBool(r.manual)) g.manual = r.manual;
        }
      }
      return Array.from(groups.values()).map(({ _h, ...r }) => ({ ...r, hours: _h }));
    },
    transform: (v) => {
      const miss = req(v, ["process", "hours"]);
      if (miss) return { error: miss };
      const hours = parseNum(v.hours);
      const weeks = v.weeks ? parseNum(v.weeks) : 1;
      const rate = v.rate ? parseMoney(v.rate) : null;
      if (hours == null || weeks == null || weeks <= 0) return { error: "hours/weeks is not a number" };
      if (hours <= 0) return { skip: "no hours" };
      const weekly = hours / weeks;
      const annual = rate != null ? weekly * rate * 52 : 0;
      return {
        record: {
          title: `Manual effort · ${v.process}`.slice(0, 200),
          description: `${weekly.toFixed(1)} h/week logged${rate != null ? ` at ${fmt(rate)}/h → projected ${fmt(Math.round(annual))}/yr` : " (no hourly rate given, so no cost estimate)"}. Projected, not a realized saving.`,
          estimatedWasteAnnual: money2(annual),
          hoursWastedWeekly: weekly.toFixed(2),
          automationCandidate: parseBool(v.manual) ? "true" : "false",
          department: v.department || "",
          type: "manual_effort",
          source: "timesheets",
          sourceId: `ts:${v.process}:${v.department || ""}`.toLowerCase().slice(0, 190),
        },
      };
    },
  },
  {
    slug: "opportunities",
    name: "Revenue items (standard)",
    group: "Kaivaryn standard",
    kind: "opportunities",
    summary: "Already-identified revenue items with a title and estimated amount.",
    creates: "One revenue item per row (estimated potential).",
    fields: [
      { key: "title", label: "Title", required: true, type: "text", synonyms: ["name", "opportunity", "issue", "summary"] },
      { key: "estimatedAmount", label: "Estimated amount", type: "money", synonyms: ["amount", "potential", "potential amount", "value", "estimate"] },
      { key: "description", label: "Description", type: "text", synonyms: ["details", "notes"] },
      { key: "department", label: "Department", type: "text", synonyms: ["team", "dept"] },
      { key: "type", label: "Type", type: "text", synonyms: ["category"] },
      { key: "sourceId", label: "External ID", type: "text", synonyms: ["id", "external id", "reference", "ref"] },
    ],
    sample: "Title,Estimated amount,Department\nUnbilled change orders Q3,18500,Finance",
    transform: (v) => (v.title ? { record: { title: v.title.slice(0, 200), estimatedAmount: money2(parseMoney(v.estimatedAmount) ?? 0), description: v.description, department: v.department, type: v.type, sourceId: v.sourceId } } : { error: "missing title" }),
  },
  {
    slug: "inefficiencies",
    name: "Operations items (standard)",
    group: "Kaivaryn standard",
    kind: "inefficiencies",
    summary: "Already-identified operations items with projected annual waste and weekly hours.",
    creates: "One operations item per row (projected savings).",
    fields: [
      { key: "title", label: "Title", required: true, type: "text", synonyms: ["name", "issue", "inefficiency", "summary"] },
      { key: "estimatedWasteAnnual", label: "Projected annual waste", type: "money", synonyms: ["annual waste", "waste", "projected savings", "savings", "cost"] },
      { key: "hoursWastedWeekly", label: "Hours per week", type: "number", synonyms: ["hours", "hours weekly", "weekly hours"] },
      { key: "automationCandidate", label: "Automation candidate", type: "bool", synonyms: ["automatable", "automation"] },
      { key: "description", label: "Description", type: "text", synonyms: ["details", "notes"] },
      { key: "department", label: "Department", type: "text", synonyms: ["team", "dept"] },
      { key: "sourceId", label: "External ID", type: "text", synonyms: ["id", "external id", "reference", "ref"] },
    ],
    sample: "Title,Projected annual waste,Hours per week,Automation candidate\nManual claim status checks,41000,16,yes",
    transform: (v) =>
      v.title
        ? { record: { title: v.title.slice(0, 200), estimatedWasteAnnual: money2(parseMoney(v.estimatedWasteAnnual) ?? 0), hoursWastedWeekly: v.hoursWastedWeekly, automationCandidate: parseBool(v.automationCandidate) ? "true" : "false", description: v.description, department: v.department, sourceId: v.sourceId } }
        : { error: "missing title" },
  },
  {
    slug: "customers",
    name: "Customers (standard)",
    group: "Kaivaryn standard",
    kind: "customers",
    summary: "Customer list with status and last activity date (used by churn and dormancy rules).",
    creates: "One customer per row.",
    fields: [
      { key: "name", label: "Name", required: true, type: "text", synonyms: ["customer", "customer name", "company", "account"] },
      { key: "email", label: "Email", type: "text", synonyms: ["e-mail", "contact email"] },
      { key: "status", label: "Status", type: "text", synonyms: ["state"] },
      { key: "lastActivityAt", label: "Last activity", type: "date", synonyms: ["last activity", "last seen", "last order", "last visit"] },
      { key: "sourceId", label: "External ID", type: "text", synonyms: ["id", "customer id", "account id"] },
    ],
    sample: "Name,Email,Status,Last activity\nNorthwind Clinic,ops@northwind.example,ACTIVE,2026-08-14",
    transform: (v) => (v.name ? { record: { name: v.name.slice(0, 200), email: v.email, status: v.status?.toUpperCase() || "ACTIVE", lastActivityAt: v.lastActivityAt && !Number.isNaN(Date.parse(v.lastActivityAt)) ? v.lastActivityAt : "", sourceId: v.sourceId } } : { error: "missing name" }),
  },
  {
    slug: "processes",
    name: "Processes (standard)",
    group: "Kaivaryn standard",
    kind: "processes",
    summary: "Process catalogue with average cycle time.",
    creates: "One process per row.",
    fields: [
      { key: "name", label: "Name", required: true, type: "text", synonyms: ["process", "process name", "workflow"] },
      { key: "description", label: "Description", type: "text", synonyms: ["details", "notes"] },
      { key: "avgCycleDays", label: "Avg cycle (days)", type: "number", synonyms: ["cycle days", "cycle time", "avg days", "turnaround"] },
      { key: "sourceId", label: "External ID", type: "text", synonyms: ["id", "process id"] },
    ],
    sample: "Name,Avg cycle (days)\nClaims resubmission,9",
    transform: (v) => (v.name ? { record: { name: v.name.slice(0, 200), description: v.description, avgCycleDays: v.avgCycleDays && parseNum(v.avgCycleDays) != null ? String(parseNum(v.avgCycleDays)) : "", sourceId: v.sourceId } } : { error: "missing name" }),
  },
];

export function getTemplate(slug: string | null | undefined): ImportTemplate | null {
  return IMPORT_TEMPLATES.find((t) => t.slug === slug) ?? null;
}

/** Template list without functions — safe to pass to client components. */
export function templateCatalog() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return IMPORT_TEMPLATES.map(({ transform: _t, aggregate: _a, ...rest }) => rest);
}
