import Link from "next/link";
import type { Metadata } from "next";
import { AmbientField, BreathGrid, Reveal, Magnetic, SectionRule } from "@/components/motion";
import { ZOOM_SCHEDULER_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "For SpotOn partners and merchants",
  description:
    "Kaivaryn turns the sales reports SpotOn restaurants already have into money they can win back: comps, voids, refunds, missed calls, delivery charges, and labor. A partner introduces Kaivaryn; Curtis Bailey and the Kaivaryn team handle the AI setup and support.",
};

const finds = [
  ["Comps, discounts & voids", "When they run above the restaurant's own usual rate, and by how much. Compared with that restaurant's last 60 days, not an industry average."],
  ["Refunds", "Refund rates that climb, with the numbers behind them, so a manager can check the checks."],
  ["Missed calls", "Calls that rang out during the rush, valued with the restaurant's own average check from SpotOn."],
  ["Delivery charges", "Missing-item and error charges that were never disputed before the window closed."],
  ["Labor vs. sales", "Hours where more staff are on the clock than the sales need."],
  ["Manual reports", "The nightly recap someone types into a spreadsheet, replaced by a daily digest."],
] as const;

const steps = [
  ["Download one report", "In the SpotOn Dashboard: Reports → Custom Views → Orders Per Day → last 90 days → Download CSV. It's a report SpotOn merchants already have."],
  ["Import it into Kaivaryn", "The SpotOn importer matches the columns (date, sales, voids, discounts, refunds, net sales) and shows every match before anything is saved."],
  ["See what's slipping", "Kaivaryn compares the last 30 days with the restaurant's own prior 60 and flags what's above normal, with an estimate and the math behind it."],
  ["Win it back, and prove it", "The owner approves the fix; the team does it; a manager records what actually came back. Estimates and won-back dollars are never mixed."],
] as const;

const roles = [
  ["You (the SpotOn partner)", "Introduce Kaivaryn to the merchants you already look after. You keep the relationship. Kaivaryn adds an AI layer on top of the SpotOn system you installed; it doesn't replace it."],
  ["Curtis Bailey & Kaivaryn", "Your in-house AI partner. Curtis, Kaivaryn's founder, handles the AI side for your merchants: setup, importing their SpotOn reports, walking owners through what was found, and ongoing support."],
  ["The merchant", "Owns their data and every decision. Nothing changes in SpotOn. Kaivaryn reads the exports they choose to share and recommends; their team acts."],
] as const;

const promises = [
  "Estimates are always labeled as estimates. Only dollars a person records as won back count as recovered.",
  "Nothing is called “connected” until real data has arrived.",
  "Kaivaryn never writes to SpotOn and never places calls on a merchant's behalf.",
  "No invented results: the demo workspace runs on clearly labeled sample data.",
] as const;

export default function SpotOnPartnersPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <AmbientField intensity="hero" />
        <BreathGrid opacity={0.28} />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <p className="public-kicker text-amber-400">For SpotOn partners and their restaurants</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-6xl">Your merchants&apos; SpotOn reports already show where the money goes. Kaivaryn helps them get it back.</h1>
            <div className="mt-5 h-px w-20 bg-gradient-to-r from-amber-400 to-transparent" />
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg">Kaivaryn reads the sales reports a SpotOn restaurant already has and points to the money slipping away: comps, voids, refunds, missed calls, delivery charges, and labor. Then it tracks what actually comes back. You introduce it. Curtis Bailey and the Kaivaryn team handle the AI.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic><a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="public-button-primary">Book a partner call with Curtis <span aria-hidden>↗</span></a></Magnetic>
              <Link href="/restaurants" className="public-button-secondary">How it works for restaurants</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-neutral-900 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="public-kicker text-amber-400">What a merchant gets</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">Plain answers about their own money.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">Each finding comes with the numbers it was built from, an owner, and a next step. What Kaivaryn can look at depends on the reports the restaurant shares.</p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {finds.map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-neutral-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-900 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="public-kicker text-amber-400">How it works with SpotOn data</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">One report download. No new hardware, no changes to SpotOn.</h2>
          </Reveal>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2">
            {steps.map(([title, body], i) => (
              <li key={title} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
                <p className="font-mono text-[10px] text-amber-500/80">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-2 text-sm font-semibold text-white">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-neutral-400">{body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 rounded-2xl border border-neutral-800 p-5 text-xs leading-5 text-neutral-400">
            <p className="font-semibold text-neutral-200">What about a live connection to SpotOn?</p>
            <p className="mt-2">SpotOn doesn&apos;t offer an open API. Live data connections are limited to software partners SpotOn approves through its integration partner program, which includes certification and a pilot with merchants. Kaivaryn is not a SpotOn integration partner today, so the report download is how it works now. A live connection would only come after SpotOn approves one.</p>
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-900 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="public-kicker text-amber-400">The partner model</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">You bring the relationships. Kaivaryn brings the AI.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">Your merchants already trust you with their point of sale. Kaivaryn gives you an AI offer to bring them, with a named expert behind it instead of a help-desk queue.</p>
          </Reveal>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {roles.map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-neutral-400">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs leading-5 text-neutral-500">Referral and partner terms are agreed one-on-one with each partner. Merchant pricing is the same published pricing for everyone: see the <Link href="/pricing" className="text-amber-400 hover:text-amber-300">pricing page</Link>.</p>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="public-kicker text-amber-400">What we promise your merchants</p>
          </Reveal>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {promises.map((p) => (
              <li key={p} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-xs leading-5 text-neutral-300">{p}</li>
            ))}
          </ul>
          <SectionRule className="my-12" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-xl text-sm text-neutral-400">Want to see it on a sample SpotOn restaurant? Book a call and Curtis will walk you through it.</p>
            <Magnetic><a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="public-button-primary">Book a partner call <span aria-hidden>↗</span></a></Magnetic>
          </div>
          <p className="mt-10 text-[11px] leading-5 text-neutral-600">Kaivaryn is independent and is not affiliated with, endorsed by, or sponsored by SpotOn. SpotOn is a trademark of its owner and is named here only to describe compatibility with its standard report exports.</p>
        </div>
      </section>
    </>
  );
}
