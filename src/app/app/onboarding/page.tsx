import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ONBOARDING_STEPS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
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

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Onboarding</h1>
      <p className="mt-2 text-sm text-neutral-400">Resumeable wizard — progress saved per user/org.</p>
      <ol className="mt-6 space-y-2">
        {ONBOARDING_STEPS.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 text-sm">
            <span className="font-mono text-neutral-500">{String(i + 1).padStart(2, "0")}</span>
            <span className={i === progress!.currentStep ? "text-amber-400" : "text-neutral-300"}>{s.title}</span>
            {completed.includes(s.id) ? <Badge tone="success">done</Badge> : null}
          </li>
        ))}
      </ol>
      <div className="si-panel mt-8 p-5">
        <p className="si-label">Current step</p>
        <h2 className="mt-2 text-lg font-semibold">{step.title}</h2>
        <p className="mt-1 text-sm text-neutral-400">{step.description}</p>
        {progress.completedAt ? (
          <p className="mt-4 text-sm text-emerald-400">
            Onboarding complete.{" "}
            <Link href="/app" className="underline">Enter command center</Link>
          </p>
        ) : (
          <form action={advance} className="mt-4">
            <Button type="submit">Continue</Button>
          </form>
        )}
      </div>
    </div>
  );
}
