import Link from "next/link";
import type { Metadata } from "next";
import { AmbientField, BreathGrid, Reveal, Magnetic, SectionRule } from "@/components/motion";
import { RESTAURANT_GROUPS } from "@/lib/industry/restaurant";

export const metadata: Metadata = {
  title: "For restaurants",
  description:
    "Kaivaryn sits over your POS and restaurant systems — Toast, Square, Clover, delivery, reservations, labor, and food cost — to find comps, voids, refund anomalies, missed online orders, labor waste, and food-cost gaps. Selecting a system plans the connection; nothing is marked connected until data arrives.",
};

const leaks = [
  ["Comps, voids & discounts", "Outside policy — by employee, shift, reason, and time after the ticket was fired."],
  ["Refund anomalies", "Unusual amounts, repeat cards, refunds with no matching check, or refunds after close."],
  ["Missed online orders", "Rejected, timed-out, or never-accepted tablet orders during the rush."],
  ["Delivery fees & disputes", "Error charges and chargebacks that were never disputed before the window closed."],
  ["Labor vs. sales by hour", "Where you are over- or under-staffed against what actually sold."],
  ["Food cost & waste", "Actual vs. theoretical usage — protein and prep that recipes and sales cannot explain."],
] as const;

const how = [
  ["Pick your POS", "In setup, choose Toast, Square, Clover, Lightspeed, SpotOn, TouchBistro, Revel, Aloha, Simphony, Heartland, or another system — plus delivery, reservations, labor, and inventory tools you use."],
  ["Follow the guide", "Each system has its own export or API steps and the business details Kaivaryn needs. Choosing a system plans the connection; it does not connect anything yet."],
  ["Import evidence", "Upload a POS export, use a spreadsheet template, or hand Kaivaryn a webhook. Status stays honest until data has arrived."],
  ["Run the plays", "Restaurant playbooks look for leakage and labor waste in what you imported. Results are recommendations with evidence — not invented numbers."],
] as const;

export default function RestaurantsPage() {
  const pos = RESTAURANT_GROUPS.find((g) => g.id === "pos");
  const others = RESTAURANT_GROUPS.filter((g) => g.id !== "pos");
  return (
    <>
      <section className="relative overflow-hidden border-b border-neutral-900">
        <AmbientField intensity="hero" />
        <BreathGrid opacity={0.28} />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <p className="public-kicker text-amber-400">For restaurants</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-6xl">Your POS already has the money story. Kaivaryn reads it.</h1>
            <div className="mt-5 h-px w-20 bg-gradient-to-r from-amber-400 to-transparent" />
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg">Kaivaryn sits over the systems you already run — point of sale, delivery, reservations, labor, and food cost — to find revenue leakage and operating waste. Nothing is marked connected until your data has actually arrived.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic><Link href="/demo" className="public-button-primary">Book a restaurant demo <span aria-hidden>↗</span></Link></Magnetic>
              <Link href="/value" className="public-button-secondary">Estimate the leak</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-neutral-900 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="public-kicker text-amber-400">Where restaurants lose money</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">The same patterns show up in almost every house.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">These are the kinds of issues restaurant playbooks look for once POS and related exports are in the workspace. Examples are illustrative until your data is connected.</p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leaks.map(([title, body]) => (
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
            <p className="public-kicker text-amber-400">Works with your stack</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">Start with the POS. Add the rest as you go.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">Kaivaryn is not a POS marketplace app and does not claim a partner badge. Each option has a written setup guide from vendor documentation (or steps confirmed with your Kaivaryn lead). Direct API access is arranged with you when it exists.</p>
          </Reveal>
          {pos ? (
            <div className="mt-10">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Point of sale</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {pos.options.map((o) => (
                  <li key={o.key} className="rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-300">{o.name}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {others.map((g) => (
              <div key={g.id}>
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{g.title}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {g.options.map((o) => (
                    <li key={o.key} className="rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-300">{o.name}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-900 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="public-kicker text-amber-400">How onboarding works</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white sm:text-3xl">Selected is not connected.</h2>
          </Reveal>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2">
            {how.map(([title, body], i) => (
              <li key={title} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
                <p className="font-mono text-[10px] text-amber-500/80">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-2 text-sm font-semibold text-white">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-neutral-400">{body}</p>
              </li>
            ))}
          </ol>
          <SectionRule className="my-12" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-xl text-sm text-neutral-400">Ready to see comps, voids, and labor against your own exports?</p>
            <Magnetic><Link href="/demo" className="public-button-primary">Book a demo <span aria-hidden>↗</span></Link></Magnetic>
          </div>
        </div>
      </section>
    </>
  );
}
