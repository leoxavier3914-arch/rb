'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/ui/classnames';

const statusOptions = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' }
];

type FormState = 'idle' | 'loading' | 'success' | 'error';

export function CreateWebhookForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [state, setState] = useState<FormState>('idle');
  const [message, setMessage] = useState('');

  function parseEvents(raw: string): string[] {
    return raw
      .split(/[,\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'loading') {
      return;
    }

    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
      setState('error');
      setMessage('Informe a URL que receberá as notificações.');
      return;
    }

    const parsedEvents = parseEvents(events);
    if (parsedEvents.length === 0) {
      setState('error');
      setMessage('Informe pelo menos um evento, separados por vírgula ou quebra de linha.');
      return;
    }

    try {
      setState('loading');
      setMessage('Registrando webhook na Kiwify...');
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ url: normalizedUrl, events: parsedEvents, status })
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string; webhook?: { id: string } }
        | null;

      if (!response.ok || !payload || payload.ok !== true) {
        const errorMessage = payload?.error ?? 'Não foi possível criar o webhook.';
        setState('error');
        setMessage(errorMessage);
        return;
      }

      setUrl('');
      setEvents('');
      setStatus('active');
      setState('success');
      setMessage('Webhook criado com sucesso.');
      router.refresh();
    } catch (error) {
      console.error('create_webhook_ui_error', error);
      setState('error');
      setMessage('Falha inesperada ao falar com a API. Tente novamente.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="webhook-url" className="text-sm font-medium text-slate-700">
          URL do webhook
        </label>
        <input
          id="webhook-url"
          name="url"
          type="url"
          value={url}
          onChange={event => setUrl(event.target.value)}
          placeholder="https://example.com/webhooks"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          required
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="webhook-events" className="text-sm font-medium text-slate-700">
          Eventos monitorados
        </label>
        <textarea
          id="webhook-events"
          name="events"
          value={events}
          onChange={event => setEvents(event.target.value)}
          rows={3}
          placeholder={"Ex: sale.approved, sale.canceled"}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
        <p className="text-xs text-slate-500">
          Separe múltiplos eventos por vírgula ou quebra de linha.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="webhook-status" className="text-sm font-medium text-slate-700">
          Status inicial
        </label>
        <select
          id="webhook-status"
          name="status"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          value={status}
          onChange={event => setStatus(event.target.value === 'inactive' ? 'inactive' : 'active')}
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" className="gap-2" disabled={state === 'loading'}>
        {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Criar webhook
      </Button>

      {state !== 'idle' ? (
        <p
          className={cn(
            'flex items-center gap-2 text-sm',
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
    </form>
  );
}
