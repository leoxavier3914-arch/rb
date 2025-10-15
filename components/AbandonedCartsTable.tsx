'use client';

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Badge, { type BadgeVariant } from './Badge';
import Table from './Table';
import Modal from './Modal';
import type {
  AbandonedCart,
  AbandonedCartHistoryEntry,
  AbandonedCartSnapshot,
  AbandonedCartUpdate,
} from '../lib/types';
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
  const [selectedHistoryKey, setSelectedHistoryKey] = useState<string | null>(null);
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);

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
    const historyEntries = cart.history ?? [];
    const fallbackHistoryKey = cart.cart_key ?? historyEntries[0]?.cartKey ?? null;
    setSelectedHistoryKey(fallbackHistoryKey);

    const activeHistory = historyEntries.find((entry) => entry.cartKey === fallbackHistoryKey);
    const updates = activeHistory?.updates ?? cart.updates ?? [];
    const latestUpdate = updates[updates.length - 1];
    setSelectedUpdateId(latestUpdate?.id ?? null);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedCart(null);
    setSelectedHistoryKey(null);
    setSelectedUpdateId(null);
  }, []);

  useEffect(() => {
    if (!selectedCart) {
      return;
    }

    const historyEntries = selectedCart.history ?? [];
    if (historyEntries.length === 0) {
      setSelectedHistoryKey(null);
      setSelectedUpdateId(null);
      return;
    }

    const availableHistoryKeys = new Set(historyEntries.map((entry) => entry.cartKey));
    const fallbackHistoryKey = selectedCart.cart_key ?? historyEntries[0]?.cartKey ?? null;

    if (!fallbackHistoryKey) {
      setSelectedHistoryKey(null);
      setSelectedUpdateId(null);
      return;
    }

    if (!selectedHistoryKey || !availableHistoryKeys.has(selectedHistoryKey)) {
      setSelectedHistoryKey(fallbackHistoryKey);
      setSelectedUpdateId(null);
      return;
    }

    const activeHistory = historyEntries.find((entry) => entry.cartKey === selectedHistoryKey);
    const updates = activeHistory?.updates ?? [];
    const fallbackUpdateId = updates[updates.length - 1]?.id ?? null;
    const availableUpdateIds = new Set(updates.map((update) => update.id));

    if (!selectedUpdateId || !availableUpdateIds.has(selectedUpdateId)) {
      setSelectedUpdateId(fallbackUpdateId);
    }
  }, [selectedCart, selectedHistoryKey, selectedUpdateId]);

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

  let modalContent: ReactNode = null;

  if (selectedCart) {
    const historyEntries = selectedCart.history ?? [];
    const fallbackHistoryKey = selectedCart.cart_key ?? historyEntries[0]?.cartKey ?? null;
    const availableHistoryKeys = new Set(historyEntries.map((entry) => entry.cartKey));
    const effectiveHistoryKey =
      (selectedHistoryKey && availableHistoryKeys.has(selectedHistoryKey)
        ? selectedHistoryKey
        : fallbackHistoryKey) ?? null;
    const activeHistory = historyEntries.find((entry) => entry.cartKey === effectiveHistoryKey);

    const updates = activeHistory?.updates ?? [];
    const latestUpdate = updates[updates.length - 1];
    const activeUpdateId = selectedUpdateId ?? latestUpdate?.id ?? null;
    const orderedUpdates = updates.length > 0 ? [...updates].reverse() : [];
    const selectedUpdate = updates.find((item) => item.id === activeUpdateId) ?? latestUpdate ?? null;
    const selectedSnapshot =
      selectedUpdate?.snapshot ?? activeHistory?.snapshot ?? toSnapshot(selectedCart);

    modalContent = (
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="space-y-6 lg:w-72 xl:w-80">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Carrinhos do cliente
            </h3>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {historyEntries.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum carrinho encontrado para o cliente.</p>
              ) : (
                historyEntries.map((entry) => (
                  <HistoryCheckoutListItem
                    key={entry.cartKey}
                    entry={entry}
                    active={entry.cartKey === effectiveHistoryKey}
                    isCurrent={entry.cartKey === selectedCart.cart_key}
                    onSelect={(key) => {
                      setSelectedHistoryKey(key);
                      setSelectedUpdateId(null);
                    }}
                  />
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Histórico do checkout selecionado
            </h3>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {orderedUpdates.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma atualização registrada.</p>
              ) : (
                orderedUpdates.map((update) => (
                  <UpdateListItem
                    key={update.id}
                    update={update}
                    active={update.id === activeUpdateId}
                    onSelect={(id) => setSelectedUpdateId(id)}
                  />
                ))
              )}
            </div>
          </section>
        </aside>

        <div className="flex-1 space-y-6">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Cliente</h3>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
              <DetailItem label="Nome" value={selectedSnapshot.customer_name ?? '—'} />
              <DetailItem label="E-mail" value={selectedSnapshot.customer_email} />
              <DetailItem label="Telefone" value={selectedSnapshot.customer_phone ?? '—'} />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Carrinho</h3>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
              <DetailItem label="Produto" value={selectedSnapshot.product_name ?? '—'} />
              <DetailItem label="ID do produto" value={selectedSnapshot.product_id ?? '—'} />
              <DetailItem
                label="Status"
                value={(() => {
                  const updateStatus = selectedUpdate?.status ?? selectedSnapshot.status;
                  const statusVariant = getBadgeVariant(updateStatus);
                  const statusLabel = STATUS_LABEL[statusVariant] ?? updateStatus;
                  return <Badge variant={statusVariant}>{statusLabel}</Badge>;
                })()}
              />
              <DetailItem label="Pago" value={selectedSnapshot.paid ? 'Sim' : 'Não'} />
              <DetailItem label="Checkout ID" value={selectedSnapshot.checkout_id ?? '—'} />
              <DetailItem label="Cupom" value={selectedSnapshot.discount_code ?? '—'} />
              <DetailItem label="Origem do tráfego" value={selectedSnapshot.traffic_source ?? '—'} />
              <DetailItem
                label="Link do checkout"
                value={
                  selectedSnapshot.checkout_url ? (
                    <a
                      href={selectedSnapshot.checkout_url}
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
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Atualização selecionada
            </h3>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
              <DetailItem label="Registrado em" value={formatDate(selectedUpdate?.timestamp)} />
              <DetailItem label="Criado em" value={formatDate(selectedSnapshot.created_at)} />
              <DetailItem label="Atualizado em" value={formatDate(selectedSnapshot.updated_at)} />
              <DetailItem label="Pago em" value={formatDate(selectedSnapshot.paid_at)} />
              <DetailItem label="Expira em" value={formatDate(selectedSnapshot.expires_at)} />
              <DetailItem label="Último evento" value={selectedSnapshot.last_event ?? '—'} />
              <DetailItem label="Fonte" value={selectedUpdate?.source ?? '—'} />
            </dl>
          </section>
        </div>
      </div>
    );
  }

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
        {modalContent}
      </Modal>
    </Fragment>
  );
}

type DetailItemProps = {
  label: string;
  value: ReactNode;
};

export function DetailItem({ label, value }: DetailItemProps) {
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

type HistoryCheckoutListItemProps = {
  entry: AbandonedCartHistoryEntry;
  active: boolean;
  isCurrent: boolean;
  onSelect: (key: string) => void;
};

export function HistoryCheckoutListItem({ entry, active, isCurrent, onSelect }: HistoryCheckoutListItemProps) {
  const handleSelect = useCallback(() => {
    onSelect(entry.cartKey);
  }, [entry.cartKey, onSelect]);

  const latestUpdate = entry.updates[entry.updates.length - 1];
  const snapshot = latestUpdate?.snapshot ?? entry.snapshot;
  const statusToken = latestUpdate?.status ?? snapshot.status;
  const statusVariant = getBadgeVariant(statusToken);
  const statusLabel = STATUS_LABEL[statusVariant] ?? statusToken;
  const timestamp = latestUpdate?.timestamp ?? snapshot.updated_at ?? snapshot.created_at;
  const paymentLabel = snapshot.paid ? 'Pagamento confirmado' : 'Sem pagamento registrado';
  const checkoutLabel = snapshot.checkout_id || snapshot.id;

  return (
    <button
      type="button"
      onClick={handleSelect}
      className={`w-full rounded-md border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-brand/60 ${
        active
          ? 'border-brand bg-brand/10 text-white shadow-sm'
          : 'border-slate-700 text-slate-200 hover:border-brand/60 hover:text-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-100">
            {checkoutLabel ? `Checkout ${checkoutLabel}` : 'Carrinho sem ID'}
          </span>
          <span className="text-xs text-slate-400">{formatDate(timestamp)}</span>
          <span className="text-xs text-slate-500">{paymentLabel}</span>
          <span className="text-[10px] uppercase tracking-widest text-slate-500">
            {entry.updates.length === 1
              ? '1 atualização registrada'
              : `${entry.updates.length} atualizações registradas`}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          {isCurrent ? (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-brand">
              Atual
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

type UpdateListItemProps = {
  update: AbandonedCartUpdate;
  active: boolean;
  onSelect: (id: string) => void;
};

export function UpdateListItem({ update, active, onSelect }: UpdateListItemProps) {
  const handleSelect = useCallback(() => {
    onSelect(update.id);
  }, [onSelect, update.id]);

  const statusVariant = getBadgeVariant(update.status ?? update.snapshot.status);
  const statusLabel = STATUS_LABEL[statusVariant] ?? update.status ?? update.snapshot.status;
  const timestamp = update.timestamp ?? update.snapshot.updated_at ?? update.snapshot.created_at;
  const paymentLabel = update.snapshot.paid ? 'Pagamento confirmado' : 'Pagamento pendente';

  return (
    <button
      type="button"
      onClick={handleSelect}
      className={`w-full rounded-md border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-brand/60 ${
        active
          ? 'border-brand bg-brand/10 text-white shadow-sm'
          : 'border-slate-700 text-slate-200 hover:border-brand/60 hover:text-white'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-100">{formatDate(timestamp)}</span>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>
      {update.event ? <p className="mt-1 text-xs text-slate-400">{update.event}</p> : null}
      <p className="mt-1 text-xs text-slate-500">{paymentLabel}</p>
      {update.source ? <p className="mt-1 text-xs text-slate-500">Fonte: {update.source}</p> : null}
    </button>
  );
}

const toSnapshot = (cart: AbandonedCart): AbandonedCartSnapshot => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { updates, history, cart_key, ...snapshot } = cart;
  return snapshot;
};
