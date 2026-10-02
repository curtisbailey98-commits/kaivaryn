/**
 * Return-path guard for operating-layer forms. Hidden "back" fields are client-controlled,
 * so only same-origin in-app paths under /app are honored (prevents open redirects).
 */
const IN_APP = /^\/app(\/[A-Za-z0-9\-_/]*)?(\?[^\s#]*)?(#[A-Za-z0-9\-_]*)?$/;

export function safeReturnPath(raw: unknown, fallback: string): string {
  const v = typeof raw === "string" ? raw : "";
  if (!v || v.startsWith("//") || v.includes("\\") || v.includes("..")) return fallback;
  return IN_APP.test(v) ? v : fallback;
}
