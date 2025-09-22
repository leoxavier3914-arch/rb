'use client';

import { useCallback, useMemo, useState } from 'react';
import Badge from './Badge';
import Table from './Table';
import type { AbandonedCart } from '../lib/types';
import { formatSaoPaulo } from '../lib/dates';
import { getBadgeVariant, STATUS_LABEL } from '../lib/status';

type AbandonedCartsTableProps = {
  carts: AbandonedCart[];
};

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
};

export default function AbandonedCartsTable({ carts }: AbandonedCartsTableProps) {
  const [data, setData] = useState<AbandonedCart[]>(carts);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, FeedbackState | undefined>>({});

  const columns = useMemo(
    () => [
      {
        key: 'customer_name' as const,
        header: 'Cliente',
        render: (item: AbandonedCart) => (
          <div className="flex flex-col">
            <span className="font-medium text-white">{item.customer_name ?? 'Nome não informado'}</span>
            <span className="text-xs text-slate-400">{item.customer_email}</span>
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
    [],
  );

  const handleRowClick = useCallback((item: AbandonedCart) => {
    setExpandedId((current) => (current === item.id ? null : item.id));
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
                  status: 'sent',
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

  return (
    <Table<AbandonedCart>
      columns={columns}
      data={data}
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
  );
}
