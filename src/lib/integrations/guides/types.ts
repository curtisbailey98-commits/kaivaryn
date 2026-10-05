/**
 * Integration guide types. A guide is plain-English help for the client, paired with the
 * business-specific intake Kaivaryn needs for that system. Guides never connect anything:
 * a system only becomes "connected" when data actually arrives (see @/lib/industry/states).
 */

/** The vendor's supported way of granting access, as publicly documented. */
export type ConnectionMethod =
  | "oauth" // client approves access in the vendor's own sign-in / authorization screen
  | "api_credentials" // client creates read-only API credentials in the vendor's admin
  | "partner_request" // access is requested through the vendor / account rep; not self-serve
  | "export" // scheduled report or CSV export is the practical path
  | "database" // read-only database / warehouse user created by the client's IT team
  | "file"; // file drop, upload, or manual evidence

export type IntakeKind =
  | "pos" | "delivery" | "reservations" | "labor" | "inventory"
  | "crm" | "accounting" | "payments" | "erp" | "support" | "commerce" | "subscriptions"
  | "work" | "data" | "collab" | "hr" | "payroll" | "flexible";

export type IntakeField = {
  id: string;
  label: string;
  type: "text" | "number" | "textarea" | "select";
  help?: string;
  placeholder?: string;
  options?: string[];
};

/** Vendor-specific content, authored per system in the category files. */
export type VendorGuide = {
  key: string;
  method: ConnectionMethod;
  /** One plain-English sentence on how access is granted. */
  methodNote: string;
  prerequisites: string[];
  steps: string[];
  share: string[];
  exportFallback: string[];
  /** Public vendor documentation this guide is based on (also listed in guide-sources.md). */
  sourceUrl: string;
  intake: IntakeKind;
  extraIntake?: IntakeField[];
};

/** A resolved guide ready to render. */
export type IntegrationGuide = VendorGuide & {
  name: string;
  vendorSpecific: boolean;
  methodLabel: string;
  kaivarynDoes: string[];
  verification: string[];
  intakeFields: IntakeField[];
  checklist: Array<{ id: string; label: string }>;
};
