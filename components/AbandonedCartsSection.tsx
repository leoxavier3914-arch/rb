'use client';

import { useEffect, useState } from 'react';
import Badge from './Badge';
import AbandonedCartsTable, {
  ABANDONED_CART_STATUS_FILTERS,
  type AbandonedCartStatusFilter,
} from './AbandonedCartsTable';
import type { AbandonedCart } from '../lib/types';

type AbandonedCartsSectionProps = {
  carts: AbandonedCart[];
  expiredCount: number;
};

const STATUS_LABELS: Record<AbandonedCartStatusFilter, string> = {
  new: 'Novos',
  abandoned: 'Abandonados',
  approved: 'Pagos',
  refused: 'Recusados',
};

export default function AbandonedCartsSection({ carts, expiredCount }: AbandonedCartsSectionProps) {
  const [selectedStatuses, setSelectedStatuses] = useState<AbandonedCartStatusFilter[]>(
    () => [...ABANDONED_CART_STATUS_FILTERS],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const stored = window.localStorage.getItem('abandoned-carts-status-filter');
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        if (parsed.includes('all')) {
          setSelectedStatuses([...ABANDONED_CART_STATUS_FILTERS]);
          return;
        }

        const isValidStatus = (value: unknown): value is AbandonedCartStatusFilter =>
          typeof value === 'string' &&
          (ABANDONED_CART_STATUS_FILTERS as readonly string[]).includes(value);

        const validStatuses = parsed.filter(isValidStatus);
        if (validStatuses.length > 0 || parsed.length === 0) {
          setSelectedStatuses(validStatuses);
        }
      }
    } catch (error) {
      console.error('Failed to read abandoned carts filter from localStorage', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem('abandoned-carts-status-filter', JSON.stringify(selectedStatuses));
  }, [selectedStatuses]);

  const isAllSelected = ABANDONED_CART_STATUS_FILTERS.every((status) =>
    selectedStatuses.includes(status),
  );

  const handleStatusChange = (status: AbandonedCartStatusFilter, checked: boolean) => {
    setSelectedStatuses((previous) => {
      if (checked) {
        const next = new Set(previous);
        next.add(status);
        return ABANDONED_CART_STATUS_FILTERS.filter((item) => next.has(item));
      }

      return previous.filter((item) => item !== status);
    });
  };

  const handleAllChange = (checked: boolean) => {
    setSelectedStatuses(checked ? [...ABANDONED_CART_STATUS_FILTERS] : []);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Eventos recebidos</h2>
        <Badge variant={expiredCount > 0 ? 'error' : 'pending'}>
          {expiredCount > 0 ? `${expiredCount} link(s) expirados` : 'Todos os links ativos'}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 sm:text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={(event) => handleAllChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand focus:ring-brand/70"
          />
          Todos
        </label>

        {ABANDONED_CART_STATUS_FILTERS.map((status) => {
          const isChecked = selectedStatuses.includes(status);

          return (
            <label key={status} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(event) => handleStatusChange(status, event.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand focus:ring-brand/70"
              />
              {STATUS_LABELS[status]}
            </label>
          );
        })}
      </div>

      <AbandonedCartsTable carts={carts} selectedStatuses={selectedStatuses} />
    </section>
  );
}
