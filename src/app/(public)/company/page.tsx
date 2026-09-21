import type { Metadata } from "next";

export const metadata: Metadata = { title: "Company" };

export default function CompanyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold text-white">Kaivaryn LLC</h1>
      <p className="mt-4 leading-relaxed text-neutral-400">
        Kaivaryn is an enterprise AI consulting company focused on revenue recovery and operations
        efficiency. We build software that executives can trust: restrained interfaces, tenant
        isolation, auditable actions, and honest empty states.
      </p>
      <p className="mt-4 text-sm text-neutral-500">
        We do not publish fabricated testimonials, robot mascots, or vanity statistics.
      </p>
    </div>
  );
}
