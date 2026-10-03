/**
 * One-time (idempotent) creation of Kaivaryn's NEW web-only assistants. Viki is never modified.
 *  - "Viki (Web) – Kaivaryn Site": public website assistant (FIXED → Kaivaryn HQ)
 *  - "Viki (Workspace) – Kaivaryn App": in-app assistant with server-side tools (SIGNED_SESSION)
 * Same model (gpt-5-mini) and voice (vapi/Layla) as Viki; server URL = Kaivaryn webhook.
 * Prints only assistant ids (not secret). Reads VAPI_PRIVATE_KEY + VAPI_WEBHOOK_SECRET from env.
 * Run: PUBLIC_APP_URL=https://kaivaryn.onrender.com VAPI_WEBHOOK_SECRET=… npx tsx scripts/voice-provision-kaivaryn.ts
 */
import { createAssistant, getAssistant, updateOwnedAssistant } from "../src/lib/voice/vapi-client";
import { baseAssistantPayload } from "../src/lib/voice/provisioning";
import { buildKaivarynWebPrompt, buildKaivarynWorkspacePrompt } from "../src/lib/voice/prompts";
import { workspaceToolDefinitions } from "../src/lib/voice/tools";
import { protectedAssistantIds } from "../src/lib/voice/constants";

const WEB_NAME = "Viki (Web) – Kaivaryn Site";
const WS_NAME = "Viki (Workspace) – Kaivaryn App";

async function list(): Promise<Array<{ id: string; name?: string }>> {
  const res = await fetch("https://api.vapi.ai/assistant?limit=100", { headers: { authorization: `Bearer ${process.env.VAPI_PRIVATE_KEY}` } });
  if (!res.ok) throw new Error(`list failed ${res.status}`);
  return res.json();
}

async function upsert(name: string, payload: Record<string, unknown>) {
  const existing = (await list()).find((a) => a.name === name);
  if (existing) {
    if (protectedAssistantIds().includes(existing.id)) throw new Error("refusing: protected id");
    await updateOwnedAssistant(existing.id, payload, true);
    return { id: existing.id, created: false };
  }
  try {
    const a = await createAssistant(payload);
    return { id: a.id, created: true };
  } catch (e) {
    if (/analysisPlan/i.test((e as Error).message)) {
      const { analysisPlan: _drop, ...rest } = payload as Record<string, unknown> & { analysisPlan?: unknown };
      void _drop;
      const a = await createAssistant(rest);
      return { id: a.id, created: true, noAnalysis: true };
    }
    throw e;
  }
}

async function main() {
  const vikiBefore = await getAssistant(protectedAssistantIds()[0]!);
  const web = await upsert(WEB_NAME, baseAssistantPayload({
    name: WEB_NAME,
    systemPrompt: buildKaivarynWebPrompt(),
    firstMessage: "Hi, I'm Viki, Kaivaryn's AI assistant. What's happening in your business that brought you here today?",
    voiceId: "Layla",
    voiceSpeed: 1.1,
    analysis: true,
    metadata: { kaivaryn: "web", owner: "kaivaryn-hq" },
  }));
  const ws = await upsert(WS_NAME, baseAssistantPayload({
    name: WS_NAME,
    systemPrompt: buildKaivarynWorkspacePrompt(),
    firstMessage: "Hi {{userName}}, it's Viki. What would you like to know about {{orgName}}?",
    voiceId: "Layla",
    voiceSpeed: 1.1,
    tools: workspaceToolDefinitions(),
    analysis: false,
    metadata: { kaivaryn: "workspace", owner: "kaivaryn-hq" },
  }));
  const vikiAfter = await getAssistant(protectedAssistantIds()[0]!);
  console.log(JSON.stringify({
    web: { id: web.id, created: web.created },
    workspace: { id: ws.id, created: ws.created },
    vikiUnchanged: vikiBefore.server?.url === vikiAfter.server?.url && JSON.stringify(vikiBefore.model) === JSON.stringify(vikiAfter.model),
  }));
}
main().catch((e) => { console.error(String(e.message || e).slice(0, 400)); process.exit(1); });
