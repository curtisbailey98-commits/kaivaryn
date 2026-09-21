import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateDemoStatus } from "./actions";
import type { DemoRequestStatus } from "@/lib/enums";

export const dynamic = "force-dynamic";

const PIPELINE: DemoRequestStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "SCHEDULED",
  "DEMO_COMPLETED",
  "PAYMENT_PENDING",
  "CLOSED_WON",
  "CLOSED_LOST",
];

export default async function AdminDemosPage() {
  const demos = await prisma.demoRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div>
      <h1 className="text-xl font-semibold">Demo leads</h1>
      <p className="mt-1 text-xs text-neutral-500">
        Pipeline: NEW → CONTACTED → QUALIFIED → SCHEDULED → DEMO_COMPLETED → PAYMENT_PENDING → CLOSED_*
      </p>
      <ul className="mt-6 space-y-4">
        {demos.map((d) => (
          <li key={d.id} className="si-panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">{d.status}</Badge>
              <span className="font-medium">{d.name}</span>
              <span className="text-sm text-neutral-400">{d.email}</span>
              <span className="text-sm text-neutral-500">· {d.company}</span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Products: {d.products} · {formatDate(d.createdAt)}
              {d.message ? ` · ${d.message.slice(0, 120)}` : ""}
            </p>
            <form
              action={async (fd) => {
                "use server";
                await updateDemoStatus(d.id, fd);
              }}
              className="mt-3 flex flex-wrap items-center gap-2"
            >
              <select name="status" defaultValue={d.status} className="h-9 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm">
                {PIPELINE.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input name="notes" placeholder="Notes" defaultValue={d.notes ?? ""} className="h-9 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm" />
              <Button type="submit" size="sm" variant="secondary">Update</Button>
            </form>
          </li>
        ))}
        {!demos.length ? <li className="text-sm text-neutral-500">No demo requests yet.</li> : null}
      </ul>
    </div>
  );
}
