'use client';

import { useMemo, useState } from 'react';
import Badge from './Badge';
import AbandonedCartsTable, { type AbandonedCartSortMode } from './AbandonedCartsTable';
import type { AbandonedCart } from '../lib/types';

type AbandonedCartsSectionProps = {
  carts: AbandonedCart[];
  expiredCount: number;
};

export default function AbandonedCartsSection({ carts, expiredCount }: AbandonedCartsSectionProps) {
  const [sortMode, setSortMode] = useState<AbandonedCartSortMode>('default');

  const { buttonLabel, buttonTitle } = useMemo(() => {
    if (sortMode === 'status') {
      return {
        buttonLabel: 'Ordenar por data',
        buttonTitle: 'Voltar a ordenar pelos eventos mais recentes.',
      };
    }

    return {
      buttonLabel: 'Ordenar por status',
      buttonTitle: 'Ordenar por status: enviados, pendentes e convertidos.',
    };
  }, [sortMode]);

  const handleToggleSort = () => {
    setSortMode((current) => (current === 'status' ? 'default' : 'status'));
  };

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
            aria-pressed={sortMode === 'status'}
          >
            {buttonLabel}
          </button>
        </div>
        <Badge variant={expiredCount > 0 ? 'error' : 'pending'}>
          {expiredCount > 0 ? `${expiredCount} link(s) expirados` : 'Todos os links ativos'}
        </Badge>
      </div>

      <AbandonedCartsTable carts={carts} sortMode={sortMode} />
    </section>
  );
}
