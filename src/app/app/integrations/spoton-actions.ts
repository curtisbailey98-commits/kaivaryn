"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, assertOrgId } from "@/lib/tenant";
import { runSpotOnImport } from "@/lib/integrations/spoton/import";
import { runDetectionEngines } from "@/lib/detection";

const RETURN_PATHS = new Set(["/app/integrations", "/app/imports"]);

/** Import a SpotOn sales export (CSV text from the upload form), then refresh the estimates it feeds. */
export async function importSpotOnAction(formData: FormData) {
  const back = RETURN_PATHS.has(String(formData.get("returnTo") || "")) ? String(formData.get("returnTo")) : "/app/integrations";
  let target: string;
  try {
    const ctx = await requirePermission("import");
    assertOrgId(ctx.organizationId);
    const text = String(formData.get("csv") || "");
    if (!text.trim()) throw new Error("Choose your SpotOn CSV export first.");
    let mapping: Record<string, string> = {};
    try { mapping = JSON.parse(String(formData.get("mapping") || "{}")); } catch { mapping = {}; }
    const r = await runSpotOnImport({ organizationId: ctx.organizationId, userId: ctx.user.id, text, mapping, fileName: String(formData.get("fileName") || "") || "SpotOn sales export", source: "CSV_UPLOAD" });
    let signals = "";
    if (r.created + r.updated > 0) {
      try {
        const d = await runDetectionEngines(ctx.organizationId);
        const fired = d.rulesFired.filter((x) => x.startsWith("spoton_"));
        signals = fired.length ? ` · ${fired.length} estimate${fired.length === 1 ? "" : "s"} checked in Revenue Recovery` : "";
      } catch {
        signals = "";
      }
    }
    const failed = r.created + r.updated + r.unchanged === 0;
    const msg = failed
      ? `SpotOn import: nothing imported. ${r.errors[0]?.error ?? "Check the file."}`
      : `SpotOn import (${r.granularity === "check" ? "one row per check" : "one row per day"}): ${r.created} new · ${r.updated} updated · ${r.unchanged} already up to date · ${r.skipped} skipped · ${r.errors.length} errors${signals}`;
    target = `${back}?${failed ? "error" : "ok"}=1&msg=${encodeURIComponent(msg.slice(0, 280))}#spoton`;
  } catch (e) {
    target = `${back}?error=1&msg=${encodeURIComponent((e instanceof Error ? e.message : String(e)).slice(0, 240))}#spoton`;
  }
  revalidatePath("/app/integrations");
  revalidatePath("/app/imports");
  revalidatePath("/app/revenue");
  revalidatePath("/app");
  redirect(target);
}
