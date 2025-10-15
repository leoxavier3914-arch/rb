'use client';

import clsx from 'clsx';
import { useMemo, useState } from 'react';
import Badge, { type BadgeVariant } from './Badge';
import Table from './Table';
import type { DashboardSaleStatus, GroupedDashboardEvent } from '../lib/types';

export type DashboardEventsStatusFilter = 'all' | DashboardSaleStatus;

const statusLabels: Record<DashboardSaleStatus, string> = {
  approved: 'Aprovado',
  abandoned: 'Abandonado',
  refunded: 'Reembolsado',
  refused: 'Recusado',
  new: 'Novo',
};

const statusBadges: Record<DashboardSaleStatus, BadgeVariant> = {
  approved: 'approved',
  abandoned: 'abandoned',
  refunded: 'refunded',
  refused: 'refused',
  new: 'new',
};

const statusFilters: Array<{ value: DashboardEventsStatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'approved', label: 'Aprovados' },
  { value: 'abandoned', label: 'Abandonados' },
  { value: 'refunded', label: 'Reembolsados' },
  { value: 'refused', label: 'Recusados' },
  { value: 'new', label: 'Novos' },
];

const parseTimestamp = (value: string | null) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const time = Date.parse(value);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return '—';
  }

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch (error) {
    console.error('[kiwify-hub] data inválida', error);
    return value;
  }
};

export const filterDashboardEvents = (
  events: GroupedDashboardEvent[],
  filter: DashboardEventsStatusFilter,
) => {
  if (filter === 'all') {
    return events;
  }

  return events.filter((event) => event.status === filter);
};

const getLatestSourceLabel = (source: GroupedDashboardEvent['latest_timestamp_source']) => {
  switch (source) {
    case 'updated_at':
      return 'Atualizado em';
    case 'paid_at':
      return 'Pagamento em';
    case 'created_at':
      return 'Criado em';
    default:
      return 'Atualizado em';
  }
};

type DashboardEventsTableProps = {
  events: GroupedDashboardEvent[];
};

export default function DashboardEventsTable({ events }: DashboardEventsTableProps) {
  const [statusFilter, setStatusFilter] = useState<DashboardEventsStatusFilter>('all');

  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) => parseTimestamp(b.latest_timestamp) - parseTimestamp(a.latest_timestamp),
      ),
    [events],
  );

  const filteredEvents = useMemo(
    () => filterDashboardEvents(sortedEvents, statusFilter),
    [sortedEvents, statusFilter],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={clsx(
              'rounded-full border px-4 py-2 text-sm font-medium transition',
              statusFilter === filter.value
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <Table
        columns={[
          {
            key: 'customer',
            header: 'Cliente',
            className: 'w-[220px]',
            render: (event) => (
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">{event.customer_name || '—'}</span>
                <span className="text-xs text-slate-400">{event.customer_email}</span>
              </div>
            ),
          },
          {
            key: 'product',
            header: 'Produto',
            className: 'w-[220px]',
            render: (event) => (
              <div className="flex flex-col">
                <span className="text-sm text-white">{event.product_name || '—'}</span>
                {event.product_id ? (
                  <span className="text-xs text-slate-500">ID: {event.product_id}</span>
                ) : null}
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            className: 'w-[140px]',
            render: (event) => (
              <Badge variant={statusBadges[event.status]}>{statusLabels[event.status]}</Badge>
            ),
          },
          {
            key: 'latest_timestamp',
            header: 'Atualizado em',
            className: 'w-[160px]',
            render: (event) => (
              <div className="flex flex-col">
                <span className="text-sm text-white">{formatTimestamp(event.latest_timestamp)}</span>
                <span className="text-xs text-slate-500">
                  {getLatestSourceLabel(event.latest_timestamp_source)}
                </span>
              </div>
            ),
          },
          {
            key: 'last_event',
            header: 'Último evento',
            render: (event) => event.last_event || '—',
          },
        ]}
        data={filteredEvents}
        emptyMessage="Nenhum evento encontrado para o filtro selecionado."
        getRowKey={(event) => `${event.customer_email}-${event.product_id ?? event.product_name ?? event.id}`}
      />
    </div>
  );
}
