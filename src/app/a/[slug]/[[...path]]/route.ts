import { NextRequest, NextResponse } from "next/server";
import { getActiveWebBundle, recordHealthCheck } from "@/lib/chief/deploy-web";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  map: "application/json; charset=utf-8",
  ico: "image/x-icon",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  woff: "font/woff",
  woff2: "font/woff2",
};

function contentTypeFor(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return MIME[ext] || "application/octet-stream";
}

export async function GET(
  _req: NextRequest,
  ctx: { params: { slug: string; path?: string[] } }
) {
  const slug = ctx.params.slug;
  const parts = ctx.params.path || [];
  const fileName = parts.length === 0 ? "index.html" : parts.join("/");

  // Basic path traversal guard
  if (fileName.includes("..") || fileName.startsWith("/") || fileName.includes("\\")) {
    return new NextResponse("Bad path", { status: 400 });
  }

  const active = await getActiveWebBundle(slug);
  if (!active) {
    return NextResponse.json(
      {
        error: "Agent not found or not live",
        slug,
        hint: "Manufacture + approve a web agent in /executive/chief, or check registry status.",
      },
      { status: 404 }
    );
  }

  const body = active.bundle.files[fileName];
  if (body == null) {
    return NextResponse.json(
      { error: "File not in agent package", slug, file: fileName, available: Object.keys(active.bundle.files) },
      { status: 404 }
    );
  }

  // Touch health on HTML hits
  if (fileName === "index.html" && active.deploymentId) {
    void recordHealthCheck(active.deploymentId, "OK").catch(() => undefined);
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(fileName),
      "Cache-Control": "no-store",
      "X-CHIEF-Agent": slug,
      "X-CHIEF-Version": String(active.version),
      "X-CHIEF-Deployment": active.deploymentId,
    },
  });
}
