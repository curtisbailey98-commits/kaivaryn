import type { ConnectionMethod, IntakeKind, VendorGuide } from "./types";

/** Compact constructor for vendor guides. */
export const g = (
  key: string, method: ConnectionMethod, intake: IntakeKind, methodNote: string,
  prerequisites: string[], steps: string[], share: string[], exportFallback: string[], sourceUrl: string,
): VendorGuide => ({ key, method, intake, methodNote, prerequisites, steps, share, exportFallback, sourceUrl });
