'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Table from './Table';
import Modal from './Modal';
import Badge from './Badge';
import { DetailItem, HistoryCheckoutListItem, UpdateListItem } from './AbandonedCartsTable';
import HistoryFilterControls from './HistoryFilterControls';
import { formatHistoryDate } from '../lib/historyFormatting';
import { STATUS_LABEL, getBadgeVariant } from '../lib/status';
import { PURCHASE_TYPE_LABEL, resolvePurchaseType } from '../lib/purchaseType';
import type { LeadRecord } from '../lib/leads';
import {
  buildCheckoutHistoryStatusOptions,
  buildCheckoutHistorySummaries,
  buildCheckoutHistoryUpdateMetas,
  filterCheckoutHistorySummaries,
  filterCheckoutHistoryUpdateMetas,
  type CheckoutHistorySummaryRow,
  type CheckoutHistoryUpdateMeta,
  type SortOrder,
  type StatusFilterValue,
} from '../lib/checkoutHistory';

type LeadsTableProps = {
  leads: LeadRecord[];
};

type HistorySummaryRow = CheckoutHistorySummaryRow;
type UpdateMeta = CheckoutHistoryUpdateMeta;

export default function LeadsTable({ leads }: LeadsTableProps) {
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [selectedHistoryKey, setSelectedHistoryKey] = useState<string | null>(null);
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const columns = useMemo(
    () => [
      {
        key: 'name' as const,
        header: 'Nome',
        render: (item: LeadRecord) => (
          <div className="flex flex-col">
            <span className="font-medium text-white">{item.name ?? 'Cliente sem nome'}</span>
            <span className="text-xs text-slate-400">{item.email}</span>
          </div>
        ),
      },
      { key: 'email' as const, header: 'E-mail', render: (item: LeadRecord) => item.email },
      { key: 'phone' as const, header: 'Telefone', render: (item: LeadRecord) => item.phone ?? '—' },
      {
        key: 'productName' as const,
        header: 'Produto mais recente',
        render: (item: LeadRecord) => item.productName ?? '—',
      },
      {
        key: 'latestStatus' as const,
        header: 'Último status',
        render: (item: LeadRecord) => {
          if (!item.latestStatus) {
            return '—';
          }

          const variant = getBadgeVariant(item.latestStatus);
          return <Badge variant={variant}>{STATUS_LABEL[variant] ?? item.latestStatus}</Badge>;
        },
      },
      {
        key: 'createdAt' as const,
        header: 'Criado/Atualizado',
        render: (item: LeadRecord) => (
          <div className="flex flex-col text-xs text-slate-400">
            <span>Início: {formatHistoryDate(item.createdAt)}</span>
            <span>Último: {formatHistoryDate(item.updatedAt)}</span>
          </div>
        ),
      },
      {
        key: 'checkoutUrl' as const,
        header: 'Link do checkout',
        render: (item: LeadRecord) =>
          item.checkoutUrl ? (
            <a
              href={item.checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brand hover:underline"
            >
              Abrir checkout
            </a>
          ) : (
            '—'
          ),
      },
      {
        key: 'actions',
        header: ' ',
        className: 'text-right',
        render: (item: LeadRecord) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedLead(item);
              setStatusFilter('all');
              setSortOrder('desc');

              const fallbackKey = item.activeCartKey ?? item.history[0]?.cartKey ?? null;
              setSelectedHistoryKey(fallbackKey);

              const entry = fallbackKey
                ? item.history.find((history) => history.cartKey === fallbackKey)
                : null;
              const updates = entry?.updates ?? [];
              setSelectedUpdateId(updates[updates.length - 1]?.id ?? null);
            }}
            className="inline-flex items-center rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 sm:text-sm"
          >
            Ver histórico
          </button>
        ),
      },
    ],
    [setSelectedLead, setSelectedHistoryKey, setSelectedUpdateId, setStatusFilter, setSortOrder],
  );

  const historySummaries = useMemo<HistorySummaryRow[]>(() => {
    if (!selectedLead) {
      return [];
    }

    return buildCheckoutHistorySummaries(
      selectedLead.history,
      selectedLead.activeCartKey ?? null,
    );
  }, [selectedLead]);

  const filteredHistorySummaries = useMemo(
    () => filterCheckoutHistorySummaries(historySummaries, statusFilter, sortOrder),
    [historySummaries, sortOrder, statusFilter],
  );

  const activeHistory = useMemo(() => {
    if (!selectedLead || !selectedHistoryKey) {
      return null;
    }

    return selectedLead.history.find((entry) => entry.cartKey === selectedHistoryKey) ?? null;
  }, [selectedLead, selectedHistoryKey]);

  const updateMetas = useMemo<UpdateMeta[]>(
    () => buildCheckoutHistoryUpdateMetas(activeHistory),
    [activeHistory],
  );

  const filteredUpdateMetas = useMemo(
    () => filterCheckoutHistoryUpdateMetas(updateMetas, statusFilter, sortOrder),
    [updateMetas, sortOrder, statusFilter],
  );

  const statusOptions = useMemo(
    () => buildCheckoutHistoryStatusOptions(historySummaries, updateMetas),
    [historySummaries, updateMetas],
  );

  useEffect(() => {
    if (statusFilter === 'all') {
      return;
    }

    const availableTokens = new Set(statusOptions.map((option) => option.value));
    if (!availableTokens.has(statusFilter)) {
      setStatusFilter('all');
    }
  }, [statusFilter, statusOptions]);

  useEffect(() => {
    if (!selectedLead) {
      setSelectedHistoryKey(null);
      setSelectedUpdateId(null);
      return;
    }

    if (filteredHistorySummaries.length === 0) {
      if (selectedHistoryKey !== null) {
        setSelectedHistoryKey(null);
      }
      if (selectedUpdateId !== null) {
        setSelectedUpdateId(null);
      }
      return;
    }

    const availableKeys = new Set(selectedLead.history.map((entry) => entry.cartKey));
    const fallbackKey =
      (selectedLead.activeCartKey && availableKeys.has(selectedLead.activeCartKey)
        ? selectedLead.activeCartKey
        : null) ??
      filteredHistorySummaries[0]?.entry.cartKey ??
      selectedLead.history[0]?.cartKey ??
      null;

    if (
      !selectedHistoryKey ||
      !availableKeys.has(selectedHistoryKey) ||
      !filteredHistorySummaries.some((item) => item.entry.cartKey === selectedHistoryKey)
    ) {
      if (fallbackKey !== null && fallbackKey !== selectedHistoryKey) {
        setSelectedHistoryKey(fallbackKey);
        setSelectedUpdateId(null);
      } else if (fallbackKey === null) {
        setSelectedHistoryKey(null);
        setSelectedUpdateId(null);
      }
      return;
    }

    if (filteredUpdateMetas.length === 0) {
      if (selectedUpdateId !== null) {
        setSelectedUpdateId(null);
      }
      return;
    }

    const availableUpdateIds = new Set(filteredUpdateMetas.map((meta) => meta.update.id));
    if (!selectedUpdateId || !availableUpdateIds.has(selectedUpdateId)) {
      const fallbackUpdateId = filteredUpdateMetas[0]?.update.id ?? null;
      if (fallbackUpdateId && fallbackUpdateId !== selectedUpdateId) {
        setSelectedUpdateId(fallbackUpdateId);
      }
    }
  }, [
    filteredHistorySummaries,
    filteredUpdateMetas,
    selectedHistoryKey,
    selectedLead,
    selectedUpdateId,
  ]);

  const handleCloseModal = useCallback(() => {
    setSelectedLead(null);
    setSelectedHistoryKey(null);
    setSelectedUpdateId(null);
    setStatusFilter('all');
    setSortOrder('desc');
  }, []);

  const selectedUpdate = useMemo(() => {
    if (!activeHistory) {
      return null;
    }

    if (!selectedUpdateId) {
      return activeHistory.updates[activeHistory.updates.length - 1] ?? null;
    }

    return (
      activeHistory.updates.find((update) => update.id === selectedUpdateId) ??
      activeHistory.updates[activeHistory.updates.length - 1] ??
      null
    );
  }, [activeHistory, selectedUpdateId]);

  const purchaseType = useMemo(() => {
    if (!activeHistory) {
      return null;
    }
    return resolvePurchaseType(activeHistory.updates, activeHistory.snapshot);
  }, [activeHistory]);
  const purchaseTypeLabel = purchaseType ? PURCHASE_TYPE_LABEL[purchaseType] : null;

  const selectedSnapshot = selectedUpdate?.snapshot ?? activeHistory?.snapshot ?? null;

  const historySummaryColumns = useMemo(
    () => [
      {
        key: 'checkout' as const,
        header: 'Checkout',
        render: (row: HistorySummaryRow) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-100">{row.checkoutLabel}</span>
            {row.purchaseTypeLabel ? (
              <span className="text-xs text-slate-500">Tipo: {row.purchaseTypeLabel}</span>
            ) : null}
            {row.isCurrent ? (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-brand">
                Atual
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'status' as const,
        header: 'Status',
        render: (row: HistorySummaryRow) => (
          <Badge variant={row.status.variant}>{row.status.label}</Badge>
        ),
      },
      {
        key: 'lastUpdated' as const,
        header: 'Última atualização',
        render: (row: HistorySummaryRow) => <span>{row.lastUpdatedLabel}</span>,
      },
      {
        key: 'interactions' as const,
        header: 'Interações',
        className: 'whitespace-nowrap',
        render: (row: HistorySummaryRow) => <span>{row.interactionsLabel}</span>,
      },
    ],
    [],
  );

  const modalContent = selectedLead ? (
    <div className="flex flex-col gap-6">
      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Resumo dos checkouts
          </h3>
          <HistoryFilterControls
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            statusOptions={statusOptions}
          />
        </div>
        <div className="mt-3">
          <Table<HistorySummaryRow>
            columns={historySummaryColumns}
            data={filteredHistorySummaries}
            getRowKey={(row) => row.key}
            onRowClick={(row) => {
              if (row.entry.cartKey !== selectedHistoryKey) {
                setSelectedHistoryKey(row.entry.cartKey);
                setSelectedUpdateId(null);
              }
            }}
            expandedRowKey={selectedHistoryKey}
            emptyMessage="Nenhum checkout corresponde aos filtros selecionados."
          />
        </div>
      </section>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="space-y-6 lg:w-72 xl:w-80">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Checkouts do lead
            </h3>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {selectedLead.history.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum checkout registrado.</p>
              ) : filteredHistorySummaries.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Nenhum checkout registrado com os filtros atuais.
                </p>
              ) : (
                filteredHistorySummaries.map((summary) => (
                  <HistoryCheckoutListItem
                    key={summary.entry.cartKey}
                    entry={summary.entry}
                    active={summary.entry.cartKey === selectedHistoryKey}
                    isCurrent={summary.entry.cartKey === selectedLead.activeCartKey}
                    purchaseTypeLabel={summary.purchaseTypeLabel}
                    onSelect={(cartKey) => {
                      setSelectedHistoryKey(cartKey);
                      setSelectedUpdateId(null);
                    }}
                  />
                ))
              )}
            </div>
          </section>

          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Histórico do checkout selecionado
              </h3>
              <HistoryFilterControls
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                sortOrder={sortOrder}
                onSortChange={setSortOrder}
                statusOptions={statusOptions}
              />
            </div>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {activeHistory?.updates.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma atualização registrada.</p>
              ) : filteredUpdateMetas.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Nenhuma atualização corresponde aos filtros selecionados.
                </p>
              ) : (
                filteredUpdateMetas.map((meta) => (
                  <UpdateListItem
                    key={meta.update.id}
                    update={meta.update}
                    active={meta.update.id === selectedUpdateId}
                    purchaseTypeLabel={purchaseTypeLabel}
                    onSelect={(id) => setSelectedUpdateId(id)}
                  />
                ))
              )}
            </div>
          </section>
        </aside>

        <div className="flex-1 space-y-6">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Lead</h3>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
              <DetailItem label="Nome" value={selectedLead.name ?? '—'} />
              <DetailItem label="E-mail" value={selectedLead.email} />
              <DetailItem label="Telefone" value={selectedLead.phone ?? '—'} />
              <DetailItem label="Criado em" value={formatHistoryDate(selectedLead.createdAt)} />
              <DetailItem label="Última atualização" value={formatHistoryDate(selectedLead.updatedAt)} />
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
                  const variant = getBadgeVariant(selectedSnapshot.status);
                  const label = STATUS_LABEL[variant] ?? selectedSnapshot.status;
                  return <Badge variant={variant}>{label}</Badge>;
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
              Detalhes da atualização
            </h3>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
              <DetailItem label="Registrado em" value={formatHistoryDate(selectedUpdate?.timestamp)} />
              <DetailItem label="Criado em" value={formatHistoryDate(selectedSnapshot?.created_at)} />
              <DetailItem label="Atualizado em" value={formatHistoryDate(selectedSnapshot?.updated_at)} />
              <DetailItem label="Pago em" value={formatHistoryDate(selectedSnapshot?.paid_at)} />
              <DetailItem label="Expira em" value={formatHistoryDate(selectedSnapshot?.expires_at)} />
              <DetailItem label="Fonte" value={selectedUpdate?.source ?? '—'} />
            </dl>
          </section>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Leads em acompanhamento</h2>
        <p className="text-sm text-slate-400">
          Visualize os checkouts que ainda não registraram pagamentos aprovados ou reembolsados.
        </p>
      </div>

      <Table<LeadRecord>
        columns={columns}
        data={leads}
        getRowKey={(item) => item.key}
        emptyMessage="Nenhum lead encontrado com os filtros atuais."
      />

      <Modal
        open={Boolean(selectedLead)}
        onClose={handleCloseModal}
        title={selectedLead ? `Histórico de ${selectedLead.name ?? selectedLead.email}` : 'Histórico do lead'}
      >
        {modalContent}
      </Modal>
    </section>
  );
}
