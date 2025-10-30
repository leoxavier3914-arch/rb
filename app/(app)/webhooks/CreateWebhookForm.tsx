'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/ui/classnames';
import {
  WEBHOOK_EVENT_OPTIONS,
  toggleWebhookEvent,
  type WebhookEventTrigger
} from '@/lib/webhooks/triggers';

const statusOptions = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' }
];

type FormState = 'idle' | 'loading' | 'success' | 'error';

export function CreateWebhookForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<readonly WebhookEventTrigger[]>([]);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [state, setState] = useState<FormState>('idle');
  const [message, setMessage] = useState('');

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

    if (events.length === 0) {
      setState('error');
      setMessage('Selecione pelo menos um evento para receber notificações.');
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
        body: JSON.stringify({ url: normalizedUrl, events, status })
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
      setEvents([]);
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

      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Eventos monitorados</span>
        <fieldset className="grid gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          {WEBHOOK_EVENT_OPTIONS.map(option => {
            const checked = events.includes(option.value);
            return (
              <label key={option.value} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="events"
                  value={option.value}
                  checked={checked}
                  onChange={() =>
                    setEvents(current => toggleWebhookEvent(current, option.value))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-2 focus:ring-slate-200"
                />
                <span>
                  <span className="font-medium text-slate-900">{option.label}</span>
                  <span className="block text-xs text-slate-500">{option.description}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <p className="text-xs text-slate-500">
          {events.length === 0
            ? 'Selecione pelo menos um evento para ativar o webhook.'
            : `${events.length} evento${events.length > 1 ? 's' : ''} selecionado${
                events.length > 1 ? 's' : ''
              }.`}
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
