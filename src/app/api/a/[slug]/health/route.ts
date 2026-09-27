import { NextResponse } from "next/server";
import { getActiveWebBundle, publicBaseUrl, recordHealthCheck } from "@/lib/chief/deploy-web";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: { slug: string } }) {
  const slug = ctx.params.slug;
  const active = await getActiveWebBundle(slug);
  if (!active) {
    return NextResponse.json(
      {
        status: "DOWN",
        slug,
        message: "No active production web deployment",
        time: new Date().toISOString(),
      },
      { status: 404 }
    );
  }

  const hasHtml = Boolean(active.bundle.files["index.html"]);
  const status = hasHtml ? "OK" : "DEGRADED";
  await recordHealthCheck(active.deploymentId, status).catch(() => undefined);

  const base = publicBaseUrl();
  return NextResponse.json({
    status,
    service: "chief-agent",
    slug,
    runtime: active.bundle.runtime,
    title: active.bundle.title,
    version: active.version,
    deploymentId: active.deploymentId,
    liveUrl: active.liveUrl || `${base}/a/${slug}`,
    healthUrl: `${base}/api/a/${slug}/health`,
    files: Object.keys(active.bundle.files),
    time: new Date().toISOString(),
  });
}
