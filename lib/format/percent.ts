export function formatPercentAuto(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const pct = n <= 1.5 ? n * 100 : n;
  return `${pct.toFixed(2)}%`;
}
