"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { issueInboundToken, revokeInboundToken } from "@/lib/integrations/inbound";
import { normalizeSheetUrl, fetchSheetCsv } from "@/lib/integrations/sheets";
import { runTemplateImport } from "@/lib/integrations/ingest";
import { getTemplate, parseDelimited } from "@/lib/integrations/templates";

function back(kind: "ok" | "error", msg: string, anchor = "") {
  return `/app/integrations?${kind}=1&msg=${encodeURIComponent(msg.slice(0, 240))}${anchor}`;
}
function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export type IssueKeyState = { token?: string; hint?: string; error?: string };

/** Issue or rotate the inbound key. The plaintext key is returned once to the client and never stored. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function issueInboundKeyAction(_prev: IssueKeyState, _formData: FormData): Promise<IssueKeyState> {
  try {
    const ctx = await requirePermission("manage_settings");
    assertOrgId(ctx.organizationId);
    const { token, hint } = await issueInboundToken(ctx.organizationId, ctx.user.id);
    revalidatePath("/app/integrations");
    return { token, hint };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function revokeInboundKeyAction() {
  let target: string;
  try {
    const ctx = await requirePermission("manage_settings");
    assertOrgId(ctx.organizationId);
    await revokeInboundToken(ctx.organizationId, ctx.user.id);
    target = back("ok", "Inbound key revoked — pushes with the old key are now rejected", "#inbound");
  } catch (e) {
    target = back("error", errMsg(e), "#inbound");
  }
  revalidatePath("/app/integrations");
  redirect(target);
}

async function syncSheet(organizationId: string, userId: string, url: string, templateSlug: string) {
  const norm = normalizeSheetUrl(url);
  if (!norm.ok) throw new Error(norm.error);
  const tpl = getTemplate(templateSlug);
  if (!tpl) throw new Error("Pick what the sheet contains.");
  await prisma.integrationConnection.upsert({
    where: { organizationId_provider: { organizationId, provider: "google_sheets" } },
    update: { configJson: JSON.stringify({ url: norm.url, template: tpl.slug }) },
    create: { organizationId, provider: "google_sheets", displayName: "Google Sheets (published CSV)", status: "AVAILABLE", configJson: JSON.stringify({ url: norm.url, template: tpl.slug }) },
  });
  try {
    const text = await fetchSheetCsv(norm.url);
    const { rows } = parseDelimited(text);
    if (!rows.length) throw new Error("The sheet has a header row but no data rows.");
    const r = await runTemplateImport({ organizationId, userId, templateSlug: tpl.slug, rows, source: "GOOGLE_SHEETS", fileName: `Google Sheet · ${tpl.name}` });
    return r;
  } catch (e) {
    await prisma.integrationConnection.updateMany({ where: { organizationId, provider: "google_sheets" }, data: { errorMessage: errMsg(e).slice(0, 300) } });
    throw e;
  }
}

export async function importSheetAction(formData: FormData) {
  let target: string;
  try {
    const ctx = await requirePermission("import");
    assertOrgId(ctx.organizationId);
    const r = await syncSheet(ctx.organizationId, ctx.user.id, String(formData.get("url") || ""), String(formData.get("template") || ""));
    target = back(r.errors.length && !r.created ? "error" : "ok", `Sheet imported: ${r.created} new · ${r.duplicates} already imported · ${r.skipped} skipped · ${r.errors.length} errors`, "#sheets");
  } catch (e) {
    target = back("error", errMsg(e), "#sheets");
  }
  revalidatePath("/app/integrations");
  revalidatePath("/app/imports");
  redirect(target);
}

export async function resyncSheetAction() {
  let target: string;
  try {
    const ctx = await requirePermission("import");
    assertOrgId(ctx.organizationId);
    const conn = await prisma.integrationConnection.findUnique({ where: { organizationId_provider: { organizationId: ctx.organizationId, provider: "google_sheets" } } });
    const cfg = conn?.configJson ? (JSON.parse(conn.configJson) as { url?: string; template?: string }) : {};
    if (!cfg.url || !cfg.template) throw new Error("No sheet linked yet.");
    const r = await syncSheet(ctx.organizationId, ctx.user.id, cfg.url, cfg.template);
    target = back("ok", `Re-synced: ${r.created} new · ${r.duplicates} already imported · ${r.skipped} skipped · ${r.errors.length} errors`, "#sheets");
  } catch (e) {
    target = back("error", errMsg(e), "#sheets");
  }
  revalidatePath("/app/integrations");
  redirect(target);
}

export async function disconnectSheetAction() {
  let target: string;
  try {
    const ctx = await requirePermission("import");
    assertOrgId(ctx.organizationId);
    const n = await prisma.integrationConnection.deleteMany({ where: { organizationId: ctx.organizationId, provider: "google_sheets" } });
    if (n.count) await writeAudit({ organizationId: ctx.organizationId, actorId: ctx.user.id, action: "google_sheets.unlinked", entityType: "IntegrationConnection" });
    target = back("ok", "Sheet unlinked. Records already imported stay in your workspace.", "#sheets");
  } catch (e) {
    target = back("error", errMsg(e), "#sheets");
  }
  revalidatePath("/app/integrations");
  redirect(target);
}

import { saveSystemSetup } from "@/lib/integrations/setup-store";
import { requireOrgAccess } from "@/lib/tenant";

/** Save business intake + checklist for one selected system. Never marks it connected. */
export async function saveSystemSetupAction(formData: FormData) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const key = String(formData.get("systemKey") || "").trim();
  const intake: Record<string, string> = {};
  for (const [k, v] of Array.from(formData.entries())) {
    if (k.startsWith("intake.")) intake[k.slice(7)] = String(v);
  }
  const checklist = formData.getAll("checklist[]").map(String);
  const result = await saveSystemSetup({
    organizationId: ctx.organizationId!,
    userId: ctx.user.id,
    role: ctx.effectiveRole,
    key,
    intake,
    checklist,
  });
  if (!result.ok) {
    redirect(back("error", result.error));
  }
  const note = result.rejected?.length
    ? `Saved ${key} setup. Skipped ${result.rejected.length} field(s) that looked like secrets — never paste passwords or API keys here.`
    : `Saved setup notes for ${key}. Checklist progress does not mark this system connected.`;
  revalidatePath("/app/integrations");
  revalidatePath("/app/onboarding");
  redirect(back("ok", note, `#system-${key}`));
}
