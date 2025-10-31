'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

export interface SalesVolumePoint {
  readonly month: string;
  readonly label: string;
  readonly netAmount: number;
  readonly totalSales: number;
}

interface SalesVolumeChartProps {
  readonly data: readonly SalesVolumePoint[];
  readonly currency?: string;
}

const DEFAULT_CURRENCY = 'BRL';

function formatCurrency(value: number, currency: string): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  });
}

export function SalesVolumeChart({ data, currency = DEFAULT_CURRENCY }: SalesVolumeChartProps) {
  const chartData = useMemo<SalesVolumePoint[]>(
    () =>
      Array.from(data, item => ({
        ...item,
        netAmount: Number.isFinite(item.netAmount) ? item.netAmount : 0,
        totalSales: Number.isFinite(item.totalSales) ? item.totalSales : 0
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
      <AreaChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="volumeGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0231b1" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#0231b1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#cbd5f5' }} padding={{ left: 8, right: 8 }} />
        <YAxis
          tickFormatter={value => formatCurrency(value as number, currency)}
          tickLine={false}
          axisLine={{ stroke: '#cbd5f5' }}
          width={100}
        />
        <Tooltip
          cursor={{ stroke: '#0231b1', strokeWidth: 2, strokeDasharray: '4 4' }}
          contentStyle={{
            borderRadius: '12px',
            borderColor: '#cbd5f5',
            boxShadow: '0 12px 24px rgba(15, 23, 42, 0.1)'
          }}
          formatter={(value, _name, payload) => {
            const datum = payload && !Array.isArray(payload) ? (payload.payload as SalesVolumePoint) : undefined;
            const salesLabel = datum ? `${datum.totalSales} ${datum.totalSales === 1 ? 'venda' : 'vendas'}` : '';
            return [formatCurrency(Number(value), currency), salesLabel];
          }}
          labelFormatter={label => label as string}
        />
        <Area
          type="monotone"
          dataKey="netAmount"
          stroke="#0231b1"
          strokeWidth={3}
          fill="url(#volumeGradient)"
          name="Receita líquida"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default SalesVolumeChart;
