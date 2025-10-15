'use client';

import { useCallback, useMemo, useState } from 'react';
import Badge, { type BadgeVariant } from './Badge';
import AbandonedCartsTable, { type AbandonedCartSortMode } from './AbandonedCartsTable';
import type { AbandonedCart } from '../lib/types';

const STATUS_FILTERS: Array<{ value: BadgeVariant; label: string }> = [
  { value: 'approved', label: 'Aprovado' },
  { value: 'abandoned', label: 'Abandonado' },
  { value: 'refused', label: 'Recusado' },
  { value: 'refunded', label: 'Reembolsado' },
  { value: 'new', label: 'Novo' },
  { value: 'pending', label: 'Pendente' },
];

type AbandonedCartsSectionProps = {
  carts: AbandonedCart[];
  expiredCount: number;
};

export default function AbandonedCartsSection({ carts, expiredCount }: AbandonedCartsSectionProps) {
  const [sortMode, setSortMode] = useState<AbandonedCartSortMode>('default');
  const [statusFilters, setStatusFilters] = useState<Set<BadgeVariant>>(
    () => new Set(STATUS_FILTERS.map((status) => status.value)),
  );

  const { buttonLabel, buttonTitle } = useMemo(() => {
    switch (sortMode) {
      case 'approved':
        return {
          buttonLabel: 'Pagos primeiro',
          buttonTitle: 'Ordenar com pagamentos aprovados no topo, seguidos de pendentes e abandonados.',
        };
      case 'new':
        return {
          buttonLabel: 'Novos primeiro',
          buttonTitle: 'Ordenar com os novos eventos no topo, seguidos de pendentes e pagos.',
        };
      case 'pending':
        return {
          buttonLabel: 'Pendentes primeiro',
          buttonTitle: 'Ordenar com pendentes no topo, seguidos de pagamentos aprovados.',
        };
      case 'abandoned':
        return {
          buttonLabel: 'Abandonados primeiro',
          buttonTitle: 'Ordenar com carrinhos abandonados no topo, seguidos dos demais status.',
        };
      case 'refused':
        return {
          buttonLabel: 'Recusados primeiro',
          buttonTitle: 'Ordenar com pagamentos recusados no topo.',
        };
      case 'refunded':
        return {
          buttonLabel: 'Reembolsados primeiro',
          buttonTitle: 'Ordenar com pagamentos reembolsados no topo, seguidos dos demais status.',
        };
      default:
        return {
          buttonLabel: 'Ordenar por status',
          buttonTitle: 'Ordenar por status: pagos, novos, pendentes, abandonados, recusados e reembolsados.',
        };
    }
  }, [sortMode]);

  const handleToggleSort = () => {
    setSortMode((current) => {
      const sequence: AbandonedCartSortMode[] = [
        'default',
        'approved',
        'new',
        'pending',
        'abandoned',
        'refused',
        'refunded',
      ];
      const currentIndex = sequence.indexOf(current);
      const nextIndex = currentIndex === -1 ? 1 : (currentIndex + 1) % sequence.length;
      return sequence[nextIndex];
    });
  };

  const handleStatusFilterChange = useCallback((status: BadgeVariant) => {
    setStatusFilters((current) => {
      const next = new Set(current);
      if (next.has(status)) {
        if (next.size === 1) {
          return current;
        }
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const activeStatuses = useMemo(() => {
    const base = new Set(statusFilters);
    base.add('error');
    return Array.from(base) as BadgeVariant[];
  }, [statusFilters]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Eventos recebidos</h2>
          <button
            type="button"
            onClick={handleToggleSort}
            className="inline-flex items-center rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 sm:text-sm"
            title={buttonTitle}
            aria-pressed={sortMode !== 'default'}
          >
            {buttonLabel}
          </button>
        </div>
        <Badge variant={expiredCount > 0 ? 'error' : 'pending'}>
          {expiredCount > 0 ? `${expiredCount} link(s) expirados` : 'Todos os links ativos'}
        </Badge>
      </div>

      <fieldset className="flex flex-wrap gap-3 rounded-lg border border-slate-800/60 bg-slate-900/40 p-3">
        <legend className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Filtrar por status
        </legend>
        {STATUS_FILTERS.map((status) => {
          const isChecked = statusFilters.has(status.value);
          return (
            <label key={status.value} className="flex items-center gap-2 text-xs text-slate-300 sm:text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-brand focus:ring-brand/70"
                checked={isChecked}
                onChange={() => handleStatusFilterChange(status.value)}
              />
              {status.label}
            </label>
          );
        })}
      </fieldset>

      <AbandonedCartsTable carts={carts} sortMode={sortMode} visibleStatuses={activeStatuses} />
    </section>
  );
}
