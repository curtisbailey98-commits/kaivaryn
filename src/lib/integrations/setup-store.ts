/**
 * Per-tenant system setup: intake answers + client checklist, stored in OrgSettings.settingsJson
 * under `systemSetup` (no schema change). Never secrets. Ticking checklist items never marks a
 * system connected — only IntegrationConnection + verification does (see @/lib/industry/states).
 */
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getGuide } from "./guides";
import { sanitizeIntake, isSecretFieldId } from "./guides/intake";

export type SystemSetupEntry = {
  intake: Record<string, string>;
  checklist: string[];
  updatedAt: string;
  updatedBy: string | null;
};

export type SystemSetupMap = Record<string, SystemSetupEntry>;

type SettingsBlob = { systemSetup?: SystemSetupMap; [k: string]: unknown };

function parseSettings(raw: string | null | undefined): SettingsBlob {
  try { return (JSON.parse(raw || "{}") as SettingsBlob) || {}; } catch { return {}; }
}

export async function getSystemSetup(organizationId: string): Promise<SystemSetupMap> {
  const row = await prisma.orgSettings.findUnique({ where: { organizationId }, select: { settingsJson: true } });
  const blob = parseSettings(row?.settingsJson);
  return blob.systemSetup && typeof blob.systemSetup === "object" ? blob.systemSetup : {};
}

export async function getSystemSetupEntry(organizationId: string, key: string): Promise<SystemSetupEntry | null> {
  const map = await getSystemSetup(organizationId);
  return map[key] ?? null;
}

export type SaveSystemSetupInput = {
  organizationId: string;
  userId: string;
  role: string;
  key: string;
  intake?: Record<string, unknown>;
  checklist?: string[];
};

export type SaveSystemSetupResult =
  | { ok: true; entry: SystemSetupEntry; rejected?: string[] }
  | { ok: false; error: string; status: number };

/** Persist intake + checklist for one system. Requires write. Never stores secrets. Never touches connection state. */
export async function saveSystemSetup(input: SaveSystemSetupInput): Promise<SaveSystemSetupResult> {
  if (!input.organizationId) return { ok: false, error: "Organization required", status: 403 };
  if (!can(input.role, "write")) return { ok: false, error: "Requires write access", status: 403 };
  const guide = getGuide(input.key);
  if (!guide) return { ok: false, error: "Unknown system", status: 404 };

  const existing = await getSystemSetupEntry(input.organizationId, input.key);
  let intake = existing?.intake ?? {};
  let rejected: string[] = [];
  if (input.intake) {
    const cleaned = sanitizeIntake(guide.intakeFields, input.intake);
    rejected = cleaned.rejected;
    // Drop any secret-looking field ids even if the guide somehow listed them
    for (const id of Object.keys(cleaned.values)) if (isSecretFieldId(id)) delete cleaned.values[id];
    intake = cleaned.values;
  }
  const allowed = new Set(guide.checklist.map((c) => c.id));
  let checklist = existing?.checklist ?? [];
  if (input.checklist) {
    checklist = input.checklist.map(String).filter((id) => allowed.has(id)).slice(0, 20);
  }
  const entry: SystemSetupEntry = {
    intake,
    checklist,
    updatedAt: new Date().toISOString(),
    updatedBy: input.userId,
  };

  const row = await prisma.orgSettings.findUnique({ where: { organizationId: input.organizationId }, select: { settingsJson: true } });
  const blob = parseSettings(row?.settingsJson);
  const map: SystemSetupMap = { ...(blob.systemSetup || {}) };
  map[input.key] = entry;
  blob.systemSetup = map;
  await prisma.orgSettings.upsert({
    where: { organizationId: input.organizationId },
    update: { settingsJson: JSON.stringify(blob) },
    create: { organizationId: input.organizationId, settingsJson: JSON.stringify(blob) },
  });
  return { ok: true, entry, ...(rejected.length ? { rejected } : {}) };
}

