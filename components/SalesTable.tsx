'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import Table from './Table';
import Badge from './Badge';
import { formatSaoPaulo } from '../lib/dates';
import { getBadgeVariant, STATUS_LABEL } from '../lib/status';
import type { DashboardSale, DashboardSaleStatus } from '../lib/types';
import { formatTrafficSourceLabel } from '../lib/traffic';

type FilterKey = 'all' | DashboardSaleStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'new', label: 'Carrinhos novos' },
  { key: 'abandoned', label: 'Carrinhos abandonados' },
  { key: 'approved', label: 'Vendas aprovadas' },
  { key: 'refused', label: 'Compras recusadas' },
];

type SalesTableProps = {
  sales: DashboardSale[];
};

export default function SalesTable({ sales }: SalesTableProps) {
  const [filter, setFilter] = useState<FilterKey>('all');

  const counts = useMemo(() => {
    const initial: Record<FilterKey, number> = {
      all: sales.length,
      approved: 0,
      refunded: 0,
      abandoned: 0,
      refused: 0,
      new: 0,
    };

    for (const sale of sales) {
      initial[sale.status] = (initial[sale.status] ?? 0) + 1;
    }

    return initial;
  }, [sales]);

  const filteredSales = useMemo(() => {
    if (filter === 'all') {
      return sales;
    }

    return sales.filter((sale) => sale.status === filter);
  }, [filter, sales]);

  const columns = useMemo(
    () => [
      {
        key: 'customer_email' as const,
        header: 'Cliente',
        render: (sale: DashboardSale) => {
          const variant = getBadgeVariant(sale.status ?? 'approved');
          return (
            <div className="flex flex-col gap-1">
              <span className="font-medium text-white">{sale.customer_name || '—'}</span>
              <span className="text-xs text-slate-400">{sale.customer_email || '—'}</span>
              {sale.customer_phone ? (
                <span className="text-xs text-slate-500">{sale.customer_phone}</span>
              ) : null}
              <span className="mt-1 inline-flex xl:hidden">
                <Badge variant={variant}>{STATUS_LABEL[variant] ?? sale.status}</Badge>
              </span>
            </div>
          );
        },
      },
      {
        key: 'product_name' as const,
        header: 'Produto',
        render: (sale: DashboardSale) => sale.product_name || '—',
      },
      {
        key: 'traffic_source' as const,
        header: 'Origem',
        render: (sale: DashboardSale) => formatTrafficSourceLabel(sale.traffic_source),
      },
      {
        key: 'created_at' as const,
        header: 'Criado',
        render: (sale: DashboardSale) => formatSaoPaulo(sale.created_at),
      },
      {
        key: 'paid_at' as const,
        header: 'Pago em',
        render: (sale: DashboardSale) => formatSaoPaulo(sale.paid_at),
      },
      {
        key: 'status' as const,
        header: 'Status',
        className: 'hidden xl:table-cell',
        render: (sale: DashboardSale) => {
          const normalizedStatus = (sale.status ?? 'approved').toLowerCase();
          const variant = getBadgeVariant(normalizedStatus);
          return <Badge variant={variant}>{STATUS_LABEL[variant] ?? sale.status}</Badge>;
        },
      },
    ],
    [],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Visão geral das vendas</h2>
          <p className="text-sm text-slate-400">
            Filtre as vendas por status para entender o desempenho de cada etapa da jornada de compra.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => {
          const isActive = filter === key;
          const count = counts[key] ?? 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={clsx(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition',
                isActive
                  ? 'border-brand bg-brand text-slate-950'
                  : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white',
              )}
              aria-pressed={isActive}
            >
              <span>{label}</span>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-200">{count}</span>
            </button>
          );
        })}
      </div>

      <Table<DashboardSale>
        columns={columns}
        data={filteredSales}
        getRowKey={(sale) => sale.id}
        emptyMessage="Nenhuma venda encontrada para o filtro selecionado."
      />
    </section>
  );
}
