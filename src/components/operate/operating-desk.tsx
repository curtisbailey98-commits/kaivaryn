import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CommandBar } from "@/components/operate/command-bar";
import { StatusDot } from "@/components/motion";
import { formatDate } from "@/lib/utils";
import { HeartPulse, Inbox, Brain, AlarmClock, FileText, Workflow } from "lucide-react";

/**
 * Operating desk — renovated from the 720 SI OS desk (status bar + widget row).
 * Every tile is a live, tenant-scoped read. Nothing here is illustrative.
 */
export async function OperatingDesk({ organizationId, userId }: { organizationId: string; userId: string }) {
  const [health, approvals, unread, briefingsUnread, lastCycle, standing, lastBriefing, waitingRuns] = await Promise.all([
    prisma.opHealthCheck.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" }, select: { status: true, createdAt: true } }),
    prisma.approvalRequest.count({ where: { organizationId, status: "PENDING" } }),
    prisma.notification.count({ where: { organizationId, userId, readAt: null } }),
    prisma.opBriefing.count({ where: { organizationId, readAt: null } }),
    prisma.siCognitionCycle.findFirst({ where: { organizationId, status: "succeeded" }, orderBy: { completedAt: "desc" }, select: { product: true, completedAt: true } }),
    prisma.opStandingOrder.count({ where: { organizationId, enabled: true } }),
    prisma.opBriefing.findFirst({ where: { organizationId, kind: "DIGEST" }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true } }),
    prisma.opRun.count({ where: { organizationId, status: "WAITING_APPROVAL" } }),
  ]);
  const inbox = approvals + unread + briefingsUnread;
  const tiles = [
    {
      href: "/app/operate",
      icon: HeartPulse,
      label: "Health",
      value: health?.status ?? "Not checked",
      sub: health ? formatDate(health.createdAt) : "Run a check",
      tone: health?.status === "OK" ? "text-emerald-300" : health ? "text-amber-300" : "text-neutral-400",
    },
    { href: "/app/inbox", icon: Inbox, label: "Inbox", value: String(inbox), sub: `${approvals} approval${approvals === 1 ? "" : "s"} pending`, tone: inbox ? "text-amber-300" : "text-white" },
    {
      href: "/app/intelligence",
      icon: Brain,
      label: "Last cycle",
      value: lastCycle?.completedAt ? formatDate(lastCycle.completedAt) : "None yet",
      sub: lastCycle ? (lastCycle.product === "REVENUE_RECOVERY" ? "Revenue · R1–R9" : "Operations · R1–R9") : "Ask Command to analyze",
      tone: "text-white",
    },
    { href: "/app/automations", icon: AlarmClock, label: "Standing orders", value: String(standing), sub: "active", tone: "text-white" },
    { href: "/app/automations", icon: Workflow, label: "Runs waiting", value: String(waitingRuns), sub: "on a human decision", tone: waitingRuns ? "text-amber-300" : "text-white" },
    {
      href: lastBriefing ? `/app/inbox?briefing=${lastBriefing.id}` : "/app/inbox",
      icon: FileText,
      label: "Last digest",
      value: lastBriefing ? formatDate(lastBriefing.createdAt) : "None yet",
      sub: lastBriefing ? "Open briefing" : "Say “brief me”",
      tone: "text-white",
    },
  ];

  return (
    <section aria-label="Operating desk" className="relative overflow-hidden rounded-2xl border border-amber-500/15 bg-gradient-to-br from-neutral-900/80 via-neutral-950 to-neutral-950 p-4 sm:p-5">
      <div className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" aria-hidden />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">
          <StatusDot tone={health?.status === "OK" ? "ok" : "warn"} /> Operating desk
        </p>
        <Link href="/app/command?q=help" className="text-[11px] text-neutral-500 hover:text-amber-300">What can Command do? →</Link>
      </div>
      <div className="relative mt-3">
        <CommandBar compact back="/app" examples={[
          { label: "Brief me", text: "Brief me on what changed" },
          { label: "Analyze revenue", text: "Analyze revenue leakage in billing and renewals" },
          { label: "Status", text: "status" },
          { label: "Run weekly review", text: "run playbook executive-weekly-review" },
        ]} />
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.label} href={t.href} className="group rounded-xl border border-neutral-800/90 bg-neutral-950/70 p-3 transition hover:border-amber-500/40 hover:bg-neutral-900/60">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500"><Icon className="h-3 w-3 text-amber-500/80" />{t.label}</p>
              <p className={`mt-1.5 truncate text-sm font-semibold ${t.tone}`}>{t.value}</p>
              <p className="mt-0.5 truncate text-[10px] text-neutral-600 group-hover:text-neutral-400">{t.sub}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
