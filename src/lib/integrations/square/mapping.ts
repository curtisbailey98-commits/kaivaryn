/**
 * Pure mapping from Square objects to Kaivaryn Transaction rows.
 * Money: Square amounts are integer minor units (cents) → dollars.
 * Statuses are chosen so Square data never trips unrelated rules: a declined card is "DECLINED" (not "FAILED",
 * which the failed-payment recovery rule reads), a failed/rejected refund is "REJECTED", a voided order "VOIDED".
 */
import type { SquareMoney, SquareOrder, SquarePayment, SquareRefund } from "./client";
import { SQUARE_SOURCE } from "./config";

export type MappedTxn = {
  type: "PAYMENT" | "REFUND" | "ORDER";
  status: string;
  amount: number;
  currency: string;
  occurredAt: Date;
  source: string;
  sourceId: string;
  locationId: string | null;
  detail: Record<string, unknown>;
};

export const cents = (m: SquareMoney): number => {
  const n = Number(m?.amount ?? 0);
  return Number.isFinite(n) ? Math.round(n) / 100 : 0;
};
const cur = (m: SquareMoney, fallback = "USD") => (m?.currency ? String(m.currency) : fallback);
const date = (...xs: Array<string | undefined>) => {
  for (const x of xs) {
    if (!x) continue;
    const d = new Date(x);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
};

export function paymentStatus(s?: string) {
  switch (String(s || "").toUpperCase()) {
    case "COMPLETED": return "SUCCEEDED";
    case "APPROVED":
    case "PENDING": return "PENDING";
    case "CANCELED": return "CANCELED";
    case "FAILED": return "DECLINED";
    default: return "PENDING";
  }
}
export function refundStatus(s?: string) {
  switch (String(s || "").toUpperCase()) {
    case "COMPLETED": return "SUCCEEDED";
    case "PENDING": return "PENDING";
    default: return "REJECTED"; // REJECTED | FAILED — never "FAILED"
  }
}
export function orderStatus(s?: string) {
  switch (String(s || "").toUpperCase()) {
    case "COMPLETED": return "SUCCEEDED";
    case "CANCELED": return "VOIDED";
    default: return "PENDING";
  }
}

export function mapPayment(p: SquarePayment): MappedTxn {
  const total = p.total_money ?? p.amount_money;
  return {
    type: "PAYMENT",
    status: paymentStatus(p.status),
    amount: cents(total),
    currency: cur(total),
    occurredAt: date(p.created_at, p.updated_at),
    source: SQUARE_SOURCE,
    sourceId: `payment:${p.id}`,
    locationId: p.location_id ?? null,
    detail: {
      squareStatus: p.status ?? null,
      tender: String(p.source_type || "OTHER").toUpperCase(),
      cardBrand: p.card_details?.card?.card_brand ?? null,
      amount: cents(p.amount_money),
      tip: cents(p.tip_money),
      refunded: cents(p.refunded_money),
      orderId: p.order_id ?? null,
    },
  };
}

export function mapRefund(r: SquareRefund): MappedTxn {
  return {
    type: "REFUND",
    status: refundStatus(r.status),
    amount: cents(r.amount_money),
    currency: cur(r.amount_money),
    occurredAt: date(r.created_at, r.updated_at),
    source: SQUARE_SOURCE,
    sourceId: `refund:${r.id}`,
    locationId: r.location_id ?? null,
    detail: { squareStatus: r.status ?? null, paymentId: r.payment_id ?? null, orderId: r.order_id ?? null, reason: r.reason ? String(r.reason).slice(0, 200) : null },
  };
}

const COMP_NAME = /\bcomp(ed|s|limentary)?\b/i;

/** Comps: line items fully discounted to $0, or covered by a discount named like "Comp". Never double counted. */
export function orderDiscounts(o: SquareOrder) {
  const discountName = new Map<string, string>();
  for (const d of o.discounts || []) if (d.uid) discountName.set(d.uid, String(d.name || ""));
  let comps = 0;
  let gross = 0;
  const compItems: string[] = [];
  for (const li of o.line_items || []) {
    const g = cents(li.gross_sales_money);
    const disc = cents(li.total_discount_money);
    gross += g;
    const namedComp = (li.applied_discounts || []).some((a) => COMP_NAME.test(discountName.get(String(a.discount_uid)) || ""));
    const fullyDiscounted = g > 0 && disc >= g - 0.005;
    if (namedComp || fullyDiscounted) {
      comps += disc > 0 ? disc : 0;
      if (disc > 0 && li.name) compItems.push(String(li.name).slice(0, 60));
    }
  }
  const totalDiscount = cents(o.total_discount_money);
  comps = Math.min(comps, totalDiscount || comps);
  const discounts = Math.max(0, Math.round((totalDiscount - comps) * 100) / 100);
  const names = Array.from(new Set((o.discounts || []).map((d) => String(d.name || "").trim()).filter(Boolean))).slice(0, 5);
  return { gross: Math.round(gross * 100) / 100, totalDiscount, comps: Math.round(comps * 100) / 100, discounts, compItems: compItems.slice(0, 10), discountNames: names };
}

export function mapOrder(o: SquareOrder): MappedTxn {
  const d = orderDiscounts(o);
  return {
    type: "ORDER",
    status: orderStatus(o.state),
    amount: cents(o.total_money),
    currency: cur(o.total_money),
    occurredAt: date(o.closed_at, o.created_at, o.updated_at),
    source: SQUARE_SOURCE,
    sourceId: `order:${o.id}`,
    locationId: o.location_id ?? null,
    detail: {
      squareState: o.state ?? null,
      gross: d.gross,
      discounts: d.discounts,
      comps: d.comps,
      compItems: d.compItems,
      discountNames: d.discountNames,
      tax: cents(o.total_tax_money),
      tip: cents(o.total_tip_money),
      serviceCharges: cents(o.total_service_charge_money),
      returns: cents(o.return_amounts?.total_money),
      lineItems: (o.line_items || []).length,
      tenders: (o.tenders || []).map((t) => String(t.type || "OTHER").toUpperCase()),
    },
  };
}
