import { describe, expect, it } from 'vitest';
import { buildDateClause, parseDateFilters } from '@/lib/hub/filters';
import { createPeriodSearchParams, formatDate, formatDateEndOfDay, type CustomPeriod } from '@/lib/ui/date';

describe('buildDateClause', () => {
  it('keeps sales that happen at the end of the day within the range', () => {
    const baseDate = new Date('2024-05-01T12:00:00.000Z');
    const period: CustomPeriod = {
      from: formatDate(baseDate),
      to: formatDate(baseDate)
    };

    const params = createPeriodSearchParams(period, null);
    const expectedEndOfDay = formatDateEndOfDay(new Date(period.to));

    expect(params.get('date_to')).toBe(expectedEndOfDay);

    const filters = parseDateFilters(params);
    expect(filters.to?.toISOString()).toBe(expectedEndOfDay);

    const clause = buildDateClause(filters);
    expect(clause).toBe(
      `and(paid_at.gte.${period.from},paid_at.lte.${expectedEndOfDay}),and(paid_at.is.null,created_at.gte.${period.from},created_at.lte.${expectedEndOfDay})`
    );

    const saleAtEndOfDay = new Date('2024-05-01T23:59:00.000Z').getTime();
    expect(saleAtEndOfDay).toBeLessThanOrEqual(filters.to!.getTime());
  });
});
