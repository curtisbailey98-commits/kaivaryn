/**
 * SI connectors honesty: boolean / status flags only — never echo secrets.
 */
export type ConnectorHonesty = {
  provider: string;
  displayName: string;
  status: "AVAILABLE" | "CONNECTED" | "NEEDS_CONFIG" | "ERROR";
  configured: boolean;
  help?: string;
};

export function stripeLinkConfigured(link: string | null | undefined): boolean {
  return Boolean(link && link.includes("buy.stripe.com"));
}

export function smtpConfigured(): boolean {
  return Boolean(
    (process.env.SMTP_HOST || "").trim() &&
      (process.env.SMTP_USER || "").trim()
  );
}
