/**
 * Industry context for a workspace, derived from onboarding answers (no schema change).
 * - Organization industry: the most recent answer from a member with Manager role or above.
 * - A viewer's or analyst's own answer only tailors what *they* see; it never sets the org industry.
 * Every query is scoped by organizationId.
 */
import { prisma } from "@/lib/prisma";
import { roleRank } from "@/lib/rbac";
import { INDUSTRY_IDS, isRestaurantSystem } from "./restaurant";
import { savePlaybook } from "@/lib/operate/playbooks";
import { OpError, type OpCtx } from "@/lib/operate/context";
import { restaurantPlaybook, RESTAURANT_TEMPLATE_PREFIX } from "./restaurant-playbooks";

export const ORG_INDUSTRY_MIN_RANK = 30; // MANAGER

export type IndustryContext = {
  industry: string | null;
  restaurantTypes: string[];
  isRestaurant: boolean;
  source: "organization" | "you" | null;
  orgIndustry: string | null;
};

type Answers = { welcome?: { industry?: unknown; restaurantTypes?: unknown }; integrations?: { integrations?: unknown; posOther?: unknown } };
const parse = (s: string | null | undefined): Answers => {
  try { return (JSON.parse(s || "{}") as Answers) || {}; } catch { return {}; }
};
const validIndustry = (v: unknown) => (typeof v === "string" && INDUSTRY_IDS.includes(v) ? v : null);
const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

export async function getIndustryContext(organizationId: string, userId?: string | null): Promise<IndustryContext> {
  const rows = await prisma.onboardingProgress.findMany({ where: { organizationId }, select: { userId: true, dataJson: true, updatedAt: true }, orderBy: { updatedAt: "desc" } });
  const members = rows.length
    ? await prisma.membership.findMany({ where: { organizationId, userId: { in: rows.map((r) => r.userId) } }, select: { userId: true, role: true } })
    : [];
  const rank = new Map(members.map((m) => [m.userId, roleRank(m.role)]));
  let org: { industry: string; types: string[] } | null = null;
  let own: { industry: string; types: string[] } | null = null;
  for (const r of rows) {
    const w = parse(r.dataJson).welcome;
    const industry = validIndustry(w?.industry);
    if (!industry) continue;
    const entry = { industry, types: arr(w?.restaurantTypes) };
    if (!org && (rank.get(r.userId) ?? 0) >= ORG_INDUSTRY_MIN_RANK) org = entry;
    if (userId && r.userId === userId) own = entry;
  }
  const pick = org ?? own;
  return {
    industry: pick?.industry ?? null,
    restaurantTypes: pick?.industry === "restaurant" ? pick.types : [],
    isRestaurant: pick?.industry === "restaurant",
    source: org ? "organization" : own ? "you" : null,
    orgIndustry: org?.industry ?? null,
  };
}

/** Business systems selected during onboarding across this workspace, plus the "Other POS" name if given. */
export async function getSelectedSystems(organizationId: string): Promise<{ selected: string[]; posOther: string | null }> {
  const rows = await prisma.onboardingProgress.findMany({ where: { organizationId }, select: { dataJson: true }, orderBy: { updatedAt: "desc" } });
  const selected = new Set<string>();
  let posOther: string | null = null;
  for (const r of rows) {
    const i = parse(r.dataJson).integrations;
    for (const s of arr(i?.integrations)) selected.add(s);
    if (!posOther && typeof i?.posOther === "string" && i.posOther.trim()) posOther = i.posOther.trim().slice(0, 60);
  }
  return { selected: Array.from(selected), posOther };
}

export const selectedRestaurantSystems = (selected: string[]) => selected.filter(isRestaurantSystem);

/** Copy a restaurant template into this tenant's playbooks (tenant-owned, idempotent by slug). */
export async function addRestaurantPlaybook(ctx: OpCtx, slug: string) {
  const t = restaurantPlaybook(slug);
  if (!t) throw new OpError("not_found", "That restaurant template doesn't exist", 404);
  return savePlaybook(ctx, { name: t.name, product: t.product, summary: `${RESTAURANT_TEMPLATE_PREFIX}${t.looksFor}`, steps: t.steps, slug: t.slug });
}
