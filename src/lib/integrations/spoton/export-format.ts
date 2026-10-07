/**
 * SpotOn sales export → Kaivaryn POS rows. Pure (no DB, no network) so the importer, the demo seed,
 * the UI preview, and tests all share one mapping.
 *
 * What we know (public SpotOn docs, checked Oct 2026):
 * - SpotOn Dashboard → Reports → Custom Views → "Orders Per Day" template → Download CSV gives daily
 *   sales totals (help.spoton.com "View Daily Sales by Date Range").
 * - Restaurant reports expose the fields Sales, Voids, Actual, Discounts, Taxes, Refunds, Net Sales
 *   (help.spoton.com "Customize Your Restaurant Reporting View").
 * - Order Item List / Product Mix exports carry item-level detail (voided by, void reason, discounts).
 * What we do NOT know: the exact CSV header text of each export (SpotOn does not publish it, and it can
 * vary with the columns a merchant shows). So headers are matched flexibly by name, and every import
 * shows which column was used for what.
 *
 * Rows are either one day (daily summary) or one check (when an order / check number column exists).
 * Money produced here is POS sales data only. Nothing here is "recovered" money.
 */
import { parseDelimited, parseMoney, normHeader } from "../templates";

export const SPOTON_PROVIDER = "pos_spoton";
export const SPOTON_SOURCE = "spoton_export";
export const SPOTON_TEMPLATE_SLUG = "spoton_sales_export";
export const SPOTON_IMPORT_KIND = "pos_sales";
export const SPOTON_MAX_ROWS = 20000;

export type SpotOnField = { key: string; label: string; required?: boolean; money?: boolean; synonyms: string[]; help: string };

export const SPOTON_FIELDS: SpotOnField[] = [
  { key: "date", label: "Date", required: true, synonyms: ["business date", "businessdate", "fiscal date", "fiscal day", "day", "order date", "closed date", "closed at", "close time", "date closed"], help: "Business / fiscal day, or the time the check closed." },
  { key: "orderNumber", label: "Order number", synonyms: ["order #", "order", "check", "check #", "check number", "check no", "ticket", "ticket #", "order id"], help: "Only in check-level exports. When present, each row is one check." },
  { key: "location", label: "Location", synonyms: ["location name", "venue", "store", "restaurant", "site"], help: "Location name, if the export covers more than one." },
  { key: "orders", label: "Orders", synonyms: ["order count", "orders count", "# orders", "number of orders", "checks", "check count", "transactions", "tickets", "order no.", "order number (no.)"], help: "How many orders / checks that day (daily exports)." },
  { key: "guests", label: "Guests", synonyms: ["guest count", "covers", "# guests", "guest number", "guest no."], help: "Guest / cover count." },
  { key: "sales", label: "Sales", money: true, synonyms: ["gross sales", "gross", "gross sales amount", "item sales", "subtotal"], help: "Sales before discounts, comps, and refunds." },
  { key: "voids", label: "Voids", money: true, synonyms: ["void amount", "voids amount", "voided", "void total", "voided amount"], help: "Value of voided items." },
  { key: "discounts", label: "Discounts", money: true, synonyms: ["discount", "discounts amount", "discount total", "promotions"], help: "Discounts (comps too, if your export has no separate comp column)." },
  { key: "comps", label: "Comps", money: true, synonyms: ["comp", "comped", "comp amount", "comps amount", "comp total"], help: "Comps, if your export shows them separately." },
  { key: "refunds", label: "Refunds", money: true, synonyms: ["refund", "refund amount", "refunds amount", "returns"], help: "Refunds issued." },
  { key: "refundCount", label: "Refund count", synonyms: ["# refunds", "refunds count", "number of refunds"], help: "How many refunds (optional)." },
  { key: "taxes", label: "Taxes", money: true, synonyms: ["tax", "taxes amount", "tax amount", "total taxes", "sales tax"], help: "Taxes collected." },
  { key: "tips", label: "Tips", money: true, synonyms: ["tip", "tips amount", "gratuity", "tip total"], help: "Tips." },
  { key: "netSales", label: "Net Sales", money: true, synonyms: ["net", "net sales amount", "net total", "actual net"], help: "Net sales. If missing: Sales − Discounts − Comps − Refunds." },
  { key: "orderType", label: "Order type", synonyms: ["type", "dining option", "fulfillment type", "service type"], help: "Dine in, takeout, delivery… (check-level exports)." },
  { key: "employee", label: "Employee", synonyms: ["server", "server name", "employee name", "owner", "user", "user name"], help: "Server / employee (check-level exports)." },
];

const FIELD_BY_KEY = new Map(SPOTON_FIELDS.map((f) => [f.key, f]));

/** Match SpotOn export headers to fields: exact (normalized) names first, then a cautious contains-match. */
export function autoMapSpotOn(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  const normed = headers.map((h) => ({ h, n: normHeader(h) })).filter((x) => x.n);
  for (const f of SPOTON_FIELDS) {
    const cands = [f.key, f.label, ...f.synonyms].map(normHeader);
    const hit = normed.find((x) => !used.has(x.h) && cands.includes(x.n));
    if (hit) { map[f.key] = hit.h; used.add(hit.h); }
  }
  // Contains-match only for money columns with distinctive names (e.g. "Net Sales ($)", "Total Voids").
  for (const key of ["netSales", "voids", "comps", "refunds", "discounts", "taxes", "tips", "guests"]) {
    if (map[key]) continue;
    const f = FIELD_BY_KEY.get(key)!;
    const cands = [f.label, ...f.synonyms].map(normHeader).filter((c) => c.length >= 4);
    const hit = normed.find((x) => !used.has(x.h) && cands.some((c) => x.n.includes(c)));
    if (hit) { map[key] = hit.h; used.add(hit.h); }
  }
  return map;
}

/** "2026-10-01", "10/01/2026", "10/1/26", "Oct 1, 2026", "2026-10-01 18:42" → Date at local noon for date-only values. */
export function parseSpotOnDate(raw: string | undefined | null): Date | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return utcNoon(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t);
  if (m) { const y = +m[3]! < 100 ? 2000 + +m[3]! : +m[3]!; return utcNoon(y, +m[1]!, +m[2]!); }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}
function utcNoon(y: number, mo: number, d: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const x = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  return x.getUTCMonth() === mo - 1 ? x : null;
}
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export type SpotOnMapped = {
  type: "ORDER" | "REFUND";
  status: "SUCCEEDED";
  amount: number;
  currency: string;
  occurredAt: Date;
  source: string;
  sourceId: string;
  locationId: string | null;
  detail: Record<string, unknown>;
};

export type SpotOnMapResult = {
  granularity: "day" | "check";
  mapping: Record<string, string>;
  missingRequired: string[];
  rows: SpotOnMapped[];
  received: number;
  skipped: Array<{ row: number; reason: string }>;
  errors: Array<{ row: number; error: string }>;
};

/**
 * Map parsed SpotOn rows. One ORDER row per day (or check) holding net sales, plus one REFUND row when
 * refunds > 0 — the same shape Kaivaryn's POS signals read. sourceIds are stable, so re-importing the
 * same export updates rows instead of duplicating them.
 */
export function mapSpotOnRows(rows: Array<Record<string, string>>, mappingOverride?: Record<string, string> | null): SpotOnMapResult {
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const mapping = { ...autoMapSpotOn(headers) };
  for (const [k, v] of Object.entries(mappingOverride ?? {})) {
    if (!FIELD_BY_KEY.has(k)) continue;
    if (v === "") delete mapping[k];
    else if (headers.includes(v)) mapping[k] = v;
  }
  const missingRequired = SPOTON_FIELDS.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);
  const hasMoney = Boolean(mapping.netSales || mapping.sales);
  if (!hasMoney) missingRequired.push("Net Sales or Sales");
  const granularity: "day" | "check" = mapping.orderNumber ? "check" : "day";
  const out: SpotOnMapped[] = [];
  const skipped: SpotOnMapResult["skipped"] = [];
  const errors: SpotOnMapResult["errors"] = [];
  if (missingRequired.length) return { granularity, mapping, missingRequired, rows: out, received: rows.length, skipped, errors };

  const seen = new Set<string>();
  rows.forEach((raw, i) => {
    const rowNo = i + 2;
    const get = (k: string) => (mapping[k] ? String(raw[mapping[k]!] ?? "").trim() : "");
    const money = (k: string) => {
      const v = get(k);
      if (!v) return 0;
      const n = parseMoney(v);
      if (n === null) throw new Error(`${FIELD_BY_KEY.get(k)!.label}: "${v.slice(0, 30)}" is not an amount`);
      return Math.abs(n);
    };
    try {
      const dateRaw = get("date");
      if (/^(total|totals|grand total|summary)$/i.test(dateRaw) || /^(total|totals)$/i.test(get("orderNumber"))) { skipped.push({ row: rowNo, reason: "totals row" }); return; }
      const occurredAt = parseSpotOnDate(dateRaw);
      if (!occurredAt) { errors.push({ row: rowNo, error: dateRaw ? `Date "${dateRaw.slice(0, 30)}" not recognised` : "Date is empty" }); return; }
      const sales = money("sales");
      const discounts = money("discounts");
      const comps = money("comps");
      const refunds = money("refunds");
      const voids = money("voids");
      const net = mapping.netSales && get("netSales") ? money("netSales") : r2(Math.max(0, sales - discounts - comps - refunds));
      const gross = sales > 0 ? sales : r2(net + discounts + comps + refunds);
      const orders = granularity === "check" ? 1 : Math.max(0, Math.round(Number(get("orders").replace(/[,\s]/g, "")) || 0));
      if (granularity === "day" && gross <= 0 && orders === 0 && voids === 0) { skipped.push({ row: rowNo, reason: "no sales that day" }); return; }
      const location = get("location");
      const locationId = location ? `spoton:${slug(location)}` : null;
      const order = get("orderNumber");
      const baseId = granularity === "check" ? `check:${locationId ?? "_"}:${order}` : `day:${locationId ?? "_"}:${dayKey(occurredAt)}`;
      if (seen.has(baseId)) { skipped.push({ row: rowNo, reason: granularity === "check" ? "same check listed twice" : "same day listed twice" }); return; }
      seen.add(baseId);
      const refundCount = refunds > 0 ? Math.max(1, Math.round(Number(get("refundCount").replace(/[,\s]/g, "")) || 1)) : 0;
      out.push({
        type: "ORDER", status: "SUCCEEDED", amount: r2(net), currency: "USD", occurredAt, source: SPOTON_SOURCE, sourceId: baseId.slice(0, 190), locationId,
        detail: {
          granularity, orderCount: granularity === "check" ? 1 : orders, guests: Math.round(Number(get("guests").replace(/[,\s]/g, "")) || 0),
          gross: r2(gross), discounts: r2(discounts), comps: r2(comps), voids: r2(voids), refunds: r2(refunds), tax: r2(money("taxes")), tip: r2(money("tips")),
          locationName: location || null, orderNumber: order || null, orderType: get("orderType") || null, employee: get("employee") ? get("employee").slice(0, 60) : null,
        },
      });
      if (refunds > 0) {
        out.push({ type: "REFUND", status: "SUCCEEDED", amount: r2(refunds), currency: "USD", occurredAt, source: SPOTON_SOURCE, sourceId: `${baseId}:refunds`.slice(0, 190), locationId, detail: { granularity, refundCount, locationName: location || null } });
      }
    } catch (e) {
      errors.push({ row: rowNo, error: e instanceof Error ? e.message.slice(0, 160) : "error" });
    }
  });
  return { granularity, mapping, missingRequired, rows: out, received: rows.length, skipped, errors };
}

export function parseSpotOnCsv(text: string) {
  return parseDelimited(text);
}

/** Column headers of Kaivaryn's SpotOn template (matches SpotOn's documented report field names). */
export const SPOTON_TEMPLATE_HEADERS = ["Date", "Location", "Orders", "Guests", "Sales", "Voids", "Discounts", "Comps", "Refunds", "Taxes", "Tips", "Net Sales"];

/** Small downloadable sample (three days, clearly sample values). */
export const SPOTON_SAMPLE_CSV = [
  SPOTON_TEMPLATE_HEADERS.join(","),
  "2026-09-28,Main St (sample),214,402,8142.50,96.40,188.20,61.00,34.75,569.98,1210.45,7858.55",
  "2026-09-29,Main St (sample),231,431,8790.10,88.15,205.60,72.50,0.00,615.31,1306.12,8512.00",
  "2026-09-30,Main St (sample),262,497,9934.80,121.30,241.10,95.25,58.90,695.44,1477.03,9539.55",
].join("\n");
