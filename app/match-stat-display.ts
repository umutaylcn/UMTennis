export const CAREER_METRICS = [
  { label: "aces", field: "aces", suffix: "", lowerIsBetter: false },
  { label: "doubleFaults", field: "double_faults", suffix: "", lowerIsBetter: true },
  { label: "serve", field: "service_points_won_pct", suffix: "%", lowerIsBetter: false },
  { label: "return", field: "return_points_won_pct", suffix: "%", lowerIsBetter: false },
  { label: "bpSaved", field: "break_points_saved_pct", suffix: "%", lowerIsBetter: false },
] as const;

export function formatMatchStat(value: number | null, suffix = "", decimals?: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${decimals === undefined ? value : value.toFixed(decimals)}${suffix}`;
}
