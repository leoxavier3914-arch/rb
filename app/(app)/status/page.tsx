'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/Skeletons';
import { ApiError, buildApiError } from '@/lib/ui/apiError';

interface HealthResponse {
  readonly ok: boolean;
  readonly db: 'ok' | 'unknown';
  readonly storage: 'ok' | 'unknown';
  readonly lastSyncAt: string | null;
  readonly failedEventsCount: number;
  readonly jobsPending: number;
}

type ToastState = { type: 'success' | 'error'; message: string } | null;

function formatTimestamp(value: string | null): string {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return value;
  }
}

function resolveErrorCode(error: Error | null): string {
  return error instanceof ApiError ? error.code : 'unknown_error';
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [retryLoading, setRetryLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/healthz', {
        headers: { 'x-admin-role': 'true' }
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok || (payload as { ok?: boolean }).ok === false) {
        throw buildApiError(payload, 'Não foi possível carregar o status do sistema.');
      }
      setHealth(payload as HealthResponse);
    } catch (caught) {
      const failure = caught instanceof Error ? caught : new Error('Falha ao consultar status.');
      setError(failure);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const handleRetry = useCallback(async () => {
    setRetryLoading(true);
    try {
      const response = await fetch('/api/kfy/webhook/retry', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-role': 'true'
        }
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok || (payload as { ok?: boolean }).ok === false) {
        throw buildApiError(payload, 'Falha ao reprocessar webhooks.');
      }
      showToast('success', 'Retentativa disparada com sucesso.');
      await loadHealth();
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? `${caught.message} (código: ${caught.code})`
          : caught instanceof Error
            ? caught.message
            : 'Falha ao reprocessar webhooks.';
      showToast('error', message);
    } finally {
      setRetryLoading(false);
    }
  }, [loadHealth, showToast]);

  const statusCards = useMemo(() => {
    if (!health) {
      return [] as ReactNode[];
    }
    const items: ReactNode[] = [
      (
        <Card key="db">
          <CardHeader>
            <CardTitle>Banco de dados</CardTitle>
            <CardDescription>Consulta às tabelas principais.</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-slate-900">
              {health.db === 'ok' ? 'Operacional' : 'Indisponível'}
            </span>
          </CardContent>
        </Card>
      ),
      (
        <Card key="storage">
          <CardHeader>
            <CardTitle>Storage</CardTitle>
            <CardDescription>Bucket exports no Supabase.</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-slate-900">
              {health.storage === 'ok' ? 'Operacional' : 'Verificar bucket'}
            </span>
          </CardContent>
        </Card>
      ),
      (
        <Card key="sync">
          <CardHeader>
            <CardTitle>Última sincronização</CardTitle>
            <CardDescription>Registro do cursor persistido.</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-slate-900">{formatTimestamp(health.lastSyncAt)}</span>
          </CardContent>
        </Card>
      ),
      (
        <Card key="webhooks">
          <CardHeader>
            <CardTitle>Webhooks com falha</CardTitle>
            <CardDescription>Eventos aguardando reprocessamento.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <span className="text-3xl font-semibold text-slate-900">{health.failedEventsCount}</span>
            <Button
              type="button"
              onClick={() => {
                void handleRetry();
              }}
              disabled={retryLoading || health.failedEventsCount === 0}
            >
              {retryLoading ? 'Reprocessando...' : 'Reprocessar'}
            </Button>
          </CardContent>
        </Card>
      ),
      (
        <Card key="jobs">
          <CardHeader>
            <CardTitle>Jobs pendentes</CardTitle>
            <CardDescription>Exportações aguardando execução.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <span className="text-3xl font-semibold text-slate-900">{health.jobsPending}</span>
            <Button asChild variant="secondary">
              <Link href="/export-import">Gerenciar jobs</Link>
            </Button>
          </CardContent>
        </Card>
      )
    ];
    return items;
  }, [handleRetry, health, retryLoading]);

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold text-slate-900">Status do sistema</h1>
        <p className="text-sm text-slate-600">
          Acompanhe a saúde das integrações com a Kiwify, verifique eventos com falha e execute retentativas de forma manual.
        </p>
      </section>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : error ? (
        <Card className="border-rose-200 bg-rose-50">
          <CardHeader>
            <CardTitle className="text-rose-700">Não foi possível carregar o status.</CardTitle>
            <CardDescription className="text-rose-600">Código: {resolveErrorCode(error)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-rose-600">
            <span>{error.message}</span>
            <Button type="button" variant="secondary" onClick={() => void loadHealth()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{statusCards}</section>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 flex items-center rounded-md border px-4 py-3 text-sm shadow-lg transition ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
