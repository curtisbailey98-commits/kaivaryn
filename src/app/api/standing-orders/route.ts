import { withOpCtx, readJson } from "@/lib/operate/api";
import { listStandingOrders, createStandingOrder, createAutomationFromPrompt, createAutomation, type AutomationAction, type AutomationCondition } from "@/lib/operate";

export const dynamic = "force-dynamic";

export async function GET() {
  return withOpCtx(async (ctx) => ({ standingOrders: await listStandingOrders(ctx) }));
}

/**
 * POST { prompt }                         → parse + save (refuses prompts with unresolved parts; preview first via /preview)
 * POST { schedule, timezone, actions, … } → save an explicit automation spec (the editable form)
 * POST { directive, cadence? }            → legacy standing order
 */
export async function POST(req: Request) {
  return withOpCtx(async (ctx) => {
    const b = await readJson(req);
    if (typeof b.prompt === "string" && !b.schedule) {
      return { standingOrder: await createAutomationFromPrompt(ctx, b.prompt, { title: b.title ? String(b.title) : null }) };
    }
    if (b.schedule && Array.isArray(b.actions)) {
      return {
        standingOrder: await createAutomation(ctx, {
          schedule: b.schedule,
          timezone: b.timezone ? String(b.timezone) : null,
          actions: b.actions as AutomationAction[],
          condition: (b.condition as AutomationCondition | null) ?? null,
          title: b.title ? String(b.title) : null,
          prompt: typeof b.prompt === "string" ? b.prompt : null,
        }),
      };
    }
    const order = await createStandingOrder(ctx, {
      directive: String(b.directive || ""),
      cadence: b.cadence ? String(b.cadence) : null,
      title: b.title ? String(b.title) : undefined,
      playbookId: b.playbookId ? String(b.playbookId) : null,
      kind: b.playbookId ? "PLAYBOOK" : undefined,
    });
    return { standingOrder: order };
  });
}
