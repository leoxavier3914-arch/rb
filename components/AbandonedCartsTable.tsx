'use client';

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import Badge from './Badge';
import Table from './Table';
import type { AbandonedCart } from '../lib/types';
import { formatSaoPaulo } from '../lib/dates';
import { getBadgeVariant, STATUS_LABEL } from '../lib/status';

export type AbandonedCartSortMode = 'default' | 'converted' | 'pending' | 'sent';

type AbandonedCartsTableProps = {
  carts: AbandonedCart[];
  sortMode?: AbandonedCartSortMode;
};

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
};

const PAGE_SIZE = 20;

const STATUS_SEQUENCE: Array<Exclude<AbandonedCartSortMode, 'default'>> = ['converted', 'pending', 'sent'];

const getTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
};

export default function AbandonedCartsTable({ carts, sortMode = 'default' }: AbandonedCartsTableProps) {
  const [data, setData] = useState<AbandonedCart[]>(carts);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, FeedbackState | undefined>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [statusIndicatorId, setStatusIndicatorId] = useState<string | null>(null);

  useEffect(() => {
    setData(carts);
    setCurrentPage(1);
    setExpandedId(null);
    setFeedback({});
    setStatusIndicatorId(null);
  }, [carts]);

  const handleStatusIndicatorToggle = useCallback(
    (event: MouseEvent<HTMLButtonElement>, id: string) => {
      event.stopPropagation();
      setStatusIndicatorId((current) => (current === id ? null : id));
    },
    [],
  );

  const columns = useMemo(
    () => [
      {
        key: 'customer_name' as const,
        header: 'Cliente',
        render: (item: AbandonedCart) => (
          <div className="flex items-start gap-3">
            {item.status === 'sent' || item.status === 'converted' ? (
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={(event) => handleStatusIndicatorToggle(event, item.id)}
                  className="flex h-5 w-5 items-center justify-center rounded-full transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  aria-label={`Status do carrinho: ${item.status === 'converted' ? 'Convertido' : 'Aguardando'}`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      item.status === 'converted'
                        ? 'bg-emerald-400 shadow-[0_0_0_2px_rgba(15,23,42,0.8)]'
                        : 'bg-amber-400 shadow-[0_0_0_2px_rgba(15,23,42,0.8)]'
                    }`}
                  />
                </button>

                {statusIndicatorId === item.id ? (
                  <div className="absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900/95 px-2 py-1 text-xs font-semibold text-white shadow-xl ring-1 ring-slate-700">
                    <span className={item.status === 'converted' ? 'text-emerald-200' : 'text-amber-200'}>
                      {item.status === 'converted' ? 'Convertido' : 'Aguardando'}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col">
              <span className="font-medium text-white">{item.customer_name ?? 'Nome não informado'}</span>
              <span className="text-xs text-slate-400">{item.customer_email}</span>
            </div>
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
      { key: 'expires_at' as const, header: 'Expira em', render: (i: AbandonedCart) => formatSaoPaulo(i.expires_at) },
      {
        key: 'updated_at' as const,
        header: 'Atualizado em',
        render: (i: AbandonedCart) => formatSaoPaulo(i.updated_at ?? i.created_at),
      },
    ],
    [handleStatusIndicatorToggle, statusIndicatorId],
  );

  const handleRowClick = useCallback((item: AbandonedCart) => {
    setExpandedId((current) => (current === item.id ? null : item.id));
    setStatusIndicatorId(null);
  }, []);

  const handleSendEmail = useCallback(
    async (item: AbandonedCart) => {
      if (sendingId) return;

      setSendingId(item.id);
      setFeedback((prev) => ({ ...prev, [item.id]: undefined }));

      try {
        const response = await fetch('/api/admin/resend', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: item.id }),
        });

        if (!response.ok) {
          let errorMessage = 'Falha ao enviar e-mail.';
          try {
            const payload = (await response.json()) as { error?: string };
            if (payload?.error) errorMessage = payload.error;
          } catch {
            // ignore JSON parse errors
          }
          throw new Error(errorMessage);
        }

        type SuccessPayload = { ok?: boolean; discountCode?: string | null; expiresAt?: string | null };
        const payload = (await response.json()) as SuccessPayload;

        setData((prev) =>
          prev.map((row) =>
            row.id === item.id
              ? {
                  ...row,
                  status: row.paid ? 'converted' : 'sent',
                  discount_code: payload.discountCode ?? row.discount_code,
                  expires_at: payload.expiresAt ?? row.expires_at,
                  last_event: 'manual.email.sent',
                  last_reminder_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
              : row,
          ),
        );

        setFeedback((prev) => ({ ...prev, [item.id]: { type: 'success', message: 'E-mail enviado com sucesso.' } }));
      } catch (error) {
        setFeedback((prev) => ({
          ...prev,
          [item.id]: { type: 'error', message: error instanceof Error ? error.message : 'Falha ao enviar e-mail.' },
        }));
      } finally {
        setSendingId(null);
      }
    },
    [sendingId],
  );

  const sortedData = useMemo(() => {
    if (sortMode === 'default') {
      return data;
    }

    const startIndex = STATUS_SEQUENCE.indexOf(sortMode as Exclude<AbandonedCartSortMode, 'default'>);
    const sequence =
      startIndex === -1
        ? STATUS_SEQUENCE
        : [...STATUS_SEQUENCE.slice(startIndex), ...STATUS_SEQUENCE.slice(0, startIndex)];
    const statusOrder = sequence.reduce<Record<string, number>>((acc, status, index) => {
      acc[status] = index;
      return acc;
    }, {});

    return [...data].sort((a, b) => {
      const orderA = statusOrder[a.status] ?? Number.POSITIVE_INFINITY;
      const orderB = statusOrder[b.status] ?? Number.POSITIVE_INFINITY;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      const timeB = getTimestamp(b.updated_at ?? b.created_at);
      const timeA = getTimestamp(a.updated_at ?? a.created_at);
      return timeB - timeA;
    });
  }, [data, sortMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortMode]);

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

  useEffect(() => {
    if (expandedId && !paginatedData.some((row) => row.id === expandedId)) {
      setExpandedId(null);
    }
  }, [expandedId, paginatedData]);

  useEffect(() => {
    if (statusIndicatorId && !paginatedData.some((row) => row.id === statusIndicatorId)) {
      setStatusIndicatorId(null);
    }
  }, [paginatedData, statusIndicatorId]);

  const pageStart = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalItems === 0 ? 0 : Math.min(pageStart + paginatedData.length - 1, totalItems);

  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  return (
    <div className="space-y-4">
      <Table<AbandonedCart>
        columns={columns}
        data={paginatedData}
        getRowKey={(i) => i.id}
        emptyMessage="Nenhum evento encontrado. Aguarde o primeiro webhook da Kiwify."
        onRowClick={(item) => handleRowClick(item)}
        expandedRowKey={expandedId}
        renderExpandedRow={(item) => {
          const isSending = sendingId === item.id;
          const feedbackMessage = feedback[item.id];

          return (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  Ações para {item.customer_name ?? 'Nome não informado'}
                </p>
                <p className="text-xs text-slate-400">
                  Reenviar o lembrete manualmente para {item.customer_email}.
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => handleSendEmail(item)}
                  disabled={isSending}
                  className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSending ? 'Enviando…' : 'Enviar e-mail'}
                </button>
                {feedbackMessage ? (
                  <span
                    className={
                      feedbackMessage.type === 'success'
                        ? 'text-xs font-medium text-emerald-300'
                        : 'text-xs font-medium text-rose-300'
                    }
                  >
                    {feedbackMessage.message}
                  </span>
                ) : null}
              </div>
            </div>
          );
        }}
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
