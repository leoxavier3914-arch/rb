'use client';

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Badge, { type BadgeVariant } from './Badge';
import Table from './Table';
import Modal from './Modal';
import type { AbandonedCart } from '../lib/types';
import { formatSaoPaulo } from '../lib/dates';
import { getBadgeVariant, STATUS_LABEL } from '../lib/status';

export type AbandonedCartSortMode =
  | 'default'
  | 'approved'
  | 'new'
  | 'pending'
  | 'abandoned'
  | 'refused'
  | 'refunded';

type AbandonedCartsTableProps = {
  carts: AbandonedCart[];
  sortMode?: AbandonedCartSortMode;
  visibleStatuses?: BadgeVariant[];
};

const PAGE_SIZE = 20;
const STATUS_SEQUENCE = ['approved', 'new', 'pending', 'abandoned', 'refused', 'refunded', 'error'] as const;
const DEFAULT_VISIBLE_STATUSES: BadgeVariant[] = [
  'approved',
  'new',
  'pending',
  'abandoned',
  'refused',
  'refunded',
  'error',
];

const getTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
};

export default function AbandonedCartsTable({
  carts,
  sortMode = 'default',
  visibleStatuses,
}: AbandonedCartsTableProps) {
  const [data, setData] = useState<AbandonedCart[]>(carts);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);

  useEffect(() => {
    setData(carts);
    setCurrentPage(1);
  }, [carts]);

  const normalizedVisibleStatuses = useMemo(() => {
    const base = visibleStatuses && visibleStatuses.length > 0 ? visibleStatuses : DEFAULT_VISIBLE_STATUSES;
    const unique = new Set<BadgeVariant>(base);
    if (!unique.has('error')) {
      unique.add('error');
    }
    return Array.from(unique);
  }, [visibleStatuses]);

  const visibleStatusesKey = useMemo(
    () => normalizedVisibleStatuses.slice().sort().join('|'),
    [normalizedVisibleStatuses],
  );

  const handleOpenDetails = useCallback((cart: AbandonedCart) => {
    setSelectedCart(cart);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedCart(null);
  }, []);

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
      {
        key: 'actions',
        header: 'Ações',
        className: 'text-right',
        render: (item: AbandonedCart) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleOpenDetails(item);
            }}
            className="inline-flex items-center rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 sm:text-sm"
          >
            Ver detalhes
          </button>
        ),
      },
    ],
    [handleOpenDetails],
  );

  const filteredData = useMemo(() => {
    const visibleSet = new Set(normalizedVisibleStatuses);
    return data.filter((item) => visibleSet.has(getBadgeVariant(item.status)));
  }, [data, normalizedVisibleStatuses]);

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
      const variantA = getBadgeVariant(a.status);
      const variantB = getBadgeVariant(b.status);
      const orderA = statusOrder[variantA] ?? Number.POSITIVE_INFINITY;
      const orderB = statusOrder[variantB] ?? Number.POSITIVE_INFINITY;

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
  }, [sortMode, visibleStatusesKey]);

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
    <Fragment>
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
      <Modal
        open={Boolean(selectedCart)}
        onClose={handleCloseDetails}
        title={selectedCart ? `Detalhes de ${selectedCart.customer_name ?? selectedCart.customer_email}` : 'Detalhes do cliente'}
      >
        {selectedCart ? (
          <div className="space-y-6">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Cliente</h3>
              <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
                <DetailItem label="Nome" value={selectedCart.customer_name ?? '—'} />
                <DetailItem label="E-mail" value={selectedCart.customer_email} />
                <DetailItem label="Telefone" value={selectedCart.customer_phone ?? '—'} />
              </dl>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Carrinho</h3>
              <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
                <DetailItem label="Produto" value={selectedCart.product_name ?? '—'} />
                <DetailItem label="ID do produto" value={selectedCart.product_id ?? '—'} />
                <DetailItem
                  label="Status"
                  value={(() => {
                    const statusVariant = getBadgeVariant(selectedCart.status);
                    const statusLabel = STATUS_LABEL[statusVariant] ?? selectedCart.status;
                    return <Badge variant={statusVariant}>{statusLabel}</Badge>;
                  })()}
                />
                <DetailItem label="Pago" value={selectedCart.paid ? 'Sim' : 'Não'} />
                <DetailItem label="Checkout ID" value={selectedCart.checkout_id ?? '—'} />
                <DetailItem label="Cupom" value={selectedCart.discount_code ?? '—'} />
                <DetailItem label="Origem do tráfego" value={selectedCart.traffic_source ?? '—'} />
                <DetailItem
                  label="Link do checkout"
                  value={
                    selectedCart.checkout_url ? (
                      <a
                        href={selectedCart.checkout_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:underline"
                      >
                        Abrir checkout
                      </a>
                    ) : (
                      '—'
                    )
                  }
                />
              </dl>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Atualizações</h3>
              <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
                <DetailItem label="Criado em" value={formatDate(selectedCart.created_at)} />
                <DetailItem label="Atualizado em" value={formatDate(selectedCart.updated_at)} />
                <DetailItem label="Pago em" value={formatDate(selectedCart.paid_at)} />
                <DetailItem label="Expira em" value={formatDate(selectedCart.expires_at)} />
                <DetailItem label="Último evento" value={selectedCart.last_event ?? '—'} />
              </dl>
            </section>
          </div>
        ) : null}
      </Modal>
    </Fragment>
  );
}

type DetailItemProps = {
  label: string;
  value: ReactNode;
};

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <>
      <dt className="font-semibold text-slate-400">{label}</dt>
      <dd className="text-slate-100">{value}</dd>
    </>
  );
}

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }
  return formatSaoPaulo(value);
};
