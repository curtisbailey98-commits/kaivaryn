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
            {d.zoomLink ? (
              <p className="mt-1 text-xs">
                <span className="text-neutral-500">Zoom: </span>
                <a
                  href={d.zoomLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 break-all"
                >
                  {d.zoomLink}
                </a>
              </p>
            ) : null}
            {d.status === "SCHEDULED" && !d.zoomLink ? (
              <p className="mt-2 rounded-md border border-amber-900/60 bg-amber-950/30 px-2 py-1.5 text-xs text-amber-200">
                Status is SCHEDULED — set a Zoom link so the lead has a meeting URL.
              </p>
            ) : null}
            <form
              action={async (fd) => {
                "use server";
                await updateDemoStatus(d.id, fd);
              }}
              className="mt-3 space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <select name="status" defaultValue={d.status} className="h-9 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm">
                  {PIPELINE.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <input name="notes" placeholder="Notes" defaultValue={d.notes ?? ""} className="h-9 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm" />
                <Button type="submit" size="sm" variant="secondary">Update</Button>
              </div>
              <label className="block text-xs text-neutral-400">
                Zoom / meeting link
                <input
                  name="zoomLink"
                  type="url"
                  placeholder="https://zoom.us/j/… (per-lead scheduled meeting)"
                  defaultValue={d.zoomLink ?? ""}
                  className="mt-1 h-9 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm"
                />
              </label>
            </form>
          </li>
        ))}
        {!demos.length ? <li className="text-sm text-neutral-500">No demo requests yet.</li> : null}
      </ul>
    </div>
  );
}
