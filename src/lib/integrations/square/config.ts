/**
 * Square POS connection — configuration.
 * Code flow OAuth (confidential server client), read-only scopes, sandbox vs production base URLs.
 * Docs: https://developer.squareup.com/docs/oauth-api/overview
 *       https://developer.squareup.com/docs/oauth-api/create-urls-for-square-authorization
 */

export const SQUARE_PROVIDER = "pos_square";
export const SQUARE_SOURCE = "square";
/** Pinned Square API version (see the Square-Version header in the API reference). */
export const SQUARE_API_VERSION = "2026-09-16";
/** Least privilege, read-only. MERCHANT_PROFILE_READ = merchant + locations; ORDERS_READ = SearchOrders; PAYMENTS_READ = payments + refunds. */
export const SQUARE_SCOPES = ["MERCHANT_PROFILE_READ", "ORDERS_READ", "PAYMENTS_READ"] as const;
export const SQUARE_CALLBACK_PATH = "/api/integrations/square/callback";

export type SquareEnv = "sandbox" | "production";

export type SquareConfig = {
  appId: string;
  appSecret: string;
  env: SquareEnv;
  oauthBase: string;
  apiBase: string;
  redirectUri: string;
};

export type SquareConfigStatus =
  | { enabled: true; config: SquareConfig }
  | { enabled: false; reason: "missing_credentials" | "bad_environment" | "missing_base_url" | "environment_mismatch" };

export function squareBases(env: SquareEnv) {
  return env === "sandbox"
    ? { oauthBase: "https://connect.squareupsandbox.com/oauth2", apiBase: "https://connect.squareupsandbox.com/v2" }
    : { oauthBase: "https://connect.squareup.com/oauth2", apiBase: "https://connect.squareup.com/v2" };
}

export function appBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = (env.NEXTAUTH_URL || "").trim().replace(/\/$/, "");
  return raw ? raw : null;
}

/** Reads SQUARE_APP_ID / SQUARE_APP_SECRET / SQUARE_ENV. Missing anything → "not switched on yet" (never fake connected). */
export function squareConfigStatus(env: NodeJS.ProcessEnv = process.env): SquareConfigStatus {
  const appId = (env.SQUARE_APP_ID || "").trim();
  const appSecret = (env.SQUARE_APP_SECRET || "").trim();
  if (!appId || !appSecret) return { enabled: false, reason: "missing_credentials" };
  const rawEnv = (env.SQUARE_ENV || "production").trim().toLowerCase();
  if (rawEnv !== "sandbox" && rawEnv !== "production") return { enabled: false, reason: "bad_environment" };
  const sqEnv = rawEnv as SquareEnv;
  // Sandbox application IDs start with "sandbox-"; using one against production (or vice versa) always fails at Square.
  if ((sqEnv === "production") === appId.startsWith("sandbox-")) return { enabled: false, reason: "environment_mismatch" };
  const base = appBaseUrl(env);
  if (!base) return { enabled: false, reason: "missing_base_url" };
  return { enabled: true, config: { appId, appSecret, env: sqEnv, ...squareBases(sqEnv), redirectUri: `${base}${SQUARE_CALLBACK_PATH}` } };
}

export function getSquareConfig(env: NodeJS.ProcessEnv = process.env): SquareConfig | null {
  const s = squareConfigStatus(env);
  return s.enabled ? s.config : null;
}

/** Admin-facing explanation (never includes secret values). */
export function squareDisabledReasonText(reason: Exclude<SquareConfigStatus, { enabled: true }>["reason"]): string {
  switch (reason) {
    case "missing_credentials": return "Square app credentials (SQUARE_APP_ID, SQUARE_APP_SECRET) are not set on the server.";
    case "bad_environment": return "SQUARE_ENV must be “sandbox” or “production”.";
    case "environment_mismatch": return "The Square app ID doesn't match SQUARE_ENV (sandbox IDs start with “sandbox-”).";
    case "missing_base_url": return "The app's public URL (NEXTAUTH_URL) is not set, so Square has nowhere to send people back.";
  }
}

export function buildSquareAuthorizeUrl(cfg: SquareConfig, state: string): string {
  const url = new URL(`${cfg.oauthBase}/authorize`);
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("scope", SQUARE_SCOPES.join(" "));
  // Required for production so sellers with several Square accounts pick the right one; ignored in Sandbox.
  if (cfg.env === "production") url.searchParams.set("session", "false");
  url.searchParams.set("state", state);
  return url.toString();
}
