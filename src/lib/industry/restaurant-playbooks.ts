/**
 * Restaurant playbook templates for Revenue Recovery (RR) and Operations Efficiency (OE).
 * These are templates and recommendations — not findings, not results. A template becomes a
 * tenant-owned playbook only when a team member chooses "Add to my playbooks". Until POS data is
 * connected, a run analyzes whatever this workspace has imported.
 */
import type { RunStep } from "@/lib/operate/runs";
import type { DataDomainId } from "./restaurant";

export type RestaurantPlaybookTemplate = {
  slug: string;
  name: string;
  product: "REVENUE_RECOVERY" | "OPERATIONS_EFFICIENCY";
  looksFor: string;
  example: string;
  needs: DataDomainId[];
  needsSystems?: string[];
  voiceTie?: boolean;
  steps: RunStep[];
};

const rr = (slug: string, name: string, looksFor: string, example: string, needs: DataDomainId[], task: string, extra: Partial<RestaurantPlaybookTemplate> = {}): RestaurantPlaybookTemplate => ({
  slug, name, product: "REVENUE_RECOVERY", looksFor, example, needs, ...extra,
  steps: [{ kind: "DETECT" }, { kind: "ANALYZE", product: "REVENUE_RECOVERY", intent: name }, { kind: "TASK", title: task }, { kind: "BRIEF" }],
});
const oe = (slug: string, name: string, looksFor: string, example: string, needs: DataDomainId[], task: string, extra: Partial<RestaurantPlaybookTemplate> = {}): RestaurantPlaybookTemplate => ({
  slug, name, product: "OPERATIONS_EFFICIENCY", looksFor, example, needs, ...extra,
  steps: [{ kind: "DETECT" }, { kind: "ANALYZE", product: "OPERATIONS_EFFICIENCY", intent: name }, { kind: "TASK", title: task }, { kind: "BRIEF" }],
});

export const RESTAURANT_PLAYBOOKS: RestaurantPlaybookTemplate[] = [
  rr("restaurant-comps-voids-discounts", "Comps, voids & discount leakage",
    "Comps, voids, and discounts outside policy — by employee, shift, reason, and time after the order was fired.",
    "Illustrative: voids entered after the kitchen fired the ticket, clustered on one closing shift.",
    ["adjustments", "sales", "labor"], "Review comp, void, and discount exceptions with the general manager"),
  rr("restaurant-refund-anomalies", "Refund anomalies",
    "Refunds that don't fit the pattern — unusual amounts, repeat cards, refunds with no matching check, or refunds outside open hours.",
    "Illustrative: several card refunds issued after close by the same login.",
    ["refunds", "payments", "labor"], "Review flagged refunds and confirm each one with the manager on duty"),
  rr("restaurant-missed-online-orders", "Missed or abandoned online orders",
    "Online orders that were rejected, timed out, cancelled, or never accepted — and the hours they cluster in.",
    "Illustrative: tablet orders auto-cancelling during the Friday dinner rush.",
    ["online", "sales"], "Fix the order-acceptance gap for the hours where orders are being missed",
    { needsSystems: ["doordash", "ubereats", "grubhub", "olo", "chownow"] }),
  rr("restaurant-unanswered-calls", "Unanswered calls & reservation requests",
    "Calls and reservation requests that rang out or never got a reply — the demand that never became a booking or an order.",
    "Illustrative: the phone going unanswered during the 6–8pm rush, when reservation calls peak.",
    ["sales"], "Decide how calls during rush hours are answered — your team or your voice agent",
    { voiceTie: true, needsSystems: ["opentable", "resy", "yelp_guest_manager", "sevenrooms", "tock"] }),
  rr("restaurant-lapsed-regulars", "Lapsed regulars & loyalty win-back",
    "Regulars and loyalty members who used to visit often and have stopped — a list your team can win back.",
    "Illustrative: weekly regulars who haven't been in for six weeks.",
    ["guests", "sales"], "Approve a win-back offer and choose who reaches out to lapsed regulars"),
  rr("restaurant-delivery-disputes", "Delivery-platform fees & chargeback disputes",
    "Delivery-platform error charges, missing-item refunds, and chargebacks that were never disputed, and fees that don't match your agreement.",
    "Illustrative: missing-item adjustments accepted without dispute on orders the kitchen marked complete.",
    ["online", "refunds", "payments"], "Dispute eligible delivery-platform adjustments before the dispute window closes",
    { needsSystems: ["doordash", "ubereats", "grubhub"] }),
  rr("restaurant-menu-pricing", "Menu-pricing gaps",
    "Items priced differently across locations or channels, modifiers that should be charged but aren't, and prices that haven't moved while costs did.",
    "Illustrative: a popular add-on rung up free on most checks.",
    ["menu_mix", "sales", "inventory"], "Review the menu-pricing gaps and approve price or modifier changes"),
  oe("restaurant-labor-vs-sales", "Labor vs. sales by hour",
    "Labor hours against sales for every hour of the week — where you're over- or under-staffed.",
    "Illustrative: three servers on the floor Tuesday 2–4pm with almost no covers.",
    ["labor", "sales"], "Adjust next week's schedule for the over-staffed hours",
    { needsSystems: ["sevenshifts", "hotschedules", "homebase"] }),
  oe("restaurant-overtime", "Overtime watch",
    "Who is heading into overtime this week, and the shifts that keep creating it.",
    "Illustrative: the same two cooks crossing 40 hours by Saturday most weeks.",
    ["labor"], "Rebalance shifts that keep pushing staff into overtime"),
  oe("restaurant-food-cost", "Food cost & waste vs. theoretical",
    "The gap between what you should have used (recipes × sales) and what you actually bought and counted.",
    "Illustrative: protein usage running well ahead of what the menu mix explains.",
    ["inventory", "menu_mix", "sales"], "Investigate the items with the largest actual-vs-theoretical gap",
    { needsSystems: ["marketman", "marginedge", "restaurant365", "xtrachef"] }),
  oe("restaurant-prep-par", "Prep & par forecasting",
    "Prep and par levels based on what actually sells by day and day-part, so the kitchen preps less waste and runs out less.",
    "Illustrative: prepping the same amount every weekday although Monday sells half of Friday.",
    ["menu_mix", "sales", "inventory"], "Agree new par levels with the kitchen manager"),
  oe("restaurant-ticket-times", "Ticket times",
    "How long tickets take from order to served, by station, hour, and item — and where the line backs up.",
    "Illustrative: one station adding most of the wait on weekend brunch.",
    ["sales", "menu_mix"], "Fix the station or step that slows tickets at peak"),
  oe("restaurant-reporting", "Reporting automation",
    "The daily and weekly reports managers build by hand — sales, labor, comps, food cost — delivered automatically instead.",
    "Illustrative: a manager spending an hour after close copying POS numbers into a spreadsheet.",
    ["sales", "labor", "adjustments"], "List the manual reports to replace and who needs each one"),
];

export const restaurantPlaybook = (slug: string) => RESTAURANT_PLAYBOOKS.find((p) => p.slug === slug);
export const RESTAURANT_TEMPLATE_PREFIX = "Restaurant template · ";
