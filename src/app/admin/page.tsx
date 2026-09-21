import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [orgs, users, demos, audits] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.demoRequest.count(),
    prisma.auditLog.count(),
  ]);
  return (
    <div>
      <h1 className="text-2xl font-semibold">Kaivaryn console</h1>
      <p className="mt-1 text-sm text-neutral-400">SUPER_ADMIN only · cross-tenant</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ["Organizations", orgs],
          ["Users", users],
          ["Demo leads", demos],
          ["Audit entries", audits],
        ].map(([l, n]) => (
          <Card key={String(l)}>
            <CardHeader><CardTitle>{l}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{n as number}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
