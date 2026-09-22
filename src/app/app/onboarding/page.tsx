import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ONBOARDING_STEPS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: { from?: string } }) {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);

  let progress = await prisma.onboardingProgress.findUnique({
    where: {
      organizationId_userId: { organizationId: ctx.organizationId, userId: ctx.user.id },
    },
  });
  if (!progress) {
    progress = await prisma.onboardingProgress.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.user.id,
        currentStep: 0,
        completedSteps: "[]",
      },
    });
  }

  const completed: string[] = JSON.parse(progress.completedSteps || "[]");
  const step = ONBOARDING_STEPS[progress.currentStep] ?? ONBOARDING_STEPS[0];

  async function advance() {
    "use server";
    const ctx2 = await requireOrgAccess();
    assertOrgId(ctx2.organizationId);
    const p = await prisma.onboardingProgress.findUnique({
      where: { organizationId_userId: { organizationId: ctx2.organizationId, userId: ctx2.user.id } },
    });
    if (!p) return;
    const done: string[] = JSON.parse(p.completedSteps || "[]");
    const cur = ONBOARDING_STEPS[p.currentStep];
    if (cur && !done.includes(cur.id)) done.push(cur.id);
    const next = Math.min(p.currentStep + 1, ONBOARDING_STEPS.length - 1);
    await prisma.onboardingProgress.update({
      where: { id: p.id },
      data: {
        currentStep: next,
        completedSteps: JSON.stringify(done),
        completedAt: next >= ONBOARDING_STEPS.length - 1 ? new Date() : null,
      },
    });
    revalidatePath("/app/onboarding");
  }

  const completion = Math.round((completed.length / ONBOARDING_STEPS.length) * 100);
  const fromPayment = searchParams?.from === "payment";
  return (
    <div className="max-w-3xl">
      {fromPayment ? <div className="si-glass mb-6 border-amber-500/30 p-4"><p className="si-label text-amber-400">Welcome from checkout</p><p className="mt-2 text-sm text-neutral-300">Your payment handoff brought you here. Finish the activation checklist below; progress is saved per user and organization.</p></div> : null}
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="si-label text-amber-500">Activation</p><h1 className="mt-1 text-2xl font-semibold">Make the workspace yours</h1><p className="mt-2 text-sm text-neutral-400">A short, resumable setup for your organization and operating priorities.</p></div><Badge tone={progress.completedAt ? "success" : "warning"}>{progress.completedAt ? "Ready" : `${completion}% complete`}</Badge></div>
      <div className="mt-6 h-2 overflow-hidden rounded-full bg-neutral-900"><div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${Math.max(completion, progress.completedAt ? 100 : 8)}%` }} /></div>
      <div className="mt-8 grid gap-3 sm:grid-cols-5">{ONBOARDING_STEPS.map((s, i) => <div key={s.id} className={`rounded-lg border p-3 ${completed.includes(s.id) ? "border-emerald-500/30 bg-emerald-500/[0.06]" : i === progress.currentStep ? "border-amber-500/40 bg-amber-500/[0.06]" : "border-neutral-800 bg-neutral-950"}`}><p className="font-mono text-[10px] text-neutral-500">{String(i + 1).padStart(2, "0")}</p><p className="mt-2 text-xs font-medium text-white">{s.title}</p>{completed.includes(s.id) ? <p className="mt-1 text-[10px] text-emerald-400">Complete</p> : null}</div>)}</div>
      <div className="si-panel mt-8 p-6"><p className="si-label">Current step</p><h2 className="mt-2 text-xl font-semibold">{step.title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-neutral-400">{step.description}. We will keep this simple and leave you with a clear next move.</p>{progress.completedAt ? <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-emerald-400"><span>Activation complete.</span><Link href="/app" className="rounded-md bg-amber-500 px-3 py-2 font-semibold text-neutral-950">Enter command center →</Link></div> : <form action={advance} className="mt-6"><Button type="submit">{progress.currentStep === ONBOARDING_STEPS.length - 1 ? "Finish activation" : "Save and continue"}</Button></form>}</div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3"><Link href="/app/integrations" className="rounded-lg border border-neutral-800 p-4 text-sm text-neutral-300 transition hover:border-neutral-600 hover:text-white">Review integrations <span className="float-right text-amber-400">→</span></Link><Link href="/app" className="rounded-lg border border-neutral-800 p-4 text-sm text-neutral-300 transition hover:border-neutral-600 hover:text-white">Preview command center <span className="float-right text-amber-400">→</span></Link><Link href="/contact" className="rounded-lg border border-neutral-800 p-4 text-sm text-neutral-300 transition hover:border-neutral-600 hover:text-white">Talk to Kaivaryn <span className="float-right text-amber-400">→</span></Link></div>
    </div>
  );
}
