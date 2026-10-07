/**
 * Restaurant / food-service industry catalog. Pure data — no DB, no network — so it can be used by
 * server pages, client components, the public site, and tests.
 *
 * Honesty rules baked in here:
 * - Selecting a system is a plan, never a connection (see integration states below).
 * - The data map says what a POS *commonly* makes available, "confirmed during setup". It never
 *   claims a live connection or verified API coverage.
 * - Brand names are shown as text with initials only. No logos, no partnership implied.
 */

export const INDUSTRY_OPTIONS = [
  ["professional_services", "Professional services", "Consulting, legal, accounting, and agencies."],
  ["healthcare", "Healthcare", "Practices, clinics, and care providers."],
  ["home_field_services", "Home & field services", "HVAC, plumbing, trades, and service crews."],
  ["manufacturing", "Manufacturing & distribution", "Production, wholesale, and logistics."],
  ["retail_commerce", "Retail & e-commerce", "Stores, online shops, and subscriptions."],
  ["restaurant", "Restaurant / food service", "Restaurants, bars, cafés, and catering."],
  ["other", "Something else", "Another kind of business."],
] as const;

export type IndustryId = (typeof INDUSTRY_OPTIONS)[number][0];
export const INDUSTRY_IDS = INDUSTRY_OPTIONS.map(([id]) => id) as readonly string[];

export const RESTAURANT_TYPES = [
  ["full_service", "Full-service", "Table service, servers, and courses."],
  ["quick_service", "Quick-service / fast casual", "Counter, drive-thru, or order-ahead."],
  ["multi_location", "Multi-location", "Two or more locations or a growing group."],
  ["bar", "Bar / nightlife", "Bar program, late service, and events."],
  ["catering", "Catering", "Off-site events, large orders, and deposits."],
] as const;

export type SystemOption = { key: string; name: string; initials: string; description: string };
export type SystemGroup = { id: string; title: string; description: string; options: SystemOption[]; restaurant?: boolean };

const opt = (key: string, name: string, initials: string, description: string): SystemOption => ({ key, name, initials, description });

export const POS_SYSTEMS: SystemOption[] = [
  opt("pos_toast", "Toast", "TO", "Restaurant POS with back-office reporting."),
  opt("pos_square", "Square for Restaurants", "SQ", "POS, payments, and the Square Dashboard."),
  opt("pos_clover", "Clover", "CL", "POS and payments with a web dashboard and apps."),
  opt("pos_lightspeed", "Lightspeed Restaurant", "LS", "POS with Lightspeed Back Office."),
  opt("pos_spoton", "SpotOn", "SO", "Restaurant POS and dashboard."),
  opt("pos_touchbistro", "TouchBistro", "TB", "iPad POS with TouchBistro Cloud reporting."),
  opt("pos_revel", "Revel", "RV", "iPad POS with a management console."),
  opt("pos_aloha", "NCR Aloha (Voyix)", "NA", "Aloha POS and back-office reporting."),
  opt("pos_simphony", "Oracle MICROS Simphony", "OS", "Enterprise POS for groups and venues."),
  opt("pos_heartland", "Heartland / Genius", "HG", "Restaurant POS and back office."),
  opt("pos_other", "Other POS", "··", "A different point-of-sale system — tell us which."),
];

export const RESTAURANT_GROUPS: SystemGroup[] = [
  { id: "pos", title: "Point of sale (POS)", description: "Where checks, menu sales, comps, voids, tips, and time punches live. Pick the one you use.", options: POS_SYSTEMS, restaurant: true },
  {
    id: "ordering_delivery", title: "Online ordering & delivery", description: "Third-party and first-party online orders, fees, and adjustments.", restaurant: true,
    options: [
      opt("doordash", "DoorDash", "DD", "Delivery orders, fees, and error adjustments."),
      opt("ubereats", "Uber Eats", "UE", "Delivery orders, fees, and refunds."),
      opt("grubhub", "Grubhub", "GH", "Delivery orders, fees, and adjustments."),
      opt("olo", "Olo", "OL", "First-party online ordering for brands and groups."),
      opt("chownow", "ChowNow", "CN", "Commission-free online ordering."),
    ],
  },
  {
    id: "reservations", title: "Reservations & waitlist", description: "Bookings, covers, no-shows, and guest notes.", restaurant: true,
    options: [
      opt("opentable", "OpenTable", "OT", "Reservations, covers, and guest profiles."),
      opt("resy", "Resy", "RS", "Reservations and waitlist."),
      opt("yelp_guest_manager", "Yelp Guest Manager", "YG", "Waitlist and reservations."),
      opt("sevenrooms", "SevenRooms", "7R", "Reservations, guest data, and marketing."),
      opt("tock", "Tock", "TK", "Reservations, prepaid experiences, and events."),
    ],
  },
  {
    id: "scheduling", title: "Scheduling & labor", description: "Schedules, shift swaps, and labor targets.", restaurant: true,
    options: [
      opt("sevenshifts", "7shifts", "7S", "Restaurant scheduling and labor compliance."),
      opt("hotschedules", "HotSchedules", "HS", "Scheduling and labor management."),
      opt("homebase", "Homebase", "HB", "Scheduling, time clock, and team messaging."),
    ],
  },
  {
    id: "inventory", title: "Inventory & food cost", description: "Invoices, counts, recipes, and actual vs. theoretical food cost.", restaurant: true,
    options: [
      opt("marketman", "MarketMan", "MM", "Inventory, purchasing, and recipe costing."),
      opt("marginedge", "MarginEdge", "ME", "Invoice processing and food-cost tracking."),
      opt("restaurant365", "Restaurant365", "R3", "Restaurant accounting, inventory, and operations."),
      opt("xtrachef", "xtraCHEF", "XC", "Invoices, recipe costing, and inventory."),
    ],
  },
];

const RESTAURANT_KEYS = new Set(RESTAURANT_GROUPS.flatMap((g) => g.options.map((o) => o.key)));
export const isRestaurantSystem = (key: string) => RESTAURANT_KEYS.has(key);
export const isPos = (key: string) => key.startsWith("pos_") && RESTAURANT_KEYS.has(key);

/** Display name for any restaurant system key; null if it isn't one. */
export function restaurantSystemName(key: string): string | null {
  for (const g of RESTAURANT_GROUPS) for (const o of g.options) if (o.key === key) return o.name;
  return null;
}

// ———————————————————— "What Kaivaryn would use" data map ————————————————————

export const DATA_DOMAINS = [
  { id: "sales", label: "Sales & checks", detail: "Check totals, items, covers, day-part, and revenue center." },
  { id: "menu_mix", label: "Menu mix", detail: "What sells, when, and at what price." },
  { id: "adjustments", label: "Discounts, comps & voids", detail: "Who applied them, when, on what, and the reason given." },
  { id: "refunds", label: "Refunds", detail: "Refunded checks and payments, with time and employee." },
  { id: "labor", label: "Labor & time punches", detail: "Clock-ins, breaks, roles, and hours by shift." },
  { id: "tips", label: "Tips", detail: "Tips and tip-outs by employee and shift." },
  { id: "payments", label: "Payment types", detail: "Card, cash, gift card, and third-party tenders." },
  { id: "online", label: "Online orders", detail: "Orders from online ordering or connected delivery partners." },
  { id: "guests", label: "Customers & loyalty", detail: "Guest records, visit history, and loyalty activity." },
  { id: "inventory", label: "Inventory", detail: "Counts, purchases, and usage for food-cost tracking." },
] as const;

export type DataDomainId = (typeof DATA_DOMAINS)[number]["id"];
/** core = commonly part of the POS itself; module = commonly available when the related module, add-on, or partner tool is in use. */
export type Availability = "core" | "module";

export const DATA_MAP_LABEL = "Commonly available — confirmed during setup";
export const AVAILABILITY_LABEL: Record<Availability, string> = {
  core: "Commonly available",
  module: "Commonly available with the related module or add-on",
};

const BASE_MAP: Record<DataDomainId, Availability> = {
  sales: "core", menu_mix: "core", adjustments: "core", refunds: "core", labor: "core", tips: "core", payments: "core",
  online: "module", guests: "module", inventory: "module",
};

/** Per-POS notes stay hedged ("typically", "often") — the setup call confirms what this restaurant actually has. */
const POS_NOTES: Record<string, string> = {
  pos_toast: "Reports typically export from Toast's back office. Inventory is often handled in xtraCHEF by Toast; loyalty and online ordering are Toast modules.",
  pos_square: "Reports and transactions typically export from the Square Dashboard. Loyalty is a Square add-on.",
  pos_clover: "Reports typically export from the Clover web dashboard. Features vary by plan and installed Clover apps.",
  pos_lightspeed: "Reports typically export from Lightspeed Back Office. Features vary by plan.",
  pos_spoton: "Daily sales export from the SpotOn Dashboard (Custom Views → Orders Per Day → Download CSV) and imports with Kaivaryn's SpotOn importer. Labor, loyalty, and online ordering depend on the SpotOn products in use.",
  pos_touchbistro: "Reports typically export from TouchBistro Cloud. Loyalty, online ordering, and reservations are separate TouchBistro products.",
  pos_revel: "Reports typically export from the Revel management console. Features vary by setup.",
  pos_aloha: "Data typically comes from Aloha back-office reporting. Setup often involves your NCR Voyix reseller.",
  pos_simphony: "Enterprise setups usually route reporting through Oracle's reporting tools; your IT team or integrator is typically involved.",
  pos_heartland: "Reports typically export from the Heartland Restaurant back office. Features vary by plan.",
  pos_other: "We map what your POS can export during setup.",
};

export type PosDataMap = { key: string; name: string; note: string; rows: Array<{ id: DataDomainId; label: string; detail: string; availability: Availability }> };

export function posDataMap(key: string, otherName?: string | null): PosDataMap | null {
  const pos = POS_SYSTEMS.find((p) => p.key === key);
  if (!pos) return null;
  const name = key === "pos_other" && otherName?.trim() ? otherName.trim().slice(0, 60) : pos.name;
  return {
    key,
    name,
    note: POS_NOTES[key] ?? POS_NOTES.pos_other,
    rows: DATA_DOMAINS.map((d) => ({ id: d.id, label: d.label, detail: d.detail, availability: BASE_MAP[d.id] })),
  };
}

export const HOW_DATA_ARRIVES = [
  "Start with a back-office export (CSV) — this works today through File import.",
  "Where your POS and plan allow it, Kaivaryn sets up a direct connection with you.",
  "Nothing is marked connected until data has actually arrived and been checked.",
] as const;
