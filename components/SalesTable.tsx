'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import Table from './Table';
import Badge from './Badge';
import { formatSaoPaulo } from '../lib/dates';
import type { Sale } from '../lib/types';
import {
  getTrafficCategory,
  getTrafficCategoryLabel,
  getOrganicPlatformDetail,
  type TrafficCategory,
} from '../lib/traffic';

type FilterKey = 'all' | TrafficCategory;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'organic', label: 'Orgânico' },
  { key: 'tiktok', label: 'TikTok Ads' },
  { key: 'other', label: 'Outros canais' },
];

type SalesTableProps = {
  sales: Sale[];
};

function formatTrafficSource(source: string | null): string {
  const trimmed = typeof source === 'string' ? source.trim() : '';
  if (!trimmed || trimmed.toLowerCase() === 'unknown') {
    return 'Outros canais';
  }

  const category = getTrafficCategory(trimmed);

  if (category === 'organic') {
    const platformDetail = getOrganicPlatformDetail(trimmed);

    if (platformDetail) {
      return `${getTrafficCategoryLabel(category)} / ${platformDetail}`;
    }

    return getTrafficCategoryLabel(category);
  }

  if (category === 'tiktok') {
    return getTrafficCategoryLabel(category);
  }

  return trimmed;
}

export default function SalesTable({ sales }: SalesTableProps) {
  const [filter, setFilter] = useState<FilterKey>('all');

  const counts = useMemo(() => {
    const initial: Record<FilterKey, number> = {
      all: sales.length,
      organic: 0,
      tiktok: 0,
      other: 0,
    };

    for (const sale of sales) {
      const category = getTrafficCategory(sale.traffic_source);
      initial[category] += 1;
    }

    return initial;
  }, [sales]);

  const filteredSales = useMemo(() => {
    if (filter === 'all') {
      return sales;
    }

    return sales.filter((sale) => getTrafficCategory(sale.traffic_source) === filter);
  }, [filter, sales]);

  const columns = useMemo(
    () => [
      {
        key: 'customer_email' as const,
        header: 'Cliente',
        render: (sale: Sale) => (
          <div className="flex flex-col">
            <span className="font-medium text-white">{sale.customer_name || '—'}</span>
            <span className="text-xs text-slate-400">{sale.customer_email || '—'}</span>
          </div>
        ),
      },
      {
        key: 'product_name' as const,
        header: 'Produto',
        render: (sale: Sale) => sale.product_name || '—',
      },
      {
        key: 'traffic_source' as const,
        header: 'Origem',
        render: (sale: Sale) => formatTrafficSource(sale.traffic_source),
      },
      {
        key: 'paid_at' as const,
        header: 'Pagamento',
        render: (sale: Sale) => formatSaoPaulo(sale.paid_at),
      },
      {
        key: 'status' as const,
        header: 'Status',
        className: 'hidden lg:table-cell',
        render: (sale: Sale) => <Badge variant="converted">{sale.status || 'Convertido'}</Badge>,
      },
    ],
    [],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Vendas aprovadas</h2>
          <p className="text-sm text-slate-400">
            Filtre as conversões por canal de origem para entender a performance de cada campanha.
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

      <Table<Sale>
        columns={columns}
        data={filteredSales}
        getRowKey={(sale) => sale.id}
        emptyMessage="Nenhuma venda encontrada para o filtro selecionado."
      />
    </section>
  );
}
