/**
 * CHIEF privilege guardrails.
 * CHIEF (the foundry system) MUST NEVER self-grant unrestricted privileges.
 * Unrestricted / ADMIN tool scopes always require a human executive decision.
 */

export const RESTRICTED_TOOL_SCOPES = new Set(["ADMIN", "UNRESTRICTED", "CREDENTIAL", "PROD_MUTATE"]);

export const ALLOWED_SANDBOX_TOOLS = [
  { id: "org.metrics.read", scope: "READ", description: "Read aggregated org SaaS metrics" },
  { id: "acquisition.pipeline.read", scope: "READ", description: "Read acquisition pipeline counts" },
  { id: "platform.health.read", scope: "READ", description: "Read platform health signals" },
  { id: "audit.append", scope: "WRITE", description: "Append exec audit events" },
  { id: "agent.report.write", scope: "WRITE", description: "Write structured internal reports" },
] as const;

export type ToolRequest = { toolId: string; scope: string };

export function isUnrestrictedScope(scope: string): boolean {
  return RESTRICTED_TOOL_SCOPES.has(scope.toUpperCase());
}

export function assertNoSelfGrant(params: {
  requestedBy: "CHIEF" | "HUMAN";
  tools: ToolRequest[];
}): { allowed: ToolRequest[]; blocked: ToolRequest[]; selfGrantBlocked: boolean } {
  const allowed: ToolRequest[] = [];
  const blocked: ToolRequest[] = [];
  for (const t of params.tools) {
    if (isUnrestrictedScope(t.scope)) {
      if (params.requestedBy === "CHIEF") {
        blocked.push(t);
      } else {
        // Human may request, but still needs separate FoundryApproval
        allowed.push(t);
      }
    } else {
      allowed.push(t);
    }
  }
  return { allowed, blocked, selfGrantBlocked: blocked.length > 0 };
}

export function sanitizeToolsForAgent(tools: ToolRequest[]): ToolRequest[] {
  const allowIds = new Set<string>(ALLOWED_SANDBOX_TOOLS.map((t) => t.id));
  return tools.filter((t) => allowIds.has(t.toolId) && !isUnrestrictedScope(t.scope));
}
