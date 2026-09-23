import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { googleOAuthConfigured } from "@/lib/providers/google-workspace";
import { twilioConfigured } from "@/lib/providers/twilio";
import { formatDate } from "@/lib/utils";
import { syncGmailRepliesAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AcquisitionExecutionPage({ searchParams }: { searchParams?: { google?: string } }) {
  const [google, recentCalls, queuedEmails] = await Promise.all([
    prisma.acquisitionProviderConnection.findUnique({ where: { provider: "GOOGLE_WORKSPACE" } }),
    prisma.acquisitionCall.findMany({
      include: { account: true, contact: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.outreachMessage.count({ where: { status: "QUEUED" } }),
  ]);
  const googleClientReady = googleOAuthConfigured();
  const googleConnected = google?.status === "CONNECTED" && Boolean(google.refreshTokenEncrypted || google.accessTokenEncrypted);
  const twilioReady = twilioConfigured();
  const modelReady = Boolean(process.env.OPENAI_API_KEY);
  const automationReady = Boolean(process.env.ACQUISITION_AUTOMATION_TOKEN);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/acquisition" className="text-xs text-neutral-500 hover:text-white">← Acquisition command center</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-amber-400">Execution layer</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Acquisition channels + call agent</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">The V2 intelligence engine decides the next commercial step. This layer executes Gmail outreach, ingests replies, schedules Google Calendar demos, and runs consent-gated AI voice calls.</p>
        </div>
      </div>

      {searchParams?.google ? <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 text-sm text-amber-200">Google connection status: {searchParams.google}</div> : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="si-panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="font-semibold text-white">Google Workspace</h2><p className="mt-1 text-xs text-neutral-500">Gmail send/read + Google Calendar events</p></div>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase ${googleConnected ? "border-emerald-500/30 text-emerald-300" : "border-neutral-800 text-neutral-500"}`}>{googleConnected ? "Connected" : "Disconnected"}</span>
          </div>
          <div className="mt-4 space-y-2 text-sm text-neutral-400">
            <p>OAuth client: <span className={googleClientReady ? "text-emerald-300" : "text-amber-300"}>{googleClientReady ? "configured" : "needs GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET"}</span></p>
            <p>Mailbox: <span className="text-neutral-200">{google?.accountLabel || "not connected"}</span></p>
            <p>Last reply sync: <span className="text-neutral-200">{google?.lastSyncAt ? formatDate(google.lastSyncAt) : "never"}</span></p>
            {google?.lastError ? <p className="text-red-300">Last error: {google.lastError}</p> : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {googleClientReady && !googleConnected ? <a href="/api/integrations/google/acquisition/connect" className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950">Connect Gmail + Calendar</a> : null}
            {googleConnected ? <form action={syncGmailRepliesAction}><button className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-white">Sync replies now</button></form> : null}
            {googleConnected ? <form action="/api/integrations/google/acquisition/disconnect" method="post"><button className="rounded-md border border-neutral-800 px-4 py-2 text-sm text-neutral-400">Disconnect</button></form> : null}
          </div>
        </div>

        <div className="si-panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="font-semibold text-white">AI call agent</h2><p className="mt-1 text-xs text-neutral-500">Twilio telephony + Kaivaryn qualification context</p></div>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase ${twilioReady ? "border-emerald-500/30 text-emerald-300" : "border-neutral-800 text-neutral-500"}`}>{twilioReady ? "Telephony ready" : "Needs Twilio"}</span>
          </div>
          <div className="mt-4 space-y-2 text-sm text-neutral-400">
            <p>Conversation brain: <span className={modelReady ? "text-emerald-300" : "text-amber-300"}>{modelReady ? `OpenAI ${process.env.OPENAI_CALL_MODEL || "gpt-5.6-luna"}` : "deterministic fallback only"}</span></p>
            <p>Automation tick: <span className={automationReady ? "text-emerald-300" : "text-neutral-500"}>{automationReady ? "token configured" : "manual execution only"}</span></p>
            <p>Queued emails: <span className="text-neutral-200">{queuedEmails}</span></p>
          </div>
          <div className="mt-4 rounded-lg border border-neutral-900 bg-black/20 p-3 text-xs leading-5 text-neutral-400">
            Calls are restricted to verified PRIORITY decision-makers, recorded phone consent, a known timezone, weekday business hours, and a 72-hour attempt cooldown. The agent discloses that it is automated and honors do-not-call immediately.
          </div>
        </div>
      </div>

      <div className="si-panel mt-5 overflow-hidden">
        <div className="border-b border-neutral-900 px-5 py-4"><h2 className="font-semibold text-white">Recent AI calls</h2></div>
        <div className="divide-y divide-neutral-900">
          {recentCalls.map((call) => (
            <Link key={call.id} href={`/admin/acquisition/${call.accountId}`} className="grid gap-2 px-5 py-4 hover:bg-white/[0.02] sm:grid-cols-[1.4fr_1fr_.8fr_.8fr]">
              <div><p className="text-sm font-medium text-white">{call.account.company}</p><p className="mt-1 text-xs text-neutral-500">{call.contact?.name || call.toNumber}</p></div>
              <p className="text-xs text-neutral-400">{call.disposition || "No disposition"}</p>
              <p className="text-xs text-neutral-400">{call.status}</p>
              <p className="text-xs text-neutral-500">{formatDate(call.createdAt)}</p>
            </Link>
          ))}
          {!recentCalls.length ? <p className="px-5 py-6 text-sm text-neutral-500">No call attempts yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
