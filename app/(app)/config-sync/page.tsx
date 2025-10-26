'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError, buildApiError } from '@/lib/ui/apiError';

interface Feedback {
  readonly type: 'success' | 'error';
  readonly message: string;
}

async function callEndpoint(path: string, body?: unknown): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-role': 'true'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || (payload as { ok?: boolean }).ok === false) {
    throw buildApiError(payload, 'Falha ao executar ação.');
  }
}

export default function ConfigSyncPage() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleAction = async (id: string, action: () => Promise<void>): Promise<void> => {
    setLoadingAction(id);
    setFeedback(null);
    try {
      await action();
      setFeedback({ type: 'success', message: 'Ação concluída com sucesso.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof ApiError
            ? `${error.message} (código: ${error.code})`
            : error instanceof Error
              ? error.message
              : 'Erro ao executar ação.'
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Sincronização &amp; Configurações</h1>
        <p className="mt-2 text-sm text-slate-600">
          Execute ações administrativas relacionadas ao conector da Kiwify para manter os dados atualizados.
        </p>
      </header>

      {feedback && (
        <div
          className={`rounded-md border p-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Token de acesso</h2>
          <p className="mt-2 text-sm text-slate-600">
            Renove o token de acesso utilizado para autenticar chamadas à API da Kiwify.
          </p>
          <Button
            className="mt-4"
            onClick={() => handleAction('token', () => callEndpoint('/api/kfy/token'))}
            disabled={loadingAction === 'token'}
          >
            {loadingAction === 'token' ? 'Renovando...' : 'Renovar token'}
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Backfill completo</h2>
          <p className="mt-2 text-sm text-slate-600">
            Reexecuta a sincronização completa de todos os recursos disponíveis na Kiwify.
          </p>
          <Button
            className="mt-4"
            onClick={() => handleAction('backfill', () => callEndpoint('/api/kfy/sync', { full: true, persist: true }))}
            disabled={loadingAction === 'backfill'}
          >
            {loadingAction === 'backfill' ? 'Executando...' : 'Iniciar backfill'}
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Reconciliar últimos 30 dias</h2>
          <p className="mt-2 text-sm text-slate-600">
            Sincroniza novamente o período recente para garantir que status e valores estejam atualizados.
          </p>
          <Button
            className="mt-4"
            onClick={() => handleAction('reconcile', () => callEndpoint('/api/kfy/reconcile', { persist: true }))}
            disabled={loadingAction === 'reconcile'}
          >
            {loadingAction === 'reconcile' ? 'Reconcilando...' : 'Reconciliar dados'}
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Retentar webhooks</h2>
          <p className="mt-2 text-sm text-slate-600">
            Reprocessa eventos que falharam anteriormente, garantindo a consistência dos dados.
          </p>
          <Button
            className="mt-4"
            onClick={() => handleAction('retry', () => callEndpoint('/api/kfy/webhook/retry'))}
            disabled={loadingAction === 'retry'}
          >
            {loadingAction === 'retry' ? 'Reprocessando...' : 'Retentar webhooks'}
          </Button>
        </div>
      </section>
    </main>
  );
}
