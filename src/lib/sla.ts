/**
 * Aging / SLA helpers for Action Center & Approvals.
 * Deterministic, no fabricated deadlines — buckets are operational chrome.
 */

export type SlaBucket = "fresh" | "watch" | "aging" | "breach";

export function ageDays(from: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86400000));
}

/** Default SLA: 2d fresh, 5d watch, 10d aging, 10d+ breach (approvals tighter). */
export function slaBucket(age: number, kind: "approval" | "work" = "work"): SlaBucket {
  if (kind === "approval") {
    if (age <= 1) return "fresh";
    if (age <= 3) return "watch";
    if (age <= 7) return "aging";
    return "breach";
  }
  if (age <= 3) return "fresh";
  if (age <= 7) return "watch";
  if (age <= 14) return "aging";
  return "breach";
}

export function slaLabel(bucket: SlaBucket): string {
  switch (bucket) {
    case "fresh":
      return "On track";
    case "watch":
      return "Watch";
    case "aging":
      return "Aging";
    case "breach":
      return "SLA risk";
  }
}

export function slaTone(bucket: SlaBucket): "default" | "info" | "warning" | "danger" | "success" {
  switch (bucket) {
    case "fresh":
      return "success";
    case "watch":
      return "info";
    case "aging":
      return "warning";
    case "breach":
      return "danger";
  }
}

export function agingBucketLabel(age: number): string {
  if (age <= 3) return "0–3d";
  if (age <= 7) return "4–7d";
  if (age <= 14) return "8–14d";
  if (age <= 30) return "15–30d";
  return "30d+";
}
