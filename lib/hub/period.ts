import { parseBooleanFlag } from '@/lib/utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWED_PERIODS = new Set([7, 30, 90]);

export interface PeriodWindow {
  readonly from: Date;
  readonly to: Date;
}

export interface PeriodSelection {
  readonly current: PeriodWindow;
  readonly previous: PeriodWindow | null;
  readonly compare: boolean;
}

export function resolvePeriod(params: URLSearchParams): PeriodSelection {
  const compare = parseBooleanFlag(params.get('compare') ?? undefined, false);
  const customFrom = parseDate(params.get('date_from'));
  const customTo = parseDate(params.get('date_to'));

  const now = new Date();
  let to = customTo ?? now;
  let from = customFrom ?? subtractDays(to, resolvePeriodLength(params));

  if (customFrom && !customTo) {
    to = now;
  }

  if (!customFrom && customTo) {
    from = subtractDays(to, resolvePeriodLength(params));
  }

  if (from > to) {
    const temp = from;
    from = to;
    to = temp;
  }

  const current: PeriodWindow = { from, to };
  let previous: PeriodWindow | null = null;

  if (compare) {
    const duration = Math.max(DAY_MS, to.getTime() - from.getTime());
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - duration);
    previous = { from: previousFrom, to: previousTo };
  }

  return { current, previous, compare };
}

function resolvePeriodLength(params: URLSearchParams): number {
  const raw = params.get('period');
  if (!raw) {
    return 7;
  }
  const parsed = Number.parseInt(raw, 10);
  if (ALLOWED_PERIODS.has(parsed)) {
    return parsed;
  }
  return 7;
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - Math.max(1, days - 1));
  return result;
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp);
}
