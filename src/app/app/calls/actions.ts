"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { canVoice } from "@/lib/voice/permissions";
import { syncVoiceCalls } from "@/lib/voice/sync";
import { writeAudit } from "@/lib/audit";

/** Sync this tenant's assistants now (ADMIN+). Same idempotent path as the scheduled tick. */
export async function syncCallsNow() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  if (!canVoice(ctx.effectiveRole, "voice.sync")) redirect("/app/calls?error=1&msg=" + encodeURIComponent("An admin or owner can sync calls."));
  const r = await syncVoiceCalls({ tenantId: ctx.organizationId });
  await writeAudit({ organizationId: ctx.organizationId, actorId: ctx.user.id, action: "voice.sync.manual", metadata: { stored: r.stored, created: r.created, skipped: r.skipped, errors: r.errors.length } });
  revalidatePath("/app/calls");
  const msg = !r.configured ? "Voice provider isn't configured." : r.errors.length ? `Synced with ${r.errors.length} issue(s). ${r.created} new call(s).` : `Synced. ${r.created} new call(s), ${r.stored} checked.`;
  redirect(`/app/calls?${r.errors.length || !r.configured ? "error" : "ok"}=1&msg=${encodeURIComponent(msg)}`);
}
