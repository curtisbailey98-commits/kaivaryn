import { requireOrgAccess, assertOrgId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { decideApproval } from "../operations/actions";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const ctx = await requireOrgAccess();
  assertOrgId(ctx.organizationId);
  const approvals = await prisma.approvalRequest.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { requestedBy: { select: { email: true, name: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Approvals</h1>
      <p className="mt-2 text-sm text-neutral-400">
        SI-style gated decisions. Critical automation / integration gates require step-up confirmation.
        Approving does <strong className="text-neutral-200">not</strong> execute external actions.
      </p>
      {approvals.length === 0 ? (
        <EmptyState className="mt-8" title="No approval requests" />
      ) : (
        <ul className="mt-6 space-y-4">
          {approvals.map((a) => (
            <li key={a.id} className="si-panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={a.status === "PENDING" ? "warning" : a.status === "APPROVED" ? "success" : "default"}>
                  {a.status}
                </Badge>
                <Badge>{a.type}</Badge>
                <span className="text-sm font-medium">{a.title}</span>
              </div>
              {a.description ? <p className="mt-2 text-sm text-neutral-400">{a.description}</p> : null}
              <p className="mt-1 text-xs text-neutral-600">
                Requested by {a.requestedBy.name || a.requestedBy.email} · {formatDate(a.createdAt)}
              </p>
              {a.status === "PENDING" ? (
                <form
                  action={async (fd) => {
                    "use server";
                    await decideApproval(a.id, fd);
                  }}
                  className="mt-4 flex flex-wrap items-center gap-3"
                >
                  <label className="flex items-center gap-2 text-xs text-neutral-400">
                    <input type="checkbox" name="confirmStepUp" /> Step-up confirm (required for critical gates)
                  </label>
                  <input name="note" placeholder="Note" className="h-9 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm" />
                  <Button name="decision" value="APPROVED" type="submit" size="sm">Approve</Button>
                  <Button name="decision" value="REJECTED" type="submit" variant="outline" size="sm">Reject</Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
