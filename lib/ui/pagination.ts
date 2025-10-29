export function parsePositiveIntegerParam(
  value: string | string[] | undefined,
  fallback = 1
): number {
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}
