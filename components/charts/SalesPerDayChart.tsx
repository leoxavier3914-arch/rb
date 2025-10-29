'use client';

import { useMemo } from 'react';
import { DailySalesRow } from '@/lib/sales';
import { formatShortDate } from '@/lib/ui/format';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

interface SalesPerDayChartProps {
  readonly data: readonly DailySalesRow[];
  readonly currency?: string;
}

function formatCurrency(value: number, currency: string): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  });
}

interface ChartDatum {
  readonly date: string;
  readonly formattedDate: string;
  readonly netAmount: number;
}

const DEFAULT_CURRENCY = 'BRL';

export function SalesPerDayChart({ data, currency = DEFAULT_CURRENCY }: SalesPerDayChartProps) {
  const chartData = useMemo<ChartDatum[]>(
    () =>
      data.map(item => ({
        date: item.saleDate,
        formattedDate: formatShortDate(item.saleDate),
        netAmount: Math.max(0, item.netAmountCents) / 100
      })),
    [data]
  );

  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Nenhum dado disponível para o período.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="formattedDate"
          tickLine={false}
          axisLine={{ stroke: '#cbd5f5' }}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={value => formatCurrency(value as number, currency)}
          tickLine={false}
          axisLine={{ stroke: '#cbd5f5' }}
          width={100}
        />
        <Tooltip
          cursor={{ fill: 'rgba(148, 163, 184, 0.15)' }}
          formatter={value => formatCurrency(Number(value), currency)}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
        />
        <Bar dataKey="netAmount" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default SalesPerDayChart;
