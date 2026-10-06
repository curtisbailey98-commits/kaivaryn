/**
 * Route-independent core of the Square OAuth flow, so the rules are testable without HTTP:
 *  - only Admin/Owner (manage_settings) may connect; viewers/analysts/managers are refused
 *  - missing env → honest "not switched on yet", never a fake connection
 *  - state is bound to org + user + browser nonce and expires after 10 minutes
 */
import { can } from "@/lib/rbac";
import type { Role } from "@/lib/enums";
import { buildSquareAuthorizeUrl, getSquareConfig, type SquareConfig } from "./config";
import { signSquareState, verifySquareState } from "./state";
import { connectSquareFromCode } from "./connection";
import { syncSquareForOrg } from "./sync";

export const SQUARE_RETURN_PATH = "/app/integrations";

export type FlowCtx = { userId: string; organizationId: string | null; effectiveRole: Role } | null;

export function backTo(kind: "ok" | "error", msg: string) {
  return `${SQUARE_RETURN_PATH}?${kind}=1&msg=${encodeURIComponent(msg.slice(0, 240))}#square`;
}

export function canConnectSquare(role: Role | null | undefined) {
  return Boolean(role) && can(role as Role, "manage_settings");
}

export type StartResult = { kind: "redirect"; location: string; nonce?: string };

export function startSquareConnect(ctx: FlowCtx, cfgOverride?: SquareConfig | null): StartResult {
  if (!ctx) return { kind: "redirect", location: "/login" };
  if (!ctx.organizationId) return { kind: "redirect", location: "/app/onboarding" };
  if (!canConnectSquare(ctx.effectiveRole)) return { kind: "redirect", location: backTo("error", "Only an Owner or Admin can connect Square.") };
  const cfg = cfgOverride === undefined ? getSquareConfig() : cfgOverride;
  if (!cfg) return { kind: "redirect", location: backTo("error", "Square connection isn't switched on yet for Kaivaryn. Nothing was connected.") };
  const { state, nonce } = signSquareState(ctx.organizationId, ctx.userId);
  return { kind: "redirect", location: buildSquareAuthorizeUrl(cfg, state), nonce };
}

const STATE_ERRORS: Record<string, string> = {
  expired_state: "That Square sign-in link expired (10 minutes). Please press Connect Square again.",
  state_browser_mismatch: "That Square sign-in didn't start in this browser. Please press Connect Square again.",
  state_session_mismatch: "That Square sign-in was started by a different user or workspace. Nothing was connected.",
  invalid_state: "That Square sign-in couldn't be verified. Nothing was connected.",
};

export async function completeSquareCallback(params: {
  ctx: FlowCtx;
  code: string | null;
  state: string | null;
  error: string | null;
  cookieNonce: string | null;
  cfg?: SquareConfig | null;
  firstSyncPages?: number;
}): Promise<{ location: string; connected: boolean }> {
  const { ctx } = params;
  if (!ctx) return { location: "/login", connected: false };
  if (params.error) {
    return { location: backTo("error", params.error === "access_denied" ? "Square connection was cancelled — nothing was connected." : "Square didn't complete the connection. Nothing was connected."), connected: false };
  }
  if (!params.code || !params.state) return { location: backTo("error", "Square sent back an incomplete response. Nothing was connected."), connected: false };
  try {
    verifySquareState(params.state, params.cookieNonce, { organizationId: ctx.organizationId, userId: ctx.userId });
  } catch (e) {
    const key = e instanceof Error ? e.message : "invalid_state";
    return { location: backTo("error", STATE_ERRORS[key] ?? STATE_ERRORS.invalid_state), connected: false };
  }
  // Role re-checked at callback time (it may have changed during the 10-minute window).
  if (!canConnectSquare(ctx.effectiveRole)) return { location: backTo("error", "Only an Owner or Admin can connect Square."), connected: false };
  const cfg = params.cfg === undefined ? getSquareConfig() : params.cfg;
  if (!cfg) return { location: backTo("error", "Square connection isn't switched on yet for Kaivaryn. Nothing was connected."), connected: false };
  let merchant: string | null = null;
  try {
    const r = await connectSquareFromCode({ organizationId: ctx.organizationId as string, userId: ctx.userId, code: params.code, cfg });
    merchant = r.merchantName;
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return { location: backTo("error", m.startsWith("Square ") ? `${m}. Nothing was connected.` : "Square connection failed. Nothing was connected."), connected: false };
  }
  // Short first pull so numbers start arriving; the scheduled sync and "Sync now" continue from here.
  let note = "First sync will run within 15 minutes, or press Sync now.";
  try {
    const s = await syncSquareForOrg(ctx.organizationId as string, { pageBudget: params.firstSyncPages ?? 8, cfg });
    if (s.ok) note = s.complete ? `First sync done: ${s.created} records.` : `First sync started: ${s.created} records so far — the rest arrives over the next syncs.`;
  } catch {
    /* connection is saved; sync retries on the next tick */
  }
  return { location: backTo("ok", `Square connected${merchant ? ` (${merchant})` : ""}. ${note}`), connected: true };
}
