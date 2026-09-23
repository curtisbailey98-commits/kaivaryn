import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createAcquisitionAccount } from "./actions";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AcquisitionCommandCenter() {
  const [accounts, total, priority, demos, checkoutReady, paid, onboarding, outreachSent, replies, signalRows, industryRows] = await Promise.all([
    prisma.acquisitionAccount.findMany({ orderBy: { updatedAt: "desc" }, take: 100, include: { intentSignals: { take: 1, orderBy: { occurredAt: "desc" } } } }),
    prisma.acquisitionAccount.count(),
    prisma.acquisitionAccount.count({ where: { qualificationBand: "PRIORITY" } }),
    prisma.acquisitionAccount.count({ where: { stage: { in: ["DEMO_BOOKED", "DEMO_COMPLETED"] } } }),
    prisma.acquisitionAccount.count({ where: { stage: "CHECKOUT_READY" } }),
    prisma.acquisitionAccount.count({ where: { paymentStatus: "PAID" } }),
    prisma.acquisitionAccount.count({ where: { stage: { in: ["ONBOARDING", "ACTIVE"] } } }),
    prisma.outreachMessage.count({ where: { sentAt: { not: null } } }),
    prisma.outreachMessage.count({ where: { responseClass: { not: null } } }),
    prisma.intentSignal.findMany({ select: { category: true } }),
    prisma.acquisitionAccount.findMany({ select: { industry: true } }),
  ]);
  const pipelineValue = await prisma.acquisitionAccount.aggregate({ _sum: { estimatedDealValueCents: true }, where: { stage: { notIn: ["CLOSED_LOST", "DISQUALIFIED", "UNSUBSCRIBED"] } } });
  const tally = (values: (string | null)[]) => Object.entries(values.filter(Boolean).reduce<Record<string, number>>((acc, value) => { const key = String(value); acc[key] = (acc[key] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topSignals = tally(signalRows.map((r) => r.category));
  const topIndustries = tally(industryRows.map((r) => r.industry));
  const demoCount = await prisma.acquisitionAccount.count({ where: { demoCompletedAt: { not: null } } });
  const demoToPaid = demoCount ? Math.round((paid / demoCount) * 100) : 0;
  const replyRate = outreachSent ? Math.round((replies / outreachSent) * 100) : 0;

  const metrics = [
    ["Accounts", total],
    ["Priority", priority],
    ["Demo stage", demos],
    ["Checkout ready", checkoutReady],
    ["Paid", paid],
    ["Onboarding / active", onboarding],
    ["Outreach sent", outreachSent],
    ["Replies", replies],
  ] as const;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-400">Kaivaryn acquisition intelligence</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Intent → qualification → reverse selling → demo → onboarding</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">Internal command center for accounts Kaivaryn is evaluating. Scores retain evidence; micro-audits separate fact from hypothesis; Stripe stays locked until a demo is completed.</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3 text-right">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Modeled pipeline</p>
          <p className="mt-1 text-xl font-semibold text-amber-400">{formatCurrency((pipelineValue._sum.estimatedDealValueCents || 0) / 100)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value]) => <div key={label} className="si-panel p-4"><p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p></div>)}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <div className="si-panel p-4"><p className="text-[10px] uppercase tracking-wider text-neutral-500">Reply rate</p><p className="mt-2 text-2xl font-semibold text-white">{replyRate}%</p><p className="mt-1 text-xs text-neutral-500">Recorded replies / sent outreach</p></div>
        <div className="si-panel p-4"><p className="text-[10px] uppercase tracking-wider text-neutral-500">Demo → paid</p><p className="mt-2 text-2xl font-semibold text-white">{demoToPaid}%</p><p className="mt-1 text-xs text-neutral-500">Verified Stripe payment after completed demo</p></div>
        <div className="si-panel p-4"><p className="text-[10px] uppercase tracking-wider text-neutral-500">Top intent categories</p><p className="mt-2 text-xs leading-6 text-neutral-300">{topSignals.length ? topSignals.map(([name, count]) => `${name} (${count})`).join(" · ") : "No signals yet"}</p></div>
        <div className="si-panel p-4"><p className="text-[10px] uppercase tracking-wider text-neutral-500">Top industries</p><p className="mt-2 text-xs leading-6 text-neutral-300">{topIndustries.length ? topIndustries.map(([name, count]) => `${name} (${count})`).join(" · ") : "No industry data yet"}</p></div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
        <form action={createAcquisitionAccount} className="si-panel p-5">
          <h2 className="font-semibold text-white">Add account / imported prospect</h2>
          <p className="mt-1 text-xs text-neutral-500">Use this for a manually discovered target or an imported intent account. The provider API can ingest the same structure.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input required name="company" placeholder="Company *" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <input name="domain" placeholder="Domain" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <input name="industry" placeholder="Industry" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <input name="companySize" placeholder="Company size (e.g. 51-200)" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <input name="primaryName" placeholder="Decision-maker name" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <input name="primaryTitle" placeholder="Title" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <input type="email" name="primaryEmail" placeholder="Work email" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm" />
            <select name="selectedProduct" className="h-10 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm"><option value="">Product not decided</option><option value="REVENUE_RECOVERY">Revenue Recovery</option><option value="OPERATIONS_EFFICIENCY">Operations Efficiency</option><option value="BOTH">Both</option></select>
          </div>
          <input type="hidden" name="source" value="MANUAL" />
          <button className="mt-4 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950">Create acquisition account</button>
        </form>

        <div className="si-panel overflow-hidden">
          <div className="border-b border-neutral-900 px-5 py-4"><h2 className="font-semibold text-white">Acquisition pipeline</h2></div>
          <div className="divide-y divide-neutral-900">
            {accounts.map((a) => (
              <Link key={a.id} href={`/admin/acquisition/${a.id}`} className="grid gap-2 px-5 py-4 hover:bg-white/[0.02] sm:grid-cols-[1.5fr_.8fr_.7fr_.6fr] sm:items-center">
                <div><p className="font-medium text-white">{a.company}</p><p className="mt-1 text-xs text-neutral-500">{a.domain || a.primaryEmail || a.source || "No domain yet"} · updated {formatDate(a.updatedAt)}</p></div>
                <div><p className="text-xs text-neutral-500">Stage</p><p className="mt-1 text-sm text-neutral-200">{a.stage}</p></div>
                <div><p className="text-xs text-neutral-500">Qualification</p><p className={`mt-1 text-sm font-semibold ${a.qualificationBand === "PRIORITY" ? "text-emerald-400" : a.qualificationBand === "NURTURE" ? "text-amber-400" : "text-neutral-400"}`}>{a.qualificationScore}/100 · {a.qualificationBand}</p></div>
                <div><p className="text-xs text-neutral-500">Intent</p><p className="mt-1 text-sm text-white">{a.intentScore}/100</p></div>
              </Link>
            ))}
            {!accounts.length ? <p className="px-5 py-8 text-sm text-neutral-500">No acquisition accounts yet.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
