"use server";

/**
 * Server actions for the operating layer (Command, Inbox, Automations, Playbooks, Initiatives, Operate).
 * Every action derives tenant context from the session — never from form input.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { safeReturnPath } from "@/lib/operate/paths";
import {
  opCtxFromSession,
  executeCommand,
  buildDigest,
  buildRecall,
  markBriefingRead,
  createStandingOrder,
  setStandingOrderEnabled,
  runStandingOrder,
  deleteStandingOrder,
  runDueStandingOrders,
  runPlaybook,
  savePlaybook,
  deletePlaybook,
  createInitiative,
  linkToInitiative,
  setInitiativeStatus,
  runHealthCheck,
  cancelRun,
  type LinkType,
} from "@/lib/operate";

async function ctx() {
  return opCtxFromSession(await requireOrgAccess());
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function withMsg(path: string, kind: "ok" | "error", msg: string) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${kind}=1&msg=${encodeURIComponent(msg.slice(0, 240))}`;
}

export async function runCommandAction(formData: FormData) {
  const text = String(formData.get("text") || "").trim();
  const back = safeReturnPath(formData.get("back"), "/app/command");
  if (!text) redirect(withMsg(back, "error", "Type an ask, e.g. “Analyze revenue leakage”"));
  let target = "/app/command";
  try {
    const c = await ctx();
    const res = await executeCommand(c, text, { idempotencyKey: String(formData.get("idempotencyKey") || "") || null });
    target = `/app/command?c=${res.id}`;
  } catch (e) {
    target = withMsg("/app/command", "error", errMsg(e));
  }
  revalidatePath("/app", "layout");
  redirect(target);
}

export async function generateBriefingAction(formData: FormData) {
  const kind = String(formData.get("kind") || "DIGEST");
  let target = "/app/inbox";
  try {
    const c = await ctx();
    const res = kind === "RECALL" ? await buildRecall(c, "MANUAL") : await buildDigest(c, "MANUAL");
    target = `/app/inbox?briefing=${res.briefing.id}`;
  } catch (e) {
    target = withMsg("/app/inbox", "error", errMsg(e));
  }
  revalidatePath("/app/inbox");
  redirect(target);
}

export async function markBriefingReadAction(id: string) {
  const c = await ctx();
  await markBriefingRead(c, id);
  revalidatePath("/app/inbox");
}

export async function markAllInboxNotificationsRead() {
  const c = await ctx();
  if (c.userId) {
    await prisma.notification.updateMany({ where: { organizationId: c.organizationId, userId: c.userId, readAt: null }, data: { readAt: new Date() } });
  }
  await prisma.opBriefing.updateMany({ where: { organizationId: c.organizationId, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/app/inbox");
  redirect(withMsg("/app/inbox", "ok", "Notifications and briefings marked read"));
}

export async function createStandingOrderAction(formData: FormData) {
  let target: string;
  try {
    const c = await ctx();
    const playbookId = String(formData.get("playbookId") || "") || null;
    const directive = String(formData.get("directive") || "").trim() || (playbookId ? "run playbook" : "");
    const order = await createStandingOrder(c, {
      directive,
      cadence: String(formData.get("cadence") || "DAILY"),
      playbookId,
      kind: playbookId ? "PLAYBOOK" : undefined,
    });
    target = withMsg("/app/automations", "ok", `Standing order created: ${order.title}`);
  } catch (e) {
    target = withMsg("/app/automations", "error", errMsg(e));
  }
  revalidatePath("/app/automations");
  redirect(target);
}

export async function toggleStandingOrderAction(id: string, enabled: boolean) {
  let target = "/app/automations";
  try {
    await setStandingOrderEnabled(await ctx(), id, enabled);
    target = withMsg(target, "ok", enabled ? "Standing order resumed" : "Standing order paused");
  } catch (e) {
    target = withMsg(target, "error", errMsg(e));
  }
  revalidatePath("/app/automations");
  redirect(target);
}

export async function runStandingOrderAction(id: string) {
  let target = "/app/automations";
  try {
    const o = await runStandingOrder(await ctx(), id);
    const runId = (JSON.parse(o.lastResultJson || "{}") as { runId?: string }).runId;
    target = withMsg(runId ? `/app/automations?run=${runId}` : target, o.lastStatus === "FAILED" ? "error" : "ok", `Ran “${o.title}”: ${o.lastStatus}`);
  } catch (e) {
    target = withMsg(target, "error", errMsg(e));
  }
  revalidatePath("/app/automations");
  redirect(target);
}

export async function deleteStandingOrderAction(id: string) {
  let target = "/app/automations";
  try {
    await deleteStandingOrder(await ctx(), id);
    target = withMsg(target, "ok", "Standing order removed");
  } catch (e) {
    target = withMsg(target, "error", errMsg(e));
  }
  revalidatePath("/app/automations");
  redirect(target);
}

export async function runDueAction() {
  let target = "/app/automations";
  try {
    const ran = await runDueStandingOrders(await ctx());
    target = withMsg(target, "ok", ran.length ? `Ran ${ran.length} due standing order${ran.length === 1 ? "" : "s"}` : "Nothing is due right now");
  } catch (e) {
    target = withMsg(target, "error", errMsg(e));
  }
  revalidatePath("/app/automations");
  redirect(target);
}

export async function runPlaybookAction(formData: FormData) {
  const id = String(formData.get("playbookId") || "");
  const initiativeId = String(formData.get("initiativeId") || "") || null;
  const back = safeReturnPath(formData.get("back"), "/app/playbooks");
  let target = back;
  try {
    const { playbook, run } = await runPlaybook(await ctx(), id, { initiativeId });
    target = withMsg(`/app/automations?run=${run.id}`, run.status === "FAILED" ? "error" : "ok", `${playbook.name}: ${run.status.replace(/_/g, " ").toLowerCase()}`);
  } catch (e) {
    target = withMsg(back, "error", errMsg(e));
  }
  revalidatePath("/app/playbooks");
  revalidatePath("/app/automations");
  redirect(target);
}

export async function savePlaybookAction(formData: FormData) {
  let target = "/app/playbooks";
  try {
    const pb = await savePlaybook(await ctx(), {
      name: String(formData.get("name") || ""),
      directive: String(formData.get("directive") || ""),
      product: String(formData.get("product") || "BOTH"),
    });
    target = withMsg(target, "ok", `Playbook saved: ${pb.name}`);
  } catch (e) {
    target = withMsg(target, "error", errMsg(e));
  }
  revalidatePath("/app/playbooks");
  redirect(target);
}

export async function deletePlaybookAction(id: string) {
  let target = "/app/playbooks";
  try {
    const n = await deletePlaybook(await ctx(), id);
    target = withMsg(target, n ? "ok" : "error", n ? "Playbook deleted" : "System playbooks cannot be deleted");
  } catch (e) {
    target = withMsg(target, "error", errMsg(e));
  }
  revalidatePath("/app/playbooks");
  redirect(target);
}

export async function createInitiativeAction(formData: FormData) {
  let target = "/app/initiatives";
  try {
    const ini = await createInitiative(await ctx(), {
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      product: String(formData.get("product") || "BOTH"),
    });
    target = withMsg(`/app/initiatives/${ini.id}`, "ok", "Initiative created");
  } catch (e) {
    target = withMsg(target, "error", errMsg(e));
  }
  revalidatePath("/app/initiatives");
  redirect(target);
}

export async function linkInitiativeAction(formData: FormData) {
  const initiativeId = String(formData.get("initiativeId") || "");
  const raw = String(formData.get("target") || ""); // "OPPORTUNITY:<id>"
  const [type, entityId] = raw.split(":");
  let target = `/app/initiatives/${initiativeId}`;
  try {
    await linkToInitiative(await ctx(), initiativeId, (type || "") as LinkType, entityId || "");
    target = withMsg(target, "ok", "Linked to initiative");
  } catch (e) {
    target = withMsg(target, "error", errMsg(e));
  }
  revalidatePath(`/app/initiatives/${initiativeId}`);
  redirect(target);
}

export async function setInitiativeStatusAction(id: string, status: "ACTIVE" | "PAUSED" | "COMPLETED") {
  let target = `/app/initiatives/${id}`;
  try {
    await setInitiativeStatus(await ctx(), id, status);
    target = withMsg(target, "ok", `Initiative ${status.toLowerCase()}`);
  } catch (e) {
    target = withMsg(target, "error", errMsg(e));
  }
  revalidatePath("/app/initiatives");
  redirect(target);
}

export async function runHealthCheckAction() {
  let target = "/app/operate";
  try {
    const h = await runHealthCheck(await ctx(), "MANUAL");
    target = withMsg(target, h.status === "OK" ? "ok" : "error", `Health ${h.status}`);
  } catch (e) {
    target = withMsg(target, "error", errMsg(e));
  }
  revalidatePath("/app/operate");
  redirect(target);
}

export async function cancelRunAction(id: string) {
  let target = `/app/automations?run=${id}`;
  try {
    const n = await cancelRun(await ctx(), id);
    target = withMsg(target, n ? "ok" : "error", n ? "Run cancelled" : "Run is already finished");
  } catch (e) {
    target = withMsg(target, "error", errMsg(e));
  }
  revalidatePath("/app/automations");
  redirect(target);
}
