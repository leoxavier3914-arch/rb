'use client';

import { useMemo, useState } from 'react';
import Badge from './Badge';
import AbandonedCartsTable, { type AbandonedCartPriority } from './AbandonedCartsTable';
import type { AbandonedCart } from '../lib/types';
import { STATUS_LABEL } from '../lib/status';

const STATUS_SEQUENCE: AbandonedCartPriority[] = ['pending', 'converted', 'sent'];

type AbandonedCartsSectionProps = {
  carts: AbandonedCart[];
  expiredCount: number;
};

export default function AbandonedCartsSection({ carts, expiredCount }: AbandonedCartsSectionProps) {
  const [priorityIndex, setPriorityIndex] = useState<number>(-1);

  const priorityStatus = priorityIndex === -1 ? null : STATUS_SEQUENCE[priorityIndex];

  const { buttonLabel, buttonTitle, nextIndex } = useMemo(() => {
    const next = (priorityIndex + 1) % STATUS_SEQUENCE.length;
    const nextStatus = STATUS_SEQUENCE[next];

    if (!priorityStatus) {
      return {
        buttonLabel: 'Pendentes no topo',
        buttonTitle:
          'Clique para colocar os pendentes no topo da tabela. Clique novamente para alternar entre convertidos e enviados.',
        nextIndex: next,
      };
    }

    const label = STATUS_LABEL[priorityStatus];
    const nextLabel = STATUS_LABEL[nextStatus];

    return {
      buttonLabel: `${label} no topo`,
      buttonTitle: `Clique para priorizar ${nextLabel.toLowerCase()} na próxima visualização.`,
      nextIndex: next,
    };
  }, [priorityIndex, priorityStatus]);

  const handleTogglePriority = () => {
    setPriorityIndex(nextIndex);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Eventos recebidos</h2>
          <button
            type="button"
            onClick={handleTogglePriority}
            className="inline-flex items-center rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 sm:text-sm"
            title={buttonTitle}
            aria-pressed={priorityStatus ? true : false}
          >
            {buttonLabel}
          </button>
        </div>
        <Badge variant={expiredCount > 0 ? 'error' : 'pending'}>
          {expiredCount > 0 ? `${expiredCount} link(s) expirados` : 'Todos os links ativos'}
        </Badge>
      </div>

      <AbandonedCartsTable carts={carts} priorityStatus={priorityStatus} />
    </section>
  );
}
