'use client';

import { useState } from 'react';
import { Loader2, RefreshCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/ui/classnames';

interface SyncButtonProps {
  readonly className?: string;
}

type SyncState = 'idle' | 'loading' | 'success' | 'error';

export function SyncButton({ className }: SyncButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<SyncState>('idle');
  const [message, setMessage] = useState<string>('');

  async function handleSync() {
    try {
      setState('loading');
      setMessage('Sincronizando vendas diretamente da Kiwify...');
      const response = await fetch('/api/sales/sync', { method: 'POST' });
      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; totalFetched?: number; batches?: number; error?: string }
        | null;

      if (!response.ok || !payload || payload.ok !== true) {
        const errorMessage = payload?.error ?? 'Não foi possível sincronizar as vendas.';
        setState('error');
        setMessage(errorMessage);
        return;
      }

      setState('success');
      const total = payload.totalFetched ?? 0;
      setMessage(`Sincronização concluída. ${total} vendas processadas.`);
      router.refresh();
    } catch (error) {
      console.error('sync_sales_ui_error', error);
      setState('error');
      setMessage('Falha inesperada ao falar com a API. Tente novamente.');
    }
  }

  const isLoading = state === 'loading';

  return (
    <div className={className}>
      <Button onClick={handleSync} disabled={isLoading} className="gap-2">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCcw className="h-4 w-4" aria-hidden />}
        Sincronizar
      </Button>
      {state !== 'idle' ? (
        <p
          className={cn(
            'mt-3 flex items-center gap-2 text-sm',
            state === 'error' ? 'text-rose-600' : state === 'success' ? 'text-emerald-600' : 'text-slate-600'
          )}
        >
          {state === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : state === 'success' ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden />
          ) : state === 'error' ? (
            <AlertCircle className="h-4 w-4" aria-hidden />
          ) : null}
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}
