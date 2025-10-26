'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import {
  Area as RechartsArea,
  AreaChart as RechartsAreaChart,
  CartesianGrid as RechartsCartesianGrid,
  Legend as RechartsLegend,
  ResponsiveContainer as RechartsResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePeriod } from '@/components/providers/PeriodProvider';
import { CardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/Skeletons';
import { formatMoneyFromCents } from '@/lib/ui/format';
import { createPeriodSearchParams, type CustomPeriod } from '@/lib/ui/date';

const AreaChart = RechartsAreaChart as unknown as ComponentType<any>;
const Area = RechartsArea as unknown as ComponentType<any>;
const CartesianGrid = RechartsCartesianGrid as unknown as ComponentType<any>;
const Legend = RechartsLegend as unknown as ComponentType<any>;
const ResponsiveContainer = RechartsResponsiveContainer as unknown as ComponentType<any>;
const Tooltip = RechartsTooltip as unknown as ComponentType<any>;
const XAxis = RechartsXAxis as unknown as ComponentType<any>;
const YAxis = RechartsYAxis as unknown as ComponentType<any>;

interface MetricResponse {
  readonly id: string;
  readonly label: string;
  readonly format: 'currency' | 'number';
  readonly current: number;
  readonly previous: number;
}

interface StatsResponse {
  readonly ok: true;
  readonly compare: boolean;
  readonly period: CustomPeriod;
  readonly metrics: readonly MetricResponse[];
  readonly series: {
    readonly current: readonly SeriesPoint[];
    readonly previous: readonly SeriesPoint[];
  };
}

interface TopProduct {
  readonly id: string;
  readonly title: string;
  readonly revenue_cents: number;
  readonly total_sales: number;
}

interface TopProductsResponse {
  readonly ok: true;
  readonly products: readonly TopProduct[];
}

interface SeriesPoint {
  readonly date: string;
  readonly gross_cents: number;
  readonly net_est_cents: number;
  readonly approved_count: number;
  readonly total_count: number;
}

interface ChartDatum {
  readonly label: string;
  readonly current: number;
  readonly previous: number | null;
}

function computeDelta(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default function DashboardPage() {
  const { range, preset, isPreset } = usePeriod();
  const params = useMemo(
    () => createPeriodSearchParams(range, isPreset ? preset : null, { compare: true }),
    [isPreset, preset, range]
  );

  const statsQuery = useQuery<StatsResponse, Error>({
    queryKey: ['hub-stats', params.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/hub/stats?${params.toString()}`, {
        headers: { 'x-admin-role': 'true' }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        const message = payload?.error ?? 'Erro ao carregar estatísticas.';
        throw new Error(message);
      }
      return payload as StatsResponse;
    },
    staleTime: 60_000,
    retry: false
  });

  const topProductsQuery = useQuery<TopProductsResponse, Error>({
    queryKey: ['hub-top-products', params.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/hub/top-products?${params.toString()}`, {
        headers: { 'x-admin-role': 'true' }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        const message = payload?.error ?? 'Erro ao carregar ranking de produtos.';
        throw new Error(message);
      }
      return payload as TopProductsResponse;
    },
    staleTime: 60_000,
    retry: false
  });

  const metrics = statsQuery.data?.metrics ?? [];
  const products = topProductsQuery.data?.products ?? [];
  const revenueSeries = useMemo(() => {
    if (!statsQuery.data?.series) {
      return [];
    }
    return buildRevenueSeries(
      statsQuery.data.series.current,
      statsQuery.data.series.previous,
      statsQuery.data.compare
    );
  }, [statsQuery.data]);
  const hasComparison = statsQuery.data?.compare && revenueSeries.some(point => point.previous !== null);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">
          Acompanhe resultados consolidados do período selecionado e descubra os produtos com melhor desempenho.
        </p>
      </header>

      {statsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : statsQuery.isError ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Não foi possível carregar as estatísticas.</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-600">{statsQuery.error.message}</CardContent>
        </Card>
      ) : metrics.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Nenhum dado para este período</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Assim que uma sincronização for concluída, as métricas aparecerão automaticamente por aqui.
            </p>
            <Button asChild className="mt-4" variant="secondary">
              <Link href="/config-sync">Sincronizar agora</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(metric => {
            const delta = computeDelta(metric.current, metric.previous);
            const currentValue =
              metric.format === 'currency'
                ? formatMoneyFromCents(metric.current)
                : metric.current.toLocaleString('pt-BR');
            const previousValue =
              metric.format === 'currency'
                ? formatMoneyFromCents(metric.previous)
                : metric.previous.toLocaleString('pt-BR');

            return (
              <StatCard
                key={metric.id}
                label={metric.label}
                value={currentValue}
                previousValue={previousValue}
                deltaPercent={statsQuery.data?.compare ? delta : null}
              />
            );
          })}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top produtos</CardTitle>
          </CardHeader>
          <CardContent>
            {topProductsQuery.isLoading ? (
              <TableSkeleton rows={5} />
            ) : topProductsQuery.isError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                {topProductsQuery.error.message}
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                Ainda não há vendas suficientes para ranquear produtos neste período.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map(product => (
                    <TableRow key={product.id}>
                      <TableCell>{product.title}</TableCell>
                      <TableCell className="text-right">{formatMoneyFromCents(product.revenue_cents)}</TableCell>
                      <TableCell className="text-right">{product.total_sales.toLocaleString('pt-BR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle>Comparativo visual</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 items-center justify-center">
            {statsQuery.isLoading ? (
              <ChartSkeleton />
            ) : revenueSeries.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                Ainda não há dados suficientes para montar o comparativo visual deste período.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <AreaChart data={revenueSeries} margin={{ left: 12, right: 12, top: 16, bottom: 8 }}>
                    <defs>
                      <linearGradient id="current-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="rgb(37 99 235)" stopOpacity={0.85} />
                        <stop offset="95%" stopColor="rgb(37 99 235)" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="previous-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="rgb(148 163 184)" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="rgb(148 163 184)" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(226 232 240)" />
                    <XAxis dataKey="label" stroke="rgb(100 116 139)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="rgb(100 116 139)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                      tickFormatter={(value: number) => formatCurrency(value)}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatMoneyFromValue(value), name]}
                      labelFormatter={label => `Dia ${label}`}
                      contentStyle={{ borderRadius: 12, borderColor: 'rgb(226 232 240)' }}
                    />
                    <Legend
                      formatter={(value: string) =>
                        value === 'current' ? 'Período atual' : 'Período anterior'
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="current"
                      name="Período atual"
                      stroke="rgb(37 99 235)"
                      fill="url(#current-fill)"
                      strokeWidth={2}
                    />
                    {hasComparison ? (
                      <Area
                        type="monotone"
                        dataKey="previous"
                        name="Período anterior"
                        stroke="rgb(148 163 184)"
                        fill="url(#previous-fill)"
                        strokeWidth={2}
                      />
                    ) : null}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function buildRevenueSeries(
  current: readonly SeriesPoint[],
  previous: readonly SeriesPoint[],
  compare: boolean
): ChartDatum[] {
  if (!current.length) {
    return [];
  }

  const formatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
  const sortedCurrent = [...current].sort((a, b) => a.date.localeCompare(b.date));
  const sortedPrevious = [...previous].sort((a, b) => a.date.localeCompare(b.date));
  const hasComparison = compare && sortedPrevious.length > 0;

  return sortedCurrent.map((point, index) => {
    const label = formatter.format(new Date(point.date));
    const previousPoint = hasComparison ? sortedPrevious[index] : undefined;
    return {
      label,
      current: Number((point.gross_cents / 100).toFixed(2)),
      previous:
        hasComparison && previousPoint
          ? Number((previousPoint.gross_cents / 100).toFixed(2))
          : null
    };
  });
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function formatMoneyFromValue(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
