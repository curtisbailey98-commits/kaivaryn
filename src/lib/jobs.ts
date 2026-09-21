/**
 * In-process job runner (free Render — no Redis).
 * Tracks ImportJob / IntelligenceRun status honestly.
 */
import { prisma } from "./prisma";
import { runDetectionEngines } from "./detection";
import { buildIntelligenceBundle } from "./intelligence";

export async function runIntelligenceJob(runId: string) {
  const run = await prisma.intelligenceRun.findUnique({ where: { id: runId } });
  if (!run) return;
  await prisma.intelligenceRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: new Date() },
  });
  try {
    const detection = await runDetectionEngines(run.organizationId);
    const bundle = await buildIntelligenceBundle(run.organizationId, run.product || undefined);
    const findingCount = await prisma.finding.count({
      where: { organizationId: run.organizationId, status: "OPEN" },
    });
    await prisma.intelligenceRun.update({
      where: { id: runId },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        findingCount,
        resultJson: JSON.stringify({ detection, bundle }),
      },
    });
  } catch (e) {
    await prisma.intelligenceRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        resultJson: JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      },
    });
  }
}

export async function enqueueIntelligenceRun(organizationId: string, createdById: string | null, product?: string) {
  const run = await prisma.intelligenceRun.create({
    data: {
      organizationId,
      createdById,
      product: product || null,
      status: "QUEUED",
    },
  });
  // fire-and-forget in-process
  void runIntelligenceJob(run.id);
  return run;
}
