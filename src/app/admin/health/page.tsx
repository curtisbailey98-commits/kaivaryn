import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminHealthPage() {
  const started = Date.now();
  let db: "ok" | "error" = "ok";
  let err: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    db = "error";
    err = e instanceof Error ? e.message : "unknown";
  }
  const latency = Date.now() - started;
  return (
    <div>
      <h1 className="text-xl font-semibold">Health</h1>
      <ul className="mt-6 space-y-3 text-sm">
        <li className="si-panel flex items-center justify-between p-4">
          <span>API / app</span>
          <Badge tone="success">ok</Badge>
        </li>
        <li className="si-panel flex items-center justify-between p-4">
          <span>SQLite / Prisma ({latency}ms)</span>
          <Badge tone={db === "ok" ? "success" : "danger"}>{db}</Badge>
        </li>
        <li className="si-panel flex items-center justify-between p-4">
          <span>Redis (SI worker queues)</span>
          <Badge tone="warning">not required — Kaivaryn free path</Badge>
        </li>
      </ul>
      {err ? <p className="mt-4 text-sm text-red-300">{err}</p> : null}
      <p className="mt-4 text-xs text-neutral-500">Also: GET /api/health</p>
    </div>
  );
}
