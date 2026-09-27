import { createHash } from "crypto";

export function contentHash(value: unknown): string {
  const canonical = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(canonical).digest("hex");
}
