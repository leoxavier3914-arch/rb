'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError, buildApiError } from '@/lib/ui/apiError';
import type { SyncResult } from '@/lib/kiwify/syncEngine';

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

async function runFullBackfill(
  onProgress?: (iteration: number, payload: SyncResult) => void
): Promise<void> {
  let cursor: SyncResult['nextCursor'] | null = null;
  let iteration = 0;
  let done = false;

  do {
    const response = await fetch('/api/kfy/sync', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-role': 'true'
      },
      body: JSON.stringify({ full: true, persist: true, cursor })
    });

    const rawPayload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw buildApiError(
        (rawPayload as { code?: string; error?: string } | null | undefined) ?? null,
        'Falha ao executar backfill completo.'
      );
    }

    if (!rawPayload || typeof rawPayload !== 'object') {
      throw new ApiError('invalid_response', 'Resposta inválida da sincronização.');
    }

    const payload = rawPayload as SyncResult;

    if (!payload.ok) {
      const lastLog = payload.logs[payload.logs.length - 1];
      throw new ApiError(
        'sync_failed',
        typeof lastLog === 'string' && lastLog.trim().length > 0
          ? lastLog
          : 'A sincronização completa retornou erro.'
      );
    }

    iteration += 1;
    onProgress?.(iteration, payload);

    cursor = payload.nextCursor;
    done = payload.done;
  } while (!done);
}

export default function ConfigSyncPage() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [backfillIterations, setBackfillIterations] = useState<number>(0);
  const [backfillProgress, setBackfillProgress] = useState<string | null>(null);

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

  const handleFullBackfill = (): Promise<void> =>
    handleAction('backfill', async () => {
      setBackfillIterations(0);
      setBackfillProgress('Iniciando backfill completo...');

      try {
        await runFullBackfill((iteration, payload) => {
          setBackfillIterations(iteration);
          setBackfillProgress(
            payload.done
              ? 'Finalizando última janela da sincronização...'
              : `Janelas processadas: ${iteration}. Prosseguindo com a próxima...`
          );
        });
      } finally {
        setBackfillProgress(null);
        setBackfillIterations(0);
      }
    });

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
            onClick={handleFullBackfill}
            disabled={loadingAction === 'backfill'}
          >
            {loadingAction === 'backfill'
              ? backfillIterations > 0
                ? `Executando (${backfillIterations})...`
                : 'Executando...'
              : 'Iniciar backfill'}
          </Button>
          {backfillProgress && (
            <p className="mt-2 text-sm text-slate-500" role="status">
              {backfillProgress}
            </p>
          )}
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
