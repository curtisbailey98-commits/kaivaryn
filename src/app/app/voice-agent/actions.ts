"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import {
  saveSelfConfig,
  generateFromQuestionnaire,
  submitForReview,
  approveAgent,
  activateAgent,
  pauseAgent,
  setToolLevels,
  getTenantClientAgent,
  VoiceFlowError,
} from "@/lib/voice/agents";
import { provisionClientAgent } from "@/lib/voice/provisioning";
import { canVoice } from "@/lib/voice/permissions";
import { CLIENT_TOOLS } from "@/lib/voice/action-levels";

async function vctx() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  return { tenantId: ctx.organizationId, userId: ctx.user.id, role: ctx.effectiveRole };
}

function done(msg: string, ok = true): never {
  revalidatePath("/app/voice-agent");
  redirect(`/app/voice-agent?${ok ? "ok" : "error"}=1&msg=${encodeURIComponent(msg)}`);
}

async function run(fn: () => Promise<string>) {
  let msg: string;
  try {
    msg = await fn();
  } catch (e) {
    const m = e instanceof VoiceFlowError ? e.message : e instanceof Error && e.message.startsWith("Forbidden") ? "Your role can't do that. Ask an admin or owner." : "Something went wrong. Nothing was changed.";
    done(m, false);
  }
  done(msg);
}

const lines = (v: FormDataEntryValue | null) => String(v || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

export async function generateAction(formData: FormData) {
  const ctx = await vctx();
  await run(async () => {
    await generateFromQuestionnaire(ctx, {
      agentName: String(formData.get("agentName") || ""),
      whatCompanyDoes: String(formData.get("whatCompanyDoes") || "").slice(0, 1500),
      whoCalls: formData.getAll("whoCalls").map(String),
      whatToHandle: formData.getAll("whatToHandle").map(String),
      alwaysHuman: formData.getAll("alwaysHuman").map(String),
      alwaysHumanNotes: String(formData.get("alwaysHumanNotes") || ""),
      hours: String(formData.get("hours") || ""),
      tone: String(formData.get("tone") || "warm_professional"),
      canSchedule: formData.get("canSchedule") === "request_only" ? "request_only" : "none",
      systems: formData.getAll("systems").map(String),
      needsApproval: formData.getAll("needsApproval").map(String),
      restaurantPresets: formData.getAll("restaurantPresets").map(String),
    });
    return "Your recommended voice agent is ready to review.";
  });
}

export async function saveSelfAction(formData: FormData) {
  const ctx = await vctx();
  const tools: Record<string, string> = {};
  for (const t of CLIENT_TOOLS) {
    const v = String(formData.get(`tool_${t.key}`) || "");
    if (v && v !== "OFF") tools[t.key] = v;
  }
  await run(async () => {
    await saveSelfConfig(ctx, {
      name: String(formData.get("name") || ""),
      voice: String(formData.get("voice") || "Layla"),
      tone: String(formData.get("tone") || ""),
      greeting: String(formData.get("greeting") || ""),
      role: String(formData.get("role") || ""),
      responsibilities: lines(formData.get("responsibilities")),
      hours: String(formData.get("hours") || ""),
      afterHoursBehavior: String(formData.get("afterHoursBehavior") || ""),
      escalationRules: lines(formData.get("escalationRules")),
      approvedKnowledge: String(formData.get("approvedKnowledge") || ""),
      phoneConfig: { wantsNumber: formData.get("wantsNumber") === "on", areaCode: String(formData.get("areaCode") || ""), forwardTo: String(formData.get("forwardTo") || "") },
      allowedTools: tools,
      systems: formData.getAll("systems").map(String),
    });
    return "Saved. Review your voice agent below.";
  });
}

export async function toolLevelsAction(formData: FormData) {
  const ctx = await vctx();
  const id = String(formData.get("agentId") || "");
  const tools: Record<string, string> = {};
  for (const t of CLIENT_TOOLS) {
    const v = String(formData.get(`tool_${t.key}`) || "");
    if (v && v !== "OFF") tools[t.key] = v;
  }
  await run(async () => {
    await setToolLevels(ctx, id, tools);
    return "Action levels saved.";
  });
}

export async function provisionAction(formData: FormData) {
  const ctx = await vctx();
  const id = String(formData.get("agentId") || "");
  if (!canVoice(ctx.role, "voice.agent.test")) done("Your role can't create test assistants.", false);
  const agent = await getTenantClientAgent(ctx.tenantId);
  if (!agent || agent.id !== id) done("Agent not found.", false);
  if (agent.status === "active") done("Pause the agent before rebuilding it.", false);
  const r = await provisionClientAgent(agent.id, ctx.userId);
  if (!r.ok) done("The test assistant couldn't be created. Kaivaryn has the error details; nothing went live.", false);
  done("Test assistant ready. Try a test call below — nothing is live to your customers.");
}

export async function submitAction(formData: FormData) {
  const ctx = await vctx();
  await run(async () => {
    await submitForReview(ctx, String(formData.get("agentId") || ""));
    return "Sent for approval. An admin or owner can approve it here or in Approvals.";
  });
}

export async function approveAction(formData: FormData) {
  const ctx = await vctx();
  await run(async () => {
    await approveAgent(ctx, String(formData.get("agentId") || ""));
    return "Approved. It is not live yet — activate it when you're ready.";
  });
}

export async function activateAction(formData: FormData) {
  const ctx = await vctx();
  await run(async () => {
    await activateAgent(ctx, String(formData.get("agentId") || ""), { confirm: formData.get("confirm") === "yes" });
    return "Your voice agent is active.";
  });
}

export async function pauseAction(formData: FormData) {
  const ctx = await vctx();
  await run(async () => {
    await pauseAgent(ctx, String(formData.get("agentId") || ""));
    return "Paused. It stays off until it is re-approved and activated.";
  });
}
