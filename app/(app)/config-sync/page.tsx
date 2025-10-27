'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError, buildApiError } from '@/lib/ui/apiError';
import type { SyncRequest } from '@/lib/kiwify/syncEngine';

interface Feedback {
  readonly type: 'success' | 'error';
  readonly message: string;
}

const DAY = 24 * 60 * 60 * 1000;

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

function buildDefaultReconcileRange(): Pick<SyncRequest, 'since' | 'until'> {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now.getTime() - 30 * DAY);
  const toDateOnly = (value: Date): string => {
    const copy = new Date(value);
    copy.setUTCHours(0, 0, 0, 0);
    return copy.toISOString().slice(0, 10);
  };
  return { since: toDateOnly(start), until: toDateOnly(end) };
}

export default function ConfigSyncPage() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const reconcileRange = useMemo(() => buildDefaultReconcileRange(), []);

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

  const handleSyncNow = (): Promise<void> =>
    handleAction('sync', () => callEndpoint('/api/kfy/sync', { persist: true } satisfies SyncRequest));

  const handleReconcile = (): Promise<void> =>
    handleAction('reconcile', () =>
      callEndpoint('/api/kfy/reconcile', { ...reconcileRange, persist: true } satisfies SyncRequest)
    );

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Sincronização &amp; Configurações</h1>
        <p className="mt-2 text-sm text-slate-600">
          Dispare atualizações pontuais dos dados da Kiwify e acompanhe integrações administrativas.
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
          <h2 className="text-lg font-semibold text-slate-900">Sincronizar agora</h2>
          <p className="mt-2 text-sm text-slate-600">
            Faz uma coleta completa dos recursos suportados utilizando a API oficial da Kiwify.
          </p>
          <Button className="mt-4" onClick={handleSyncNow} disabled={loadingAction === 'sync'}>
            {loadingAction === 'sync' ? 'Sincronizando...' : 'Executar sincronização'}
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Reconciliar últimos 30 dias</h2>
          <p className="mt-2 text-sm text-slate-600">
            Garante que vendas, clientes e reembolsos recentes estejam atualizados conforme o histórico oficial.
          </p>
          <Button className="mt-4" onClick={handleReconcile} disabled={loadingAction === 'reconcile'}>
            {loadingAction === 'reconcile' ? 'Reconcilando...' : 'Reconciliar período'}
          </Button>
          <p className="mt-2 text-xs text-slate-500">
            Período padrão: {reconcileRange.since} até {reconcileRange.until}.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Token de acesso</h2>
          <p className="mt-2 text-sm text-slate-600">
            Renove o token utilizado para autenticar chamadas à API da Kiwify.
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
