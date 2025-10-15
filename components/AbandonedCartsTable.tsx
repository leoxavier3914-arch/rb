'use client';

import { useEffect, useMemo, useState } from 'react';
import Badge from './Badge';
import Table from './Table';
import type { AbandonedCart } from '../lib/types';
import { formatSaoPaulo } from '../lib/dates';
import { getBadgeVariant, STATUS_LABEL } from '../lib/status';

export type AbandonedCartSortMode = 'default' | 'approved' | 'new' | 'pending' | 'abandoned' | 'refused';

export const ABANDONED_CART_STATUS_FILTERS = ['new', 'abandoned', 'approved', 'refused'] as const;
export type AbandonedCartStatusFilter = (typeof ABANDONED_CART_STATUS_FILTERS)[number];

type AbandonedCartsTableProps = {
  carts: AbandonedCart[];
  sortMode?: AbandonedCartSortMode;
  selectedStatuses?: AbandonedCartStatusFilter[];
};

const PAGE_SIZE = 20;
const STATUS_SEQUENCE = ['approved', 'new', 'pending', 'abandoned', 'refused', 'refunded'] as const;

const getTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
};

export default function AbandonedCartsTable({
  carts,
  sortMode = 'default',
  selectedStatuses,
}: AbandonedCartsTableProps) {
  const [data, setData] = useState<AbandonedCart[]>(carts);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setData(carts);
    setCurrentPage(1);
  }, [carts]);

  const columns = useMemo(
    () => [
      {
        key: 'customer_name' as const,
        header: 'Cliente',
        render: (item: AbandonedCart) => (
          <div className="flex flex-col">
            <span className="font-medium text-white">{item.customer_name ?? 'Nome não informado'}</span>
            <span className="text-xs text-slate-400">{item.customer_email}</span>
            {item.customer_phone ? (
              <span className="text-xs text-slate-500">{item.customer_phone}</span>
            ) : null}
          </div>
        ),
      },
      { key: 'product_name' as const, header: 'Produto', render: (i: AbandonedCart) => i.product_name ?? '—' },
      {
        key: 'status' as const,
        header: 'Status',
        render: (i: AbandonedCart) => {
          const variant = getBadgeVariant(i.status);
          return <Badge variant={variant}>{STATUS_LABEL[variant] ?? i.status}</Badge>;
        },
      },
      { key: 'discount_code' as const, header: 'Cupom', render: (i: AbandonedCart) => i.discount_code ?? '—' },
      {
        key: 'created_at' as const,
        header: 'Criado em',
        render: (i: AbandonedCart) => (i.created_at ? formatSaoPaulo(i.created_at) : '—'),
      },
      {
        key: 'updated_at' as const,
        header: 'Atualizado em',
        render: (i: AbandonedCart) => (i.updated_at ? formatSaoPaulo(i.updated_at) : '—'),
      },
    ],
    [],
  );

  const filteredData = useMemo(() => {
    if (!selectedStatuses) {
      return data;
    }

    if (selectedStatuses.length === 0) {
      return [];
    }

    if (selectedStatuses.length === ABANDONED_CART_STATUS_FILTERS.length) {
      return data;
    }

    const allowed = new Set(selectedStatuses);

    return data.filter((item) => allowed.has(item.status as AbandonedCartStatusFilter));
  }, [data, selectedStatuses]);

  const sortedData = useMemo(() => {
    if (sortMode === 'default') {
      return filteredData;
    }

    const startIndex = STATUS_SEQUENCE.indexOf(sortMode as (typeof STATUS_SEQUENCE)[number]);
    const sequence =
      startIndex === -1
        ? STATUS_SEQUENCE
        : [...STATUS_SEQUENCE.slice(startIndex), ...STATUS_SEQUENCE.slice(0, startIndex)];
    const statusOrder = Array.from(sequence).reduce((acc: Record<string, number>, status, index) => {
      acc[status] = index;
      return acc;
    }, {} as Record<string, number>);

    return [...filteredData].sort((a, b) => {
      const orderA = statusOrder[a.status] ?? Number.POSITIVE_INFINITY;
      const orderB = statusOrder[b.status] ?? Number.POSITIVE_INFINITY;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      const timeB = getTimestamp(b.updated_at ?? b.created_at);
      const timeA = getTimestamp(a.updated_at ?? a.created_at);
      return timeB - timeA;
    });
  }, [filteredData, sortMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortMode, selectedStatuses]);

  const totalItems = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return sortedData.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, sortedData]);

  const pageStart = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalItems === 0 ? 0 : Math.min(pageStart + paginatedData.length - 1, totalItems);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="space-y-4">
      <Table<AbandonedCart>
        columns={columns}
        data={paginatedData}
        getRowKey={(i) => i.id}
        emptyMessage="Nenhum evento encontrado. Aguarde o primeiro webhook da Kiwify."
      />

      <div className="flex flex-col items-center justify-between gap-2 text-xs text-slate-400 sm:flex-row sm:text-sm">
        <span>
          {totalItems === 0
            ? 'Nenhum registro disponível.'
            : `Exibindo ${pageStart}–${pageEnd} de ${totalItems} registros`}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePreviousPage}
            disabled={currentPage === 1 || totalItems === 0}
            className="inline-flex items-center rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            Anterior
          </button>
          <span className="font-semibold text-slate-300">
            {totalItems === 0 ? '—' : `Página ${currentPage} de ${totalPages}`}
          </span>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage === totalPages || totalItems === 0}
            className="inline-flex items-center rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
