import Link from "next/link";
import { requireOrgAccess } from "@/lib/tenant";
import { opCtxFromSession, listPlaybooks, listRuns, describeStep } from "@/lib/operate";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RunStatusBadge } from "@/components/operate/route-badge";
import { formatDate } from "@/lib/utils";
import { can } from "@/lib/rbac";
import { runPlaybookAction, savePlaybookAction, deletePlaybookAction } from "../operate-actions";
import { getIndustryContext, getSelectedSystems } from "@/lib/industry/context";
import { RestaurantPlaybooksPanel } from "@/components/industry/restaurant-playbooks-panel";
import { RESTAURANT_TEMPLATE_PREFIX } from "@/lib/industry/restaurant-playbooks";
import { TrendingUp, Settings2, Layers, ShieldCheck, FileText, HeartPulse } from "lucide-react";

export const metadata = { title: "Playbooks" };

export const dynamic = "force-dynamic";

const PRODUCT_META: Record<string, { label: string; icon: typeof TrendingUp; tone: string }> = {
  REVENUE_RECOVERY: { label: "Revenue Recovery", icon: TrendingUp, tone: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
  OPERATIONS_EFFICIENCY: { label: "Operations Efficiency", icon: Settings2, tone: "text-sky-300 border-sky-500/30 bg-sky-500/10" },
  BOTH: { label: "Revenue + Operations", icon: Layers, tone: "text-violet-300 border-violet-500/30 bg-violet-500/10" },
};
const CATEGORY_ICON: Record<string, typeof TrendingUp> = { ANALYSIS: Layers, GOVERNANCE: ShieldCheck, BRIEFING: FileText, HEALTH: HeartPulse };

export default async function PlaybooksPage() {
  const session = await requireOrgAccess();
  const ctx = opCtxFromSession(session);
  const [playbooks, runs, industry, systems] = await Promise.all([
    listPlaybooks(ctx),
    listRuns(ctx, { take: 60 }),
    getIndustryContext(session.organizationId, session.user.id),
    getSelectedSystems(session.organizationId),
  ]);
  const canRun = can(ctx.role, "run_intelligence");
  const canWrite = can(ctx.role, "write");
  const lastRunFor = (id: string) => runs.find((r) => r.sourceId === id);
  const ownedRestaurantSlugs = new Set(
    playbooks
      .filter((p) => (p.summary || "").startsWith(RESTAURANT_TEMPLATE_PREFIX) || String(p.slug || "").startsWith("restaurant-"))
      .flatMap((p) => [String(p.slug || ""), p.name.toLowerCase()].filter(Boolean)),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Playbooks"
        title="Reusable plays for revenue and operations"
        description="Each playbook is an ordered set of steps — detection, nine-step analysis, answers, owned tasks, approval gates, and briefings. Running one creates a recorded run. Governance plays pause for a human decision before they continue."
      />

      {industry.isRestaurant ? (
        <RestaurantPlaybooksPanel selectedSystems={systems.selected} ownedSlugs={ownedRestaurantSlugs} canWrite={canWrite} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {playbooks.map((p) => {
          const meta = PRODUCT_META[p.product] ?? PRODUCT_META.BOTH;
          const Icon = meta.icon;
          const CatIcon = CATEGORY_ICON[p.category] ?? Layers;
          const last = lastRunFor(p.id);
          return (
            <Card key={p.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}><Icon className="h-3 w-3" />{meta.label}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-neutral-500"><CatIcon className="h-3 w-3" />{p.isSystem ? p.category.toLowerCase() : "saved"}</span>
                </div>
                <CardTitle className="mt-3 text-base">{p.name}</CardTitle>
                <CardDescription className="leading-5">{p.summary}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ol className="space-y-1.5 text-xs text-neutral-400">
                  {p.steps.map((s, i) => (
                    <li key={i} className="flex gap-2"><span className="font-mono text-[10px] text-amber-500/80">{String(i + 1).padStart(2, "0")}</span>{describeStep(s)}</li>
                  ))}
                </ol>
                <div className="mt-auto pt-4">
                  <p className="text-[11px] text-neutral-600">
                    {p.runCount} run{p.runCount === 1 ? "" : "s"}{p.lastRunAt ? ` · last ${formatDate(p.lastRunAt)}` : ""}
                    {last ? <> · <Link href={`/app/automations?run=${last.id}`} className="text-amber-400"><RunStatusBadge status={last.status} /></Link></> : null}
                  </p>
                  <div className="mt-3 flex gap-2">
                    {canRun ? (
                      <form action={runPlaybookAction} className="flex-1">
                        <input type="hidden" name="playbookId" value={p.id} />
                        <Button type="submit" size="sm" className="w-full">Run playbook</Button>
                      </form>
                    ) : null}
                    {canWrite && !p.isSystem ? (
                      <form action={deletePlaybookAction.bind(null, p.id)}><Button type="submit" size="sm" variant="ghost" className="text-red-300">Delete</Button></form>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Save a playbook</CardTitle>
          <CardDescription>
            Write steps separated by “then”. Recognized: <span className="text-neutral-300">detect</span>, <span className="text-neutral-300">analyze …</span>, <span className="text-neutral-300">digest</span>, <span className="text-neutral-300">recall</span>, <span className="text-neutral-300">health</span>, <span className="text-neutral-300">task: …</span>, <span className="text-neutral-300">approve …</span>, or a question. Parsing is rule-based.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canWrite ? (
            <form action={savePlaybookAction} className="grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
              <label className="text-xs text-neutral-400">Name<input name="name" required placeholder="Month-end billing check" className="mt-1 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm" /></label>
              <label className="text-xs text-neutral-400">Product
                <select name="product" defaultValue="BOTH" className="mt-1 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm">
                  <option value="REVENUE_RECOVERY">Revenue Recovery</option>
                  <option value="OPERATIONS_EFFICIENCY">Operations Efficiency</option>
                  <option value="BOTH">Both</option>
                </select>
              </label>
              <label className="text-xs text-neutral-400">Steps<input name="directive" required placeholder="detect then analyze billing leakage then task: review credits then approve credit memo plan then digest" className="mt-1 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm" /></label>
              <Button type="submit">Save</Button>
            </form>
          ) : (
            <p className="text-sm text-neutral-500">Saving playbooks needs Analyst or above.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
