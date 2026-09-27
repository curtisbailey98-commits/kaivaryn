"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireExecutive, setActiveDashboard } from "@/lib/executive/access";
import { manufactureAgent, decideFoundryApproval, runDeployedAgent } from "@/lib/chief/foundry";
import { prisma } from "@/lib/prisma";
import type { ExecutiveDashboard } from "@/lib/enums";

export async function switchExecutiveDashboard(formData: FormData) {
  const exec = await requireExecutive("switch_executive_dashboard");
  const dashboard = String(formData.get("dashboard") || "") as ExecutiveDashboard;
  if (dashboard !== "CEO" && dashboard !== "CSEO") {
    throw new Error("Invalid dashboard");
  }
  await setActiveDashboard(exec.user.id, exec.platformRole, dashboard);
  revalidatePath("/executive");
  redirect(dashboard === "CEO" ? "/executive/ceo" : "/executive/cseo");
}

export async function instructChief(formData: FormData) {
  const exec = await requireExecutive("chief_foundry");
  const instruction = String(formData.get("instruction") || "").trim();
  if (!instruction || instruction.length < 8) {
    redirect("/executive/chief?error=instruction_required");
  }
  const result = await manufactureAgent({
    instruction,
    requesterId: exec.user.id,
    requesterRole: exec.platformRole,
  });
  revalidatePath("/executive");
  redirect(`/executive/chief?job=${result.jobId}&status=${result.status}`);
}

export async function decideChiefApproval(formData: FormData) {
  const exec = await requireExecutive("chief_approve");
  const approvalId = String(formData.get("approvalId") || "");
  const decision = String(formData.get("decision") || "") as "APPROVED" | "REJECTED";
  const note = String(formData.get("note") || "");
  if (!approvalId || (decision !== "APPROVED" && decision !== "REJECTED")) {
    redirect("/executive/chief?error=bad_approval");
  }
  const result = await decideFoundryApproval({
    approvalId,
    deciderId: exec.user.id,
    deciderRole: exec.platformRole,
    decision,
    note: note || undefined,
  });
  revalidatePath("/executive");
  if (!result.ok) {
    redirect(`/executive/chief?error=${encodeURIComponent(result.error || "denied")}`);
  }
  redirect(`/executive/chief?ok=1&msg=${encodeURIComponent(decision === "APPROVED" ? "Deployed" : "Rejected")}`);
}

export async function runChiefAgent(formData: FormData) {
  const exec = await requireExecutive("chief_foundry");
  const agentId = String(formData.get("agentId") || "");
  if (!agentId) redirect("/executive/chief?error=agent_required");
  const result = await runDeployedAgent({ agentId, actorId: exec.user.id, input: {} });
  revalidatePath("/executive");
  if (!result.ok) {
    redirect(`/executive/chief?error=${encodeURIComponent(result.error || "run_failed")}`);
  }
  redirect(`/executive/chief?ok=1&msg=${encodeURIComponent("Execution " + result.executionId)}`);
}

export async function submitSecuritySpec(formData: FormData) {
  const exec = await requireExecutive("security_intake");
  const title = String(formData.get("title") || "").trim();
  if (!title) redirect("/executive/chief/intake?error=title_required");

  const responsibilities = String(formData.get("responsibilities") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const capabilities = String(formData.get("capabilities") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const policies = String(formData.get("policies") || "{}");
  const technicalReqs = String(formData.get("technicalReqs") || "{}");
  const toolPermissions = String(formData.get("toolPermissions") || "[]");
  const integrations = String(formData.get("integrations") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const monitoring = String(formData.get("monitoring") || "{}");
  const evals = String(formData.get("evals") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const notes = String(formData.get("notes") || "");

  const spec = await prisma.securityAgentSpec.create({
    data: {
      title,
      submittedById: exec.user.id,
      status: "SUBMITTED",
      responsibilitiesJson: JSON.stringify(responsibilities),
      capabilitiesJson: JSON.stringify(capabilities),
      policiesJson: policies,
      technicalReqsJson: technicalReqs,
      toolPermissionsJson: toolPermissions,
      integrationsJson: JSON.stringify(integrations),
      monitoringJson: monitoring,
      evalsJson: JSON.stringify(evals),
      notes: notes || null,
    },
  });

  await prisma.execAuditEvent.create({
    data: {
      actorId: exec.user.id,
      action: "security_spec.submitted",
      dashboard: "CSEO",
      entityType: "SecurityAgentSpec",
      entityId: spec.id,
    },
  });

  revalidatePath("/executive/chief/intake");
  redirect(`/executive/chief/intake?ok=1&id=${spec.id}`);
}
