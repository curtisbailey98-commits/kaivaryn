import Link from "next/link";
import type { Metadata } from "next";
import { AmbientField, BreathGrid, Reveal, Magnetic, SectionRule } from "@/components/motion";
import { ZOOM_SCHEDULER_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Kaivaryn for SpotOn businesses",
  description:
    "Kaivaryn works with the sales export a SpotOn restaurant already downloads. Same reports, familiar setup: comps, voids, refunds, missed calls, delivery charges, and labor, then what actually comes back. Kaivaryn is not affiliated with SpotOn.",
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
  ["Download one report", "In the SpotOn Dashboard: Reports → Custom Views → Orders Per Day → last 90 days → Download CSV. It's the same kind of report the restaurant already uses."],
  ["Import it into Kaivaryn", "The SpotOn importer matches the columns (date, sales, voids, discounts, refunds, net sales) and shows every match before anything is saved."],
  ["See what's slipping", "Kaivaryn compares the last 30 days with the restaurant's own prior 60 and flags what's above normal, with an estimate and the math behind it."],
  ["Win it back, and prove it", "The owner approves the fix; the team does it; a manager records what actually came back. Estimates and won-back dollars are never mixed."],
] as const;

const familiar = [
  ["The report you already know", "Orders Per Day is a standard SpotOn sales export. No new report to learn, and no change to how the restaurant runs SpotOn."],
  ["Columns matched in plain sight", "Kaivaryn reads date, sales, voids, discounts, refunds, and net sales, and shows each match before it saves anything."],
  ["Nothing new to install", "No hardware, no SpotOn password, and no change to card processing. Kaivaryn only reads the file you give it."],
] as const;

const promises = [
  "Estimates are always labeled as estimates. Only dollars a person records as won back count as recovered.",
  "Nothing is called “connected” until real data has arrived.",
  "Kaivaryn never writes to SpotOn and never places calls on a restaurant's behalf.",
  "No invented results: the demo workspace runs on clearly labeled sample data.",
] as const;

export default function SpotOnPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <AmbientField intensity="hero" />
        <BreathGrid opacity={0.28} />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <p className="public-kicker text-amber-400">Kaivaryn for SpotOn businesses</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-6xl">Your SpotOn reports already show where the money goes. Kaivaryn helps you get it back.</h1>
            <div className="mt-5 h-px w-20 bg-gradient-to-r from-amber-400 to-transparent" />
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg">If the restaurant already runs SpotOn, setup is familiar. Kaivaryn reads the sales export the team already downloads and points to the money slipping away: comps, voids, refunds, missed calls, delivery charges, and labor. Then it tracks what actually comes back.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic><a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="public-button-primary">Book a demo <span aria-hidden>↗</span></a></Magnetic>
              <Link href="/restaurants" className="public-button-secondary">How it works for restaurants</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-neutral-900 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="public-kicker text-amber-400">What you get</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">Plain answers about the restaurant&apos;s own money.</h2>
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
            <p className="mt-2">SpotOn doesn&apos;t offer an open API. Live data connections are limited to software companies SpotOn approves through its integration program, which includes certification and a pilot with restaurants. Kaivaryn is not a SpotOn integration partner today, so the report download is how it works now. A live connection would only come after SpotOn approves one.</p>
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-900 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="public-kicker text-amber-400">Familiar from day one</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">If you already run SpotOn, the setup looks like work you already do.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">No new system to learn. The starting point is SpotOn&apos;s own standard sales export.</p>
          </Reveal>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {familiar.map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-neutral-400">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs leading-5 text-neutral-500">Pricing is the same published pricing for everyone: see the <Link href="/pricing" className="text-amber-400 hover:text-amber-300">pricing page</Link>.</p>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="public-kicker text-amber-400">What we promise</p>
          </Reveal>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {promises.map((p) => (
              <li key={p} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-xs leading-5 text-neutral-300">{p}</li>
            ))}
          </ul>
          <SectionRule className="my-12" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-xl text-sm text-neutral-400">Want to see it on a sample SpotOn restaurant? Book a demo and walk through it.</p>
            <Magnetic><a href={ZOOM_SCHEDULER_URL} target="_blank" rel="noopener noreferrer" className="public-button-primary">Book a demo <span aria-hidden>↗</span></a></Magnetic>
          </div>
          <p className="mt-10 text-[11px] leading-5 text-neutral-600">Kaivaryn is independent and is not affiliated with, endorsed by, or sponsored by SpotOn. SpotOn is a trademark of its owner and is named here only to describe compatibility with its standard report exports.</p>
        </div>
      </section>
    </>
  );
}
