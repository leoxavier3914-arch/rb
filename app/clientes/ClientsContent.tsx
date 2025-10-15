'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';
import {
  DetailItem,
  HistoryCheckoutListItem,
  UpdateListItem,
} from '../../components/AbandonedCartsTable';
import { formatSaoPaulo } from '../../lib/dates';
import { STATUS_LABEL, getBadgeVariant } from '../../lib/status';
import type {
  AbandonedCartHistoryEntry,
  AbandonedCartSnapshot,
  AbandonedCartUpdate,
  CustomerCheckoutAggregate,
  Sale,
} from '../../lib/types';

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const matchesSearch = (client: CustomerCheckoutAggregate, query: string) => {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }

  const name = client.name ? normalizeText(client.name) : '';
  const email = normalizeText(client.email);

  if (name.includes(normalizedQuery) || email.includes(normalizedQuery)) {
    return true;
  }

  for (const sale of client.approvedSales) {
    const product = sale.product_name ? normalizeText(sale.product_name) : '';
    if (product.includes(normalizedQuery)) {
      return true;
    }
  }

  for (const entry of client.history) {
    const product = entry.snapshot.product_name ? normalizeText(entry.snapshot.product_name) : '';
    if (product.includes(normalizedQuery)) {
      return true;
    }
  }

  return false;
};

const getHistoryEntryTimestamp = (entry: AbandonedCartHistoryEntry) => {
  const updates = entry?.updates ?? [];
  const latestUpdate = updates[updates.length - 1];
  const candidates = [
    latestUpdate?.timestamp,
    latestUpdate?.snapshot.updated_at,
    latestUpdate?.snapshot.created_at,
    entry?.snapshot.updated_at,
    entry?.snapshot.created_at,
  ];

  let latest = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const time = Date.parse(candidate);
    if (!Number.isNaN(time) && time > latest) {
      latest = time;
    }
  }

  return latest;
};

const getLatestPaidAtTimestamp = (sales: Sale[]) =>
  sales.reduce((acc, sale) => {
    if (!sale.paid_at) {
      return acc;
    }
    const time = Date.parse(sale.paid_at);
    if (Number.isNaN(time)) {
      return acc;
    }
    return time > acc ? time : acc;
  }, Number.NEGATIVE_INFINITY);

const getLatestCheckoutTimestamp = (client: CustomerCheckoutAggregate) => {
  const latestSale = getLatestPaidAtTimestamp(client.approvedSales);
  const latestHistory = client.history.reduce((acc, entry) => {
    const time = getHistoryEntryTimestamp(entry);
    return time > acc ? time : acc;
  }, Number.NEGATIVE_INFINITY);

  return Math.max(latestSale, latestHistory);
};

const getUniqueProducts = (sales: Sale[]) => {
  const unique = new Set<string>();
  for (const sale of sales) {
    unique.add(sale.product_name ?? 'Produto não informado');
  }
  return Array.from(unique);
};

const formatDate = (value: string | null | undefined) => (value ? formatSaoPaulo(value) : '—');

const createHistoryEntryFromSale = (sale: Sale): AbandonedCartHistoryEntry => {
  const canonicalId = sale.id.trim() || sale.id;
  const createdAt = sale.created_at ?? sale.paid_at ?? sale.updated_at ?? null;
  const updatedAt = sale.updated_at ?? sale.paid_at ?? sale.created_at ?? null;
  const baseSnapshot: AbandonedCartSnapshot = {
    id: canonicalId,
    checkout_id: canonicalId,
    customer_email: sale.customer_email,
    customer_name: sale.customer_name,
    customer_phone: sale.customer_phone,
    product_name: sale.product_name,
    product_id: sale.product_id,
    status: sale.status,
    paid: sale.status === 'approved',
    paid_at: sale.paid_at,
    discount_code: null,
    expires_at: null,
    last_event: sale.status === 'approved' ? 'Pagamento aprovado' : 'Pedido reembolsado',
    created_at: createdAt,
    updated_at: updatedAt,
    checkout_url: sale.checkout_url,
    traffic_source: sale.traffic_source,
  };

  const updates: AbandonedCartUpdate[] = [];

  if (createdAt) {
    updates.push({
      id: `sale:${canonicalId}:new`,
      timestamp: createdAt,
      status: 'new',
      event: 'Checkout criado',
      source: 'sale',
      snapshot: {
        ...baseSnapshot,
        status: 'new',
        paid: false,
        paid_at: null,
        updated_at: createdAt,
        last_event: 'Checkout criado',
      },
    });
  }

  if (sale.paid_at) {
    updates.push({
      id: `sale:${canonicalId}:approved`,
      timestamp: sale.paid_at,
      status: 'approved',
      event: 'Pagamento aprovado',
      source: 'sale',
      snapshot: {
        ...baseSnapshot,
        status: 'approved',
        paid: true,
        paid_at: sale.paid_at,
        updated_at: sale.paid_at,
        last_event: 'Pagamento aprovado',
      },
    });
  }

  if (sale.status === 'refunded') {
    const refundedAt = sale.updated_at ?? sale.paid_at ?? createdAt;
    if (refundedAt) {
      updates.push({
        id: `sale:${canonicalId}:refunded`,
        timestamp: refundedAt,
        status: 'refunded',
        event: 'Pedido reembolsado',
        source: 'sale',
        snapshot: {
          ...baseSnapshot,
          status: 'refunded',
          paid: false,
          paid_at: sale.paid_at,
          updated_at: refundedAt,
          last_event: 'Pedido reembolsado',
        },
      });
    }
  }

  if (updates.length === 0) {
    updates.push({
      id: `sale:${canonicalId}`,
      timestamp: updatedAt,
      status: sale.status,
      event: baseSnapshot.last_event,
      source: 'sale',
      snapshot: baseSnapshot,
    });
  }

  updates.sort((a, b) => {
    const timeA = a.timestamp ? Date.parse(a.timestamp) : Number.NEGATIVE_INFINITY;
    const timeB = b.timestamp ? Date.parse(b.timestamp) : Number.NEGATIVE_INFINITY;
    return timeA - timeB;
  });

  return {
    cartKey: `sale:${canonicalId}`,
    snapshot: baseSnapshot,
    updates,
  };
};

const buildCombinedHistoryEntries = (
  client: CustomerCheckoutAggregate,
): AbandonedCartHistoryEntry[] => {
  const entriesByKey = new Map<string, AbandonedCartHistoryEntry>();

  for (const entry of client.history) {
    if (!entry?.cartKey) {
      continue;
    }
    entriesByKey.set(entry.cartKey, entry);
  }

  for (const sale of client.approvedSales) {
    if (!sale.id) {
      continue;
    }

    const hasMatchingHistory = Array.from(entriesByKey.values()).some((entry) => {
      const snapshot = entry.snapshot;
      const snapshotId = snapshot.checkout_id ?? snapshot.id;
      if (!snapshotId) {
        return false;
      }

      const normalizedSnapshotId =
        typeof snapshotId === 'string' ? snapshotId.trim() : String(snapshotId).trim();
      const normalizedSaleId = sale.id.trim() || sale.id;

      return normalizedSnapshotId ? normalizedSnapshotId === normalizedSaleId : false;
    });

    if (hasMatchingHistory) {
      continue;
    }

    const syntheticEntry = createHistoryEntryFromSale(sale);
    entriesByKey.set(syntheticEntry.cartKey, syntheticEntry);
  }

  const merged = Array.from(entriesByKey.values());
  merged.sort((a, b) => {
    const diff = getHistoryEntryTimestamp(b) - getHistoryEntryTimestamp(a);
    if (diff !== 0) {
      return diff;
    }
    return a.cartKey.localeCompare(b.cartKey);
  });

  return merged;
};

type ClientsContentProps = {
  clients: CustomerCheckoutAggregate[];
};

export default function ClientsContent({ clients }: ClientsContentProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<CustomerCheckoutAggregate | null>(null);
  const [selectedHistoryKey, setSelectedHistoryKey] = useState<string | null>(null);
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);

  const filteredClients = useMemo(
    () => clients.filter((client) => matchesSearch(client, searchQuery)),
    [clients, searchQuery],
  );

  const sortedClients = useMemo(
    () =>
      filteredClients
        .slice()
        .sort((a, b) => getLatestCheckoutTimestamp(b) - getLatestCheckoutTimestamp(a)),
    [filteredClients],
  );

  const handleOpenDetails = useCallback((client: CustomerCheckoutAggregate) => {
    setSelectedClient(client);
    setSelectedHistoryKey(null);
    setSelectedUpdateId(null);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedClient(null);
    setSelectedHistoryKey(null);
    setSelectedUpdateId(null);
  }, []);

  const historyEntries = useMemo(
    () => (selectedClient ? buildCombinedHistoryEntries(selectedClient) : []),
    [selectedClient],
  );

  useEffect(() => {
    if (!selectedClient) {
      setSelectedHistoryKey(null);
      setSelectedUpdateId(null);
      return;
    }

    if (historyEntries.length === 0) {
      setSelectedHistoryKey(null);
      setSelectedUpdateId(null);
      return;
    }

    const availableKeys = new Set(historyEntries.map((entry) => entry.cartKey));
    const fallbackKey = historyEntries[0]?.cartKey ?? null;

    if (!fallbackKey) {
      setSelectedHistoryKey(null);
      setSelectedUpdateId(null);
      return;
    }

    if (!selectedHistoryKey || !availableKeys.has(selectedHistoryKey)) {
      setSelectedHistoryKey(fallbackKey);
      const fallbackEntry = historyEntries.find((entry) => entry.cartKey === fallbackKey);
      const fallbackUpdates = fallbackEntry?.updates ?? [];
      const fallbackUpdateId = fallbackUpdates[fallbackUpdates.length - 1]?.id ?? null;
      setSelectedUpdateId(fallbackUpdateId);
      return;
    }

    const activeEntry = historyEntries.find((entry) => entry.cartKey === selectedHistoryKey);
    const updates = activeEntry?.updates ?? [];
    if (updates.length === 0) {
      setSelectedUpdateId(null);
      return;
    }

    const availableUpdateIds = new Set(updates.map((update) => update.id));
    if (!selectedUpdateId || !availableUpdateIds.has(selectedUpdateId)) {
      const fallbackUpdateId = updates[updates.length - 1]?.id ?? null;
      setSelectedUpdateId(fallbackUpdateId);
    }
  }, [historyEntries, selectedClient, selectedHistoryKey, selectedUpdateId]);

  const activeHistory = useMemo(
    () => historyEntries.find((entry) => entry.cartKey === selectedHistoryKey) ?? null,
    [historyEntries, selectedHistoryKey],
  );

  const updates = activeHistory?.updates ?? [];
  const orderedUpdates = useMemo(
    () => (updates.length > 0 ? [...updates].reverse() : []),
    [updates],
  );

  const selectedUpdate = useMemo(() => {
    if (updates.length === 0) {
      return null;
    }
    if (!selectedUpdateId) {
      return updates[updates.length - 1];
    }
    return updates.find((update) => update.id === selectedUpdateId) ?? updates[updates.length - 1];
  }, [updates, selectedUpdateId]);

  const selectedSnapshot = selectedUpdate?.snapshot ?? activeHistory?.snapshot ?? null;

  const columns = useMemo(
    () => [
      {
        key: 'cliente',
        header: 'Cliente',
        render: (item: CustomerCheckoutAggregate) => (
          <div className="flex flex-col">
            <span className="font-medium text-white">{item.name ?? 'Cliente sem nome'}</span>
            <span className="text-xs text-slate-400">
              {item.history.length === 1
                ? '1 checkout registrado'
                : `${item.history.length} checkouts registrados`}
            </span>
          </div>
        ),
      },
      {
        key: 'email',
        header: 'E-mail',
        render: (item: CustomerCheckoutAggregate) => (
          <span className="text-sm text-slate-200">{item.email}</span>
        ),
      },
      {
        key: 'phone',
        header: 'Telefone',
        render: (item: CustomerCheckoutAggregate) => item.phone ?? '—',
      },
      {
        key: 'orders',
        header: 'Total de pedidos',
        render: (item: CustomerCheckoutAggregate) => item.approvedSales.length,
      },
      {
        key: 'products',
        header: 'Produtos comprados',
        render: (item: CustomerCheckoutAggregate) => {
          const products = getUniqueProducts(item.approvedSales);
          if (products.length === 0) {
            return '—';
          }
          const [first, second, third, ...rest] = products;
          if (!second) {
            return first;
          }
          if (!third) {
            return `${first}, ${second}`;
          }
          const remaining = rest.length;
          return remaining > 0
            ? `${first}, ${second}, ${third} e +${remaining}`
            : `${first}, ${second}, ${third}`;
        },
      },
      {
        key: 'lastPayment',
        header: 'Último pagamento',
        render: (item: CustomerCheckoutAggregate) => {
          const timestamp = getLatestPaidAtTimestamp(item.approvedSales);
          if (timestamp === Number.NEGATIVE_INFINITY) {
            return '—';
          }
          return formatSaoPaulo(new Date(timestamp).toISOString());
        },
      },
      {
        key: 'actions',
        header: ' ',
        className: 'text-right',
        render: (item: CustomerCheckoutAggregate) => (
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

  let modalContent = null;

  if (selectedClient) {
    const approvedSales = selectedClient.approvedSales;

    modalContent = (
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="space-y-6 lg:w-72 xl:w-80">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Checkouts do cliente
            </h3>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {historyEntries.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum checkout registrado.</p>
              ) : (
                historyEntries.map((entry) => (
                  <HistoryCheckoutListItem
                    key={entry.cartKey}
                    entry={entry}
                    active={entry.cartKey === selectedHistoryKey}
                    isCurrent={false}
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
                    active={update.id === selectedUpdateId}
                    onSelect={(id) => setSelectedUpdateId(id)}
                  />
                ))
              )}
            </div>
          </section>
        </aside>

        <div className="flex-1 space-y-6">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Pedidos aprovados
            </h3>
            <div className="mt-3 space-y-3">
              {approvedSales.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum pagamento aprovado registrado.</p>
              ) : (
                approvedSales.map((sale) => (
                  <article
                    key={sale.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-200"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium text-white">
                        {sale.product_name ?? 'Produto não informado'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDate(sale.paid_at)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>Status: {sale.status === 'approved' ? 'Aprovado' : 'Reembolsado'}</span>
                      {sale.checkout_url ? (
                        <a
                          href={sale.checkout_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand hover:underline"
                        >
                          Abrir checkout
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Cliente</h3>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
              <DetailItem label="Nome" value={selectedClient.name ?? '—'} />
              <DetailItem label="E-mail" value={selectedClient.email} />
              <DetailItem label="Telefone" value={selectedClient.phone ?? '—'} />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Checkout</h3>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
              <DetailItem label="Produto" value={selectedSnapshot?.product_name ?? '—'} />
              <DetailItem label="ID do produto" value={selectedSnapshot?.product_id ?? '—'} />
              <DetailItem
                label="Status"
                value={(() => {
                  if (!selectedSnapshot) {
                    return '—';
                  }
                  const statusVariant = getBadgeVariant(selectedSnapshot.status);
                  const statusLabel = STATUS_LABEL[statusVariant] ?? selectedSnapshot.status;
                  return <Badge variant={statusVariant}>{statusLabel}</Badge>;
                })()}
              />
              <DetailItem label="Pago" value={selectedSnapshot?.paid ? 'Sim' : 'Não'} />
              <DetailItem label="Checkout ID" value={selectedSnapshot?.checkout_id ?? '—'} />
              <DetailItem label="Cupom" value={selectedSnapshot?.discount_code ?? '—'} />
              <DetailItem label="Origem do tráfego" value={selectedSnapshot?.traffic_source ?? '—'} />
              <DetailItem
                label="Link do checkout"
                value={
                  selectedSnapshot?.checkout_url ? (
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
              Detalhes do evento selecionado
            </h3>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
              <DetailItem label="Registrado em" value={formatDate(selectedUpdate?.timestamp ?? null)} />
              <DetailItem label="Criado em" value={formatDate(selectedSnapshot?.created_at)} />
              <DetailItem label="Atualizado em" value={formatDate(selectedSnapshot?.updated_at)} />
              <DetailItem label="Pago em" value={formatDate(selectedSnapshot?.paid_at)} />
              <DetailItem label="Expira em" value={formatDate(selectedSnapshot?.expires_at)} />
              <DetailItem label="Fonte" value={selectedUpdate?.source ?? '—'} />
            </dl>
          </section>
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Lista de clientes</h2>
          <p className="text-sm text-slate-400">
            Explore o histórico completo de cada checkout e acompanhe pedidos aprovados.
          </p>
        </div>
        <label className="relative block text-sm">
          <span className="sr-only">Pesquisar cliente</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Pesquisar por nome, e-mail ou produto"
            className="w-72 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-brand"
          />
        </label>
      </div>

      <Table<CustomerCheckoutAggregate>
        columns={columns}
        data={sortedClients}
        getRowKey={(item) => item.email}
        emptyMessage="Nenhum cliente encontrado com os critérios de busca informados."
      />

      <Modal
        open={Boolean(selectedClient)}
        onClose={handleCloseDetails}
        title={
          selectedClient
            ? `Detalhes de ${selectedClient.name ?? selectedClient.email}`
            : 'Detalhes do cliente'
        }
      >
        {modalContent}
      </Modal>
    </section>
  );
}
