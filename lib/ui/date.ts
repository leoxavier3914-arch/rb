export type PeriodPreset = 7 | 30 | 90;
export interface CustomPeriod {
  readonly from: string;
  readonly to: string;
}

export type PeriodValue = PeriodPreset | CustomPeriod;

const PRESET_TO_DAYS: Record<PeriodPreset, number> = {
  7: 7,
  30: 30,
  90: 90
};

export function isPresetPeriod(value: PeriodValue): value is PeriodPreset {
  return typeof value === 'number';
}

export function getPresetRange(preset: PeriodPreset, baseDate = new Date()): CustomPeriod {
  const days = PRESET_TO_DAYS[preset];
  const end = new Date(baseDate);
  const start = new Date(baseDate);
  start.setDate(start.getDate() - (days - 1));

  return {
    from: formatDate(start),
    to: formatDate(end)
  };
}

export function normalizeCustomPeriod(period: CustomPeriod): CustomPeriod {
  const from = new Date(period.from);
  const to = new Date(period.to);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    const fallback = getPresetRange(7);
    return fallback;
  }

  if (from > to) {
    return {
      from: formatDate(to),
      to: formatDate(from)
    };
  }

  return {
    from: formatDate(from),
    to: formatDate(to)
  };
}

export function formatDate(date: Date): string {
  const iso = new Date(date.getTime());
  iso.setHours(0, 0, 0, 0);
  return iso.toISOString();
}

export function diffInDays(period: CustomPeriod): number {
  const from = new Date(period.from);
  const to = new Date(period.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return 0;
  }
  const diffMs = to.getTime() - from.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

interface PeriodSearchOptions {
  readonly compare?: boolean;
}

export function createPeriodSearchParams(
  range: CustomPeriod,
  preset: PeriodPreset | null,
  options: PeriodSearchOptions = {}
): URLSearchParams {
  const params = new URLSearchParams();
  if (preset) {
    params.set('period', String(preset));
  } else {
    params.set('date_from', range.from);
    params.set('date_to', range.to);
  }

  if (options.compare) {
    params.set('compare', 'true');
  }

  return params;
}
