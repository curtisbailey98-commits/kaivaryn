import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { email: true } }, organization: { select: { name: true } } },
  });
  return (
    <div>
      <h1 className="text-xl font-semibold">Audit log</h1>
      <div className="si-panel mt-4 overflow-hidden">
        <Table>
          <THead><TR><TH>When</TH><TH>Action</TH><TH>Actor</TH><TH>Org</TH><TH>Entity</TH></TR></THead>
          <TBody>
            {logs.map((l) => (
              <TR key={l.id}>
                <TD className="whitespace-nowrap text-xs">{formatDate(l.createdAt)}</TD>
                <TD className="font-mono text-xs">{l.action}</TD>
                <TD className="text-xs">{l.actor?.email || "—"}</TD>
                <TD className="text-xs">{l.organization?.name || "—"}</TD>
                <TD className="text-xs">{l.entityType || ""} {l.entityId?.slice(0, 8) || ""}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
