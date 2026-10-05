/**
 * Resolve an integration guide for any catalog system key.
 * Vendor-specific guides come from the category files; anything else falls back to an honest generic.
 */
import { ALL_SYSTEMS, catalogSystem, isCatalogKey } from "@/lib/integrations/catalog";
import type { IntegrationGuide, VendorGuide } from "./types";
import { METHOD_LABEL, KAIVARYN_DOES, VERIFICATION, LADDER_NOTE, CONFIRM } from "./shared";
import { INTAKE_FIELDS } from "./intake";
import { POS_GUIDES } from "./pos";
import { POS_GUIDES_2 } from "./pos2";
import { DELIVERY_GUIDES, RESERVATION_GUIDES } from "./restaurant-addons";
import { LABOR_GUIDES, INVENTORY_GUIDES } from "./restaurant-ops";
import { CRM_GUIDES } from "./crm";
import { FINANCE_GUIDES } from "./finance";
import { SUPPORT_GUIDES, COMMERCE_GUIDES } from "./support-commerce";
import { WORK_GUIDES, DATA_GUIDES } from "./work-data";
import { COLLAB_GUIDES, HR_GUIDES, FLEX_GUIDES, OTHER_GUIDES } from "./collab-hr-flex";

const VENDOR: VendorGuide[] = [
  ...POS_GUIDES, ...POS_GUIDES_2,
  ...DELIVERY_GUIDES, ...RESERVATION_GUIDES,
  ...LABOR_GUIDES, ...INVENTORY_GUIDES,
  ...CRM_GUIDES, ...FINANCE_GUIDES,
  ...SUPPORT_GUIDES, ...COMMERCE_GUIDES,
  ...WORK_GUIDES, ...DATA_GUIDES,
  ...COLLAB_GUIDES, ...HR_GUIDES, ...FLEX_GUIDES, ...OTHER_GUIDES,
];

const BY_KEY = new Map(VENDOR.map((g) => [g.key, g]));

function genericFor(key: string): VendorGuide | null {
  const sys = catalogSystem(key);
  if (!sys) return null;
  const intake =
    /crm/i.test(sys.group) ? "crm" :
    /finance|billing|erp|accounting/i.test(sys.group) ? "accounting" :
    /support|service/i.test(sys.group) ? "support" :
    /commerce|subscription/i.test(sys.group) ? "commerce" :
    /work|operation/i.test(sys.group) ? "work" :
    /warehouse|database|data/i.test(sys.group) ? "data" :
    /collaborat|productiv/i.test(sys.group) ? "collab" :
    /people|workforce|payroll|hr/i.test(sys.group) ? "hr" :
    "flexible";
  return {
    key, method: "export", intake: intake as VendorGuide["intake"],
    methodNote: `${sys.name} isn't covered by a vendor-specific guide yet. We start with a controlled export and confirm any direct path with you and the vendor during setup. Kaivaryn does not claim a partnership with ${sys.name}.`,
    prerequisites: [`An admin for ${sys.name}.`],
    steps: [
      `Tell your Kaivaryn lead which ${sys.name} edition / plan you use.`,
      `Export the reports listed below from ${sys.name}.`,
      "Upload them in Kaivaryn → Imports and map the columns together.",
      `Any direct connection path is ${CONFIRM}.`,
    ],
    share: ["The reports and objects you and your Kaivaryn lead agree cover this business question"],
    exportFallback: [`Export weekly from ${sys.name} — exact menu ${CONFIRM}.`, "Upload each file in Kaivaryn → Imports."],
    sourceUrl: "https://kaivaryn.onrender.com/app/integrations",
  };
}

function checklistFor(g: VendorGuide): Array<{ id: string; label: string }> {
  return [
    { id: "prereqs", label: "I have (or can get) the access listed under Prerequisites" },
    { id: "intake", label: "I filled in the business details below" },
    { id: "export_or_auth", label: g.method === "export" || g.method === "file" ? "I can export the reports listed" : "I'm ready for the setup call to grant access" },
    { id: "no_secrets", label: "I understand passwords and secrets are never typed into Kaivaryn forms" },
    { id: "ladder", label: "I understand ticking these boxes does not mark the system connected" },
  ];
}

/** Resolve the full guide for a catalog key. Returns null for unknown keys. */
export function getGuide(key: string): IntegrationGuide | null {
  if (!isCatalogKey(key)) return null;
  const vendor = BY_KEY.get(key) ?? genericFor(key);
  if (!vendor) return null;
  const sys = catalogSystem(key)!;
  const fields = [...INTAKE_FIELDS[vendor.intake], ...(vendor.extraIntake ?? [])];
  return {
    ...vendor,
    name: sys.name,
    vendorSpecific: BY_KEY.has(key),
    methodLabel: METHOD_LABEL[vendor.method],
    kaivarynDoes: KAIVARYN_DOES[vendor.method],
    verification: [...VERIFICATION, LADDER_NOTE],
    intakeFields: fields,
    checklist: checklistFor(vendor),
  };
}

/** Every catalog key must resolve to a guide. */
export function allGuideKeys(): string[] {
  return ALL_SYSTEMS.map((s) => s.key);
}

export function vendorSpecificKeys(): string[] {
  return VENDOR.map((g) => g.key);
}

export { BY_KEY as VENDOR_GUIDES, CONFIRM, METHOD_LABEL, LADDER_NOTE };
export type { IntegrationGuide, VendorGuide };
