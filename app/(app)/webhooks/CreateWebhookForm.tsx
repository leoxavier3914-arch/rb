'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/ui/classnames';
import {
  WEBHOOK_TRIGGER_OPTIONS,
  toggleWebhookTrigger,
  type WebhookTrigger
} from '@/lib/webhooks/triggers';

type FormState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Renders a form that lets users create a webhook, validates required fields, submits the webhook to /api/webhooks, and displays loading, success, or error feedback.
 *
 * The form validates that a URL is provided and at least one trigger is selected, normalizes optional inputs (name, products, token), posts a JSON payload to /api/webhooks, and on success resets the form and refreshes the page. On failure it displays an error message.
 *
 * @returns A React element containing the create-webhook form UI.
 */
export function CreateWebhookForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [products, setProducts] = useState('all');
  const [triggers, setTriggers] = useState<readonly WebhookTrigger[]>([]);
  const [token, setToken] = useState('');
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

    if (triggers.length === 0) {
      setState('error');
      setMessage('Selecione pelo menos um gatilho para receber notificações.');
      return;
    }

    try {
      setState('loading');
      setMessage('Registrando webhook na Kiwify...');
      const normalizedName = name.trim();
      const normalizedProducts = products.trim();
      const normalizedToken = token.trim();
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          url: normalizedUrl,
          triggers,
          ...(normalizedName ? { name: normalizedName } : {}),
          ...(normalizedProducts ? { products: normalizedProducts } : {}),
          ...(normalizedToken ? { token: normalizedToken } : {})
        })
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

      setName('');
      setUrl('');
      setProducts('all');
      setTriggers([]);
      setToken('');
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
        <label htmlFor="webhook-name" className="text-sm font-medium text-slate-700">
          Nome (opcional)
        </label>
        <input
          id="webhook-name"
          name="name"
          type="text"
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Ex: Integração CRM"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>

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
        <span className="text-sm font-medium text-slate-700">Gatilhos monitorados</span>
        <fieldset className="grid gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          {WEBHOOK_TRIGGER_OPTIONS.map(option => {
            const checked = triggers.includes(option.value);
            return (
              <label key={option.value} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="triggers"
                  value={option.value}
                  checked={checked}
                  onChange={() =>
                    setTriggers(current => toggleWebhookTrigger(current, option.value))
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
          {triggers.length === 0
            ? 'Selecione pelo menos um gatilho para ativar o webhook.'
            : `${triggers.length} gatilho${triggers.length > 1 ? 's' : ''} selecionado${
                triggers.length > 1 ? 's' : ''
              }.`}
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="webhook-products" className="text-sm font-medium text-slate-700">
          Produtos monitorados
        </label>
        <input
          id="webhook-products"
          name="products"
          type="text"
          value={products}
          onChange={event => setProducts(event.target.value)}
          placeholder="all"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
        <p className="text-xs text-slate-500">
          Use <span className="font-mono text-[11px]">all</span> para receber eventos de todos os produtos ou informe o ID de um produto específico.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="webhook-token" className="text-sm font-medium text-slate-700">
          Token de verificação (opcional)
        </label>
        <input
          id="webhook-token"
          name="token"
          type="text"
          value={token}
          onChange={event => setToken(event.target.value)}
          placeholder="Informe um token personalizado"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
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