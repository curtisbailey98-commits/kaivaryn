import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { memberships: { include: { organization: true } } },
  });
  return (
    <div>
      <h1 className="text-xl font-semibold">Users</h1>
      <div className="si-panel mt-4 overflow-hidden">
        <Table>
          <THead><TR><TH>Email</TH><TH>Role</TH><TH>Orgs</TH><TH>Created</TH></TR></THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD>{u.email}</TD>
                <TD><Badge>{u.role}</Badge></TD>
                <TD className="text-xs">{u.memberships.map((m) => m.organization.name).join(", ") || "—"}</TD>
                <TD>{formatDate(u.createdAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
