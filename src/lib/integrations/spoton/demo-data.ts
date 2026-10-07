/**
 * SAMPLE data for the "SpotOn Demo Restaurant" example workspace only — not a real restaurant and not
 * client results. Generates a SpotOn-style "Orders Per Day" CSV (same columns as Kaivaryn's SpotOn template)
 * for the last N days, ending yesterday (America/New_York). Deterministic per calendar day, so re-seeding
 * produces the same numbers for the same dates.
 *
 * Story baked into the sample: about five weeks ago comps and voids started running above the restaurant's
 * usual rate (think: a new closing-shift routine). Refunds stay at the usual rate. Everything Kaivaryn shows
 * from this file is computed from it.
 */
import { SPOTON_TEMPLATE_HEADERS } from "./export-format";

export const SPOTON_DEMO_LOCATION = "Main St (sample)";
export const SPOTON_DEMO_DAYS = 90;
/** Days ago at which the comp / void routine changed (inside the 30-day window + a few baseline days). */
export const SPOTON_DEMO_SHIFT_DAY = 34;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r2 = (n: number) => Math.round(n * 100) / 100;
const DOW = [1.04, 0.7, 0.78, 0.85, 0.95, 1.3, 1.38]; // Sun..Sat

export function nyDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export type SpotOnDemoDay = { date: string; daysAgo: number; orders: number; guests: number; sales: number; voids: number; discounts: number; comps: number; refunds: number; taxes: number; tips: number; netSales: number };

export function buildSpotOnDemoDays(now = new Date(), days = SPOTON_DEMO_DAYS): SpotOnDemoDay[] {
  const out: SpotOnDemoDay[] = [];
  for (let ago = days; ago >= 1; ago--) {
    const date = nyDate(new Date(now.getTime() - ago * 86_400_000));
    const [y, m, d] = date.split("-").map(Number) as [number, number, number];
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const rand = rng(hash(`kaivaryn-spoton-demo:${date}`));
    const jitter = (pct: number) => 1 + (rand() * 2 - 1) * pct;
    const shifted = ago <= SPOTON_DEMO_SHIFT_DAY;
    const orders = Math.round(150 * DOW[dow]! * jitter(0.06));
    const sales = r2(orders * 36 * jitter(0.04));
    const compRate = (shifted ? 0.029 : 0.011) * jitter(0.12);
    const discRate = (shifted ? 0.025 : 0.02) * jitter(0.1);
    const voidRate = (shifted ? 0.023 : 0.01) * jitter(0.15);
    const refundRate = 0.005 * jitter(0.35);
    const comps = r2(sales * compRate);
    const discounts = r2(sales * discRate);
    const voids = r2((sales * voidRate) / (1 - voidRate));
    const refunds = r2(sales * refundRate);
    const netSales = r2(sales - discounts - comps - refunds);
    out.push({ date, daysAgo: ago, orders, guests: Math.round(orders * 1.85 * jitter(0.05)), sales, voids, discounts, comps, refunds, taxes: r2(netSales * 0.07), tips: r2(netSales * 0.165 * jitter(0.05)), netSales });
  }
  return out;
}

export function spotOnDemoCsv(daysData: SpotOnDemoDay[]) {
  const lines = [SPOTON_TEMPLATE_HEADERS.join(",")];
  for (const x of daysData) {
    lines.push([x.date, SPOTON_DEMO_LOCATION, x.orders, x.guests, x.sales.toFixed(2), x.voids.toFixed(2), x.discounts.toFixed(2), x.comps.toFixed(2), x.refunds.toFixed(2), x.taxes.toFixed(2), x.tips.toFixed(2), x.netSales.toFixed(2)].join(","));
  }
  return lines.join("\n");
}
