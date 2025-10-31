import assert from 'node:assert/strict';
import { test } from 'node:test';

import { __testables as salesVolumeTestables } from '@/components/charts/SalesVolumePanel';
import { mapSalesPerDayData } from '@/components/charts/SalesPerDayChart';
import type { DailySalesRow } from '@/lib/sales';
import { formatShortDateUTC } from '@/lib/ui/format';

const REFUND_DAY = '2024-06-15';

function createNormalizedPoint(overrides?: Partial<{
  grossAmountCents: number;
  netAmountCents: number;
}>): unknown {
  const date = new Date(`${REFUND_DAY}T00:00:00Z`);

  return {
    date,
    isoDate: REFUND_DAY,
    grossAmountCents: overrides?.grossAmountCents ?? -1500,
    netAmountCents: overrides?.netAmountCents ?? -2000,
    totalSales: 1
  };
}

test('refund-dominated day surfaces as negative in sales volume charts', () => {
  const { buildDailyData, buildMonthlyData } = salesVolumeTestables;
  const date = new Date(`${REFUND_DAY}T00:00:00Z`);

  const dailyPoints = buildDailyData([createNormalizedPoint()] as any, date, date);
  assert.strictEqual(dailyPoints.length, 1);
  assert.strictEqual(dailyPoints[0]?.netAmount, -20);

  const dailyLabelFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC'
  });
  assert.strictEqual(dailyPoints[0]?.label, dailyLabelFormatter.format(date));

  const monthlyTotals = new Map<string, { netAmountCents: number; totalSales: number }>();
  monthlyTotals.set('2024-06', { netAmountCents: -2000, totalSales: 1 });

  const monthlyPoints = buildMonthlyData(monthlyTotals, date, date);
  assert.strictEqual(monthlyPoints.length, 1);
  assert.strictEqual(monthlyPoints[0]?.netAmount, -20);
  assert.strictEqual(monthlyPoints[0]?.label, 'Jun 24');
});

test('sales per day chart exposes negative values and preserves tooltip labels', () => {
  const dataset: DailySalesRow[] = [
    {
      saleDate: REFUND_DAY,
      totalSales: 0,
      grossAmountCents: -1500,
      netAmountCents: -2000
    }
  ];

  const chartData = mapSalesPerDayData(dataset);
  assert.strictEqual(chartData.length, 1);
  assert.strictEqual(chartData[0]?.netAmount, -20);
  assert.strictEqual(chartData[0]?.date, REFUND_DAY);
  assert.strictEqual(chartData[0]?.formattedDate, formatShortDateUTC(REFUND_DAY));
});
