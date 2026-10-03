/** Shared Kaivaryn dark/glass chart tokens for Recharts. */

export const CHART = {
  amber: "#f59e0b",
  amberMuted: "rgba(245, 158, 11, 0.35)",
  emerald: "#3ddc97",
  emeraldMuted: "rgba(61, 220, 151, 0.35)",
  sky: "#38bdf8",
  silver: "#cbd5e1",
  rose: "#ff6b6b",
  violet: "#a78bfa",
  slate: "#737373",
  grid: "rgba(255,255,255,0.06)",
  axis: "#737373",
  tooltipBg: "rgba(10,10,10,0.95)",
  tooltipBorder: "rgba(255,255,255,0.1)",
  series: ["#f59e0b", "#3ddc97", "#38bdf8", "#a78bfa", "#ff6b6b", "#f472b6", "#94a3b8"],
} as const;

export const tooltipStyle = {
  contentStyle: {
    background: CHART.tooltipBg,
    border: `1px solid ${CHART.tooltipBorder}`,
    borderRadius: 10,
    fontSize: 12,
    color: "#f5f5f5",
    boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
  },
  labelStyle: { color: "#a3a3a3", marginBottom: 4 },
  itemStyle: { color: "#e5e5e5", padding: 0 },
  cursor: { fill: "rgba(245, 158, 11, 0.06)" },
} as const;

export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export function formatMoneyTick(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
