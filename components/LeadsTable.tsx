'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Table from './Table';
import Modal from './Modal';
import Badge from './Badge';
import { DetailItem, HistoryCheckoutListItem, UpdateListItem } from './AbandonedCartsTable';
import { formatSaoPaulo } from '../lib/dates';
import { STATUS_LABEL, getBadgeVariant } from '../lib/status';
import type { AbandonedCartHistoryEntry, AbandonedCartUpdate } from '../lib/types';
import type { LeadRecord } from '../lib/leads';

type LeadsTableProps = {
  leads: LeadRecord[];
};

const formatDate = (value: string | null | undefined) => (value ? formatSaoPaulo(value) : '—');

const getHistoryEntryUpdates = (
  entry: AbandonedCartHistoryEntry | null,
  selectedUpdateId: string | null,
) => {
  if (!entry) {
    return { updates: [], selected: null };
  }

  const updates = entry.updates ?? [];
  if (updates.length === 0) {
    return { updates: [], selected: null };
  }

  if (!selectedUpdateId) {
    const fallback = updates[updates.length - 1];
    return { updates, selected: fallback };
  }

  const selected = updates.find((item) => item.id === selectedUpdateId) ?? updates[updates.length - 1];
  return { updates, selected };
};

export default function LeadsTable({ leads }: LeadsTableProps) {
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [selectedHistoryKey, setSelectedHistoryKey] = useState<string | null>(null);
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);

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
            <span>Início: {formatDate(item.createdAt)}</span>
            <span>Último: {formatDate(item.updatedAt)}</span>
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
    [],
  );

  useEffect(() => {
    if (!selectedLead) {
      setSelectedHistoryKey(null);
      setSelectedUpdateId(null);
      return;
    }

    if (!selectedHistoryKey) {
      const fallbackKey = selectedLead.activeCartKey ?? selectedLead.history[0]?.cartKey ?? null;
      if (fallbackKey) {
        setSelectedHistoryKey(fallbackKey);
        const fallbackEntry = selectedLead.history.find((entry) => entry.cartKey === fallbackKey);
        const updates = fallbackEntry?.updates ?? [];
        setSelectedUpdateId(updates[updates.length - 1]?.id ?? null);
      }
      return;
    }

    const availableKeys = new Set(selectedLead.history.map((entry) => entry.cartKey));
    if (!availableKeys.has(selectedHistoryKey)) {
      const fallbackKey = selectedLead.activeCartKey ?? selectedLead.history[0]?.cartKey ?? null;
      setSelectedHistoryKey(fallbackKey);
      const fallbackEntry = fallbackKey
        ? selectedLead.history.find((entry) => entry.cartKey === fallbackKey)
        : null;
      const updates = fallbackEntry?.updates ?? [];
      setSelectedUpdateId(updates[updates.length - 1]?.id ?? null);
      return;
    }

    const activeEntry = selectedLead.history.find((entry) => entry.cartKey === selectedHistoryKey) ?? null;
    const updates = activeEntry?.updates ?? [];
    if (updates.length === 0) {
      setSelectedUpdateId(null);
      return;
    }

    const availableUpdateIds = new Set(updates.map((update) => update.id));
    if (!selectedUpdateId || !availableUpdateIds.has(selectedUpdateId)) {
      setSelectedUpdateId(updates[updates.length - 1]?.id ?? null);
    }
  }, [selectedLead, selectedHistoryKey, selectedUpdateId]);

  const handleCloseModal = useCallback(() => {
    setSelectedLead(null);
    setSelectedHistoryKey(null);
    setSelectedUpdateId(null);
  }, []);

  const activeHistory = useMemo(() => {
    if (!selectedLead || !selectedHistoryKey) {
      return null;
    }

    return selectedLead.history.find((entry) => entry.cartKey === selectedHistoryKey) ?? null;
  }, [selectedLead, selectedHistoryKey]);

  const { updates, selected } = useMemo(
    () => getHistoryEntryUpdates(activeHistory, selectedUpdateId),
    [activeHistory, selectedUpdateId],
  );

  const orderedUpdates = useMemo(() => updates.slice().reverse(), [updates]);

  const selectedSnapshot = selected?.snapshot ?? activeHistory?.snapshot ?? null;

  const modalContent = selectedLead ? (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="space-y-6 lg:w-72 xl:w-80">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Checkouts do lead</h3>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
            {selectedLead.history.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum checkout registrado.</p>
            ) : (
              selectedLead.history.map((entry) => (
                <HistoryCheckoutListItem
                  key={entry.cartKey}
                  entry={entry}
                  active={entry.cartKey === selectedHistoryKey}
                  isCurrent={entry.cartKey === selectedLead.activeCartKey}
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
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Histórico do checkout selecionado
          </h3>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
            {orderedUpdates.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma atualização registrada.</p>
            ) : (
              orderedUpdates.map((update: AbandonedCartUpdate) => (
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
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Lead</h3>
          <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
            <DetailItem label="Nome" value={selectedLead.name ?? '—'} />
            <DetailItem label="E-mail" value={selectedLead.email} />
            <DetailItem label="Telefone" value={selectedLead.phone ?? '—'} />
            <DetailItem label="Criado em" value={formatDate(selectedLead.createdAt)} />
            <DetailItem label="Última atualização" value={formatDate(selectedLead.updatedAt)} />
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
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Detalhes da atualização</h3>
          <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
            <DetailItem label="Registrado em" value={formatDate(selected?.timestamp ?? null)} />
            <DetailItem label="Criado em" value={formatDate(selectedSnapshot?.created_at)} />
            <DetailItem label="Atualizado em" value={formatDate(selectedSnapshot?.updated_at)} />
            <DetailItem label="Pago em" value={formatDate(selectedSnapshot?.paid_at)} />
            <DetailItem label="Expira em" value={formatDate(selectedSnapshot?.expires_at)} />
            <DetailItem label="Fonte" value={selected?.source ?? '—'} />
          </dl>
        </section>
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
