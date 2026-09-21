import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminOrgsPage() {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { memberships: true, opportunities: true, inefficiencies: true } },
      entitlements: true,
    },
  });
  return (
    <div>
      <h1 className="text-xl font-semibold">Organizations</h1>
      <div className="si-panel mt-4 overflow-hidden">
        <Table>
          <THead><TR><TH>Name</TH><TH>Slug</TH><TH>Members</TH><TH>Entitlements</TH><TH>Created</TH></TR></THead>
          <TBody>
            {orgs.map((o) => (
              <TR key={o.id}>
                <TD>{o.name} {o.isDemo ? <Badge tone="demo">DEMO</Badge> : null}</TD>
                <TD className="font-mono text-xs">{o.slug}</TD>
                <TD>{o._count.memberships}</TD>
                <TD className="text-xs">{o.entitlements.filter((e) => e.active).map((e) => e.product).join(", ") || "—"}</TD>
                <TD>{formatDate(o.createdAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
