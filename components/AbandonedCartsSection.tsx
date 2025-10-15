'use client';

import { useMemo } from 'react';
import Badge from './Badge';
import AbandonedCartsTable from './AbandonedCartsTable';
import type { AbandonedCart } from '../lib/types';
import { getBadgeVariant } from '../lib/status';

type AbandonedCartsSectionProps = {
  carts: AbandonedCart[];
  expiredCount: number;
};

export default function AbandonedCartsSection({ carts, expiredCount }: AbandonedCartsSectionProps) {
  const abandonedCarts = useMemo(
    () => carts.filter((cart) => getBadgeVariant(cart.status) === 'abandoned'),
    [carts],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Eventos de abandono</h2>
        <Badge variant={expiredCount > 0 ? 'error' : 'pending'}>
          {expiredCount > 0 ? `${expiredCount} link(s) expirados` : 'Todos os links ativos'}
        </Badge>
      </div>

      <AbandonedCartsTable carts={abandonedCarts} sortMode="abandoned" visibleStatuses={['abandoned']} />
    </section>
  );
}
