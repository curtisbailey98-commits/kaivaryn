import Link from "next/link";
import { requireOrgAccess } from "@/lib/tenant";
import { opCtxFromSession, getInbox, listBriefings, getBriefing } from "@/lib/operate";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { BriefingView } from "@/components/operate/briefing-view";
import { generateBriefingAction, markAllInboxNotificationsRead, markBriefingReadAction } from "../operate-actions";
import { markNotificationRead } from "../actions";
import { formatDate } from "@/lib/utils";
import { ShieldCheck, Bell, ListTodo, Workflow, AlarmClockOff, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const TYPE_META = {
  APPROVAL: { label: "Approval", icon: ShieldCheck, tone: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
  NOTIFICATION: { label: "Notification", icon: Bell, tone: "text-sky-300 border-sky-500/30 bg-sky-500/10" },
  TASK: { label: "Action request", icon: ListTodo, tone: "text-violet-300 border-violet-500/30 bg-violet-500/10" },
  RUN: { label: "Run", icon: Workflow, tone: "text-rose-300 border-rose-500/30 bg-rose-500/10" },
  STANDING_FAILURE: { label: "Standing order", icon: AlarmClockOff, tone: "text-red-300 border-red-500/30 bg-red-500/10" },
  BRIEFING: { label: "Briefing", icon: FileText, tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
} as const;

export default async function InboxPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = opCtxFromSession(await requireOrgAccess());
  const filter = searchParams.filter;
  const [inbox, briefings, focus] = await Promise.all([
    getInbox(ctx, 80),
    listBriefings(ctx, 12),
    searchParams.briefing ? getBriefing(ctx, searchParams.briefing) : Promise.resolve(null),
  ]);
  const items = filter ? inbox.items.filter((i) => i.type === filter) : inbox.items;
  const tiles: Array<{ key: keyof typeof TYPE_META; count: number }> = [
    { key: "APPROVAL", count: inbox.counts.approvals },
    { key: "TASK", count: inbox.counts.tasks },
    { key: "NOTIFICATION", count: inbox.counts.notifications },
    { key: "BRIEFING", count: inbox.counts.briefings },
    { key: "RUN", count: inbox.counts.runs },
    { key: "STANDING_FAILURE", count: inbox.counts.standingFailures },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Everything waiting on you"
        description="Approvals, action requests, notifications, briefings, and anything that failed — one queue, newest first. Briefings are snapshots generated from your data; estimates and recorded outcomes stay separate."
        actions={
          <>
            <form action={generateBriefingAction}><input type="hidden" name="kind" value="DIGEST" /><Button type="submit">Generate digest</Button></form>
            <form action={generateBriefingAction}><input type="hidden" name="kind" value="RECALL" /><Button type="submit" variant="outline">Recall</Button></form>
            <form action={markAllInboxNotificationsRead}><Button type="submit" variant="ghost">Mark read</Button></form>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => {
          const m = TYPE_META[t.key];
          const Icon = m.icon;
          const active = filter === t.key;
          return (
            <Link key={t.key} href={active ? "/app/inbox" : `/app/inbox?filter=${t.key}`} className={`rounded-xl border p-3 transition hover:border-amber-500/40 ${active ? "border-amber-500/50 bg-amber-500/[0.06]" : "border-neutral-800 bg-neutral-950/60"}`}>
              <div className="flex items-center justify-between">
                <span className={`flex h-7 w-7 items-center justify-center rounded-md border ${m.tone}`}><Icon className="h-3.5 w-3.5" /></span>
                <span className="text-2xl font-semibold text-white">{t.count}</span>
              </div>
              <p className="mt-2 text-[11px] uppercase tracking-wider text-neutral-500">{m.label}s</p>
            </Link>
          );
        })}
      </div>

      {focus ? (
        <Card className="border-amber-500/20">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>{focus.title}</CardTitle>
              <CardDescription>{focus.kind === "DIGEST" ? "Executive digest" : focus.kind === "RECALL" ? "Recall" : "Status"} · generated {formatDate(focus.createdAt)} via {focus.source.replace(/_/g, " ").toLowerCase()}</CardDescription>
            </div>
            {!focus.readAt ? (
              <form action={markBriefingReadAction.bind(null, focus.id)}><Button size="sm" variant="secondary" type="submit">Mark read</Button></form>
            ) : null}
          </CardHeader>
          <CardContent>
            <BriefingView kind={focus.kind} bodyJson={focus.bodyJson} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{filter ? `${TYPE_META[filter as keyof typeof TYPE_META]?.label ?? "Filtered"} items` : "Queue"}</CardTitle>
            <CardDescription>{items.length} item{items.length === 1 ? "" : "s"}{filter ? " · " : ""}{filter ? <Link href="/app/inbox" className="text-amber-400">clear filter</Link> : null}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <EmptyState className="m-5" title="Inbox zero" description="Nothing is waiting on you right now." />
            ) : (
              <ul className="divide-y divide-neutral-900">
                {items.map((it) => {
                  const m = TYPE_META[it.type];
                  const Icon = m.icon;
                  return (
                    <li key={`${it.type}:${it.id}`} className="flex items-start gap-3 px-5 py-3">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${m.tone}`}><Icon className="h-3.5 w-3.5" /></span>
                      <div className="min-w-0 flex-1">
                        <Link href={it.href} className="block truncate text-sm font-medium text-neutral-100 hover:text-amber-300">{it.title}</Link>
                        {it.detail ? <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{it.detail}</p> : null}
                        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-600">{m.label} · {formatDate(it.createdAt)}{it.urgent ? " · needs attention" : ""}</p>
                      </div>
                      {it.type === "NOTIFICATION" ? (
                        <form action={markNotificationRead.bind(null, it.id)}><Button size="sm" variant="ghost" type="submit">Read</Button></form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Briefings</CardTitle>
            <CardDescription>Digests and recalls from Command, playbooks, and standing orders.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {briefings.length === 0 ? (
              <EmptyState className="m-5" title="No briefings yet" description="Generate a digest or say “brief me” in Command." />
            ) : (
              <ul className="divide-y divide-neutral-900">
                {briefings.map((b) => (
                  <li key={b.id}>
                    <Link href={`/app/inbox?briefing=${b.id}`} className={`flex items-center justify-between gap-2 px-5 py-3 text-sm transition hover:bg-neutral-900/50 ${b.id === focus?.id ? "bg-amber-500/[0.05]" : ""}`}>
                      <span className="min-w-0 truncate text-neutral-200">{!b.readAt ? <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" /> : null}{b.title}</span>
                      <span className="shrink-0 text-[10px] uppercase text-neutral-500">{b.source.replace(/_/g, " ").toLowerCase()}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
