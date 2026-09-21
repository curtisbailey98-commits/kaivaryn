import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { markAllNotificationsRead, markNotificationRead } from "../actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const notes = await prisma.notification.findMany({
    where: { organizationId: ctx.organizationId, userId: ctx.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="si-label text-amber-500">Inbox</p>
          <h1 className="mt-1 text-2xl font-semibold">Notifications</h1>
        </div>
        <form action={markAllNotificationsRead}>
          <Button type="submit" variant="secondary">Mark all read</Button>
        </form>
      </div>
      {notes.length === 0 ? (
        <EmptyState className="mt-8" title="No notifications" />
      ) : (
        <ul className="mt-6 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className={`si-panel flex flex-wrap items-start justify-between gap-3 p-3 text-sm ${n.readAt ? "opacity-60" : ""}`}>
              <div>
                <div className="flex items-center gap-2">
                  {!n.readAt ? <Badge tone="warning">NEW</Badge> : null}
                  <span className="font-medium">{n.title}</span>
                </div>
                {n.body ? <p className="mt-1 text-neutral-400">{n.body}</p> : null}
                <p className="mt-1 text-xs text-neutral-500">{formatDate(n.createdAt)}</p>
                {n.href ? (
                  <Link href={n.href} className="mt-1 inline-block text-xs text-amber-400">Open →</Link>
                ) : null}
              </div>
              {!n.readAt ? (
                <form action={markNotificationRead.bind(null, n.id)}>
                  <Button type="submit" variant="secondary">Read</Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
