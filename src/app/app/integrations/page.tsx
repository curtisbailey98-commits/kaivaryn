import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { smtpConfigured, stripeLinkConfigured } from "@/lib/si-connectors";
import { getPricingConfig } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const tone: Record<string, "success" | "warning" | "danger" | "default" | "info"> = {
  CONNECTED: "success",
  AVAILABLE: "info",
  NEEDS_CONFIG: "warning",
  ERROR: "danger",
};

export default async function IntegrationsPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const connections = await prisma.integrationConnection.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { displayName: "asc" },
  });
  const pricing = await getPricingConfig();

  // Platform-level honesty flags (SI connectors pattern — never echo secrets)
  const platform = [
    {
      name: "Stripe Payment Link",
      configured: stripeLinkConfigured(pricing.stripePaymentLink),
      help: "Public Payment Link in PricingConfig. Stripe API secret is separate and not required for link checkout.",
    },
    {
      name: "SMTP (password reset email)",
      configured: smtpConfigured(),
      help: "Unset = reset links logged server-side (awaiting credentials).",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold">Integrations</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Honest statuses only — never fabricated “connected” without configuration (720 SI connectors pattern).
      </p>

      <h2 className="si-label mt-8">Organization connections</h2>
      <ul className="mt-3 space-y-3">
        {connections.map((c) => (
          <li key={c.id} className="si-panel flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{c.displayName}</p>
              <p className="text-xs text-neutral-500 font-mono">{c.provider}</p>
              {c.errorMessage ? <p className="mt-1 text-xs text-red-300">{c.errorMessage}</p> : null}
            </div>
            <Badge tone={tone[c.status] || "default"}>{c.status}</Badge>
          </li>
        ))}
        {!connections.length ? (
          <li className="text-sm text-neutral-500">No connections seeded for this org.</li>
        ) : null}
      </ul>

      <h2 className="si-label mt-10">Platform flags</h2>
      <ul className="mt-3 space-y-3">
        {platform.map((p) => (
          <li key={p.name} className="si-panel p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{p.name}</p>
              <Badge tone={p.configured ? "success" : "warning"}>
                {p.configured ? "CONFIGURED" : "AWAITING"}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-neutral-500">{p.help}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
