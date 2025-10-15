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
    switch (sortMode) {
      case 'converted':
        return {
          buttonLabel: 'Convertidos primeiro',
          buttonTitle: 'Ordenar com convertidos no topo, seguidos de pendentes e e-mails enviados.',
        };
      case 'new':
        return {
          buttonLabel: 'Novos primeiro',
          buttonTitle: 'Ordenar com os novos eventos no topo, seguidos de pendentes e e-mails enviados.',
        };
      case 'pending':
        return {
          buttonLabel: 'Pendentes primeiro',
          buttonTitle: 'Ordenar com pendentes no topo, seguidos de e-mails enviados e convertidos.',
        };
      case 'sent':
        return {
          buttonLabel: 'E-mails enviados primeiro',
          buttonTitle: 'Ordenar com e-mails enviados no topo, seguidos de convertidos e pendentes.',
        };
      default:
        return {
          buttonLabel: 'Ordenar por status',
          buttonTitle: 'Ordenar por status: convertidos, pendentes e e-mails enviados.',
        };
    }
  }, [sortMode]);

  const handleToggleSort = () => {
    setSortMode((current) => {
      const sequence: AbandonedCartSortMode[] = ['default', 'converted', 'new', 'pending', 'sent'];
      const currentIndex = sequence.indexOf(current);
      const nextIndex = currentIndex === -1 ? 1 : (currentIndex + 1) % sequence.length;
      return sequence[nextIndex];
    });
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
            aria-pressed={sortMode !== 'default'}
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
