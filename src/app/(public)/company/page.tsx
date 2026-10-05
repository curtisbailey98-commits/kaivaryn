import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Company",
  description:
    "Kaivaryn LLC is an executive AI consulting and enterprise automation firm focused on revenue recovery and operations efficiency.",
};

const principles = [["01", "Clarity over theater", "Leaders should see what is material, what it is worth, and what happens next — without wading through noise."], ["02", "Accountability over autonomy", "Actions have owners, approvals, and audit trails. External systems are never claimed as updated when they were not."], ["03", "Progress over vanity", "We care about recovered value and realized efficiency—not activity that only looks like progress."], ["04", "Trust compounds", "Private workspaces, explicit evidence, and honest answers when the data is thin are part of the product, not footnotes."]];

export default function CompanyPage() {
  return <><section className="relative overflow-hidden border-b border-neutral-900"><div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24"><p className="public-kicker text-amber-400">Executive AI consulting firm</p><h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-6xl">Experienced operators. Proprietary software. Measured results.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">Kaivaryn LLC is an executive AI consulting firm. We find the revenue businesses are losing and the operating cost they don&apos;t need to carry, then help leadership act on it and measure what was actually recovered.</p></div></section><section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24"><div className="grid gap-px overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-800 sm:grid-cols-2">{principles.map(([number, title, body]) => <div key={number} className="bg-neutral-950 p-7 sm:p-9"><p className="font-mono text-xs text-amber-500">{number}</p><h2 className="mt-5 text-xl font-semibold text-white">{title}</h2><p className="mt-3 text-sm leading-6 text-neutral-500">{body}</p></div>)}</div><div className="mt-12 flex flex-wrap gap-3"><Link href="/how-it-works" className="public-button-secondary">How we work</Link><Link href="/demo" className="public-button-primary">Book a demo <span aria-hidden>↗</span></Link></div></section></>;
}
