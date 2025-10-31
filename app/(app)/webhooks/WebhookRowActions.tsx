'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/ui/classnames';
import type { Webhook } from '@/lib/webhooks';
import {
  WEBHOOK_TRIGGER_OPTIONS,
  normalizeWebhookTriggers,
  toggleWebhookTrigger,
  type WebhookTrigger
} from '@/lib/webhooks/triggers';
import { useProductsOptions } from './useProductsOptions';

type ActionState = 'idle' | 'loading' | 'success' | 'error';

type Props = {
  readonly webhook: Webhook;
  readonly isActive?: boolean;
};

export function WebhookRowActions({ webhook, isActive = false }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(webhook.name ?? '');
  const [url, setUrl] = useState(webhook.url);
  const [productId, setProductId] = useState<string | null>(() => normalizeProductScope(webhook.products));
  const [triggers, setTriggers] = useState<readonly WebhookTrigger[]>(
    () => normalizeWebhookTriggers(webhook.triggers)
  );
  const [token, setToken] = useState(webhook.token ?? '');
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState('');
  const [active, setActive] = useState(Boolean(isActive));
  const {
    products: productOptions,
    isLoading: isLoadingProducts,
    isFetching: isFetchingProducts,
    error: productsError,
    reload: reloadProducts
  } = useProductsOptions();

  useEffect(() => {
    setActive(Boolean(isActive));
  }, [isActive]);

  const isBusy = state === 'loading';

  function resetForm() {
    setName(webhook.name ?? '');
    setUrl(webhook.url);
    setProductId(normalizeProductScope(webhook.products));
    setTriggers(normalizeWebhookTriggers(webhook.triggers));
    setToken(webhook.token ?? '');
    setState('idle');
    setMessage('');
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }

    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
      setState('error');
      setMessage('Informe uma URL válida para o webhook.');
      return;
    }

    if (triggers.length === 0) {
      setState('error');
      setMessage('Informe pelo menos um gatilho para o webhook.');
      return;
    }

    try {
      setState('loading');
      setMessage('Atualizando webhook na Kiwify...');
      const normalizedName = name.trim();
      const normalizedToken = token.trim();
      const normalizedProductId = typeof productId === 'string' ? productId.trim() : '';
      const updatePayload: Record<string, unknown> = {
        url: normalizedUrl,
        triggers,
        name: normalizedName.length > 0 ? normalizedName : null,
        token: normalizedToken.length > 0 ? normalizedToken : null,
        products: normalizedProductId.length > 0 ? normalizedProductId : 'all'
      };

      const response = await fetch(`/api/webhooks/${encodeURIComponent(webhook.id)}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string; webhook?: { id: string } }
        | null;

      if (!response.ok || !payload || payload.ok !== true) {
        const errorMessage = payload?.error ?? 'Não foi possível atualizar o webhook.';
        setState('error');
        setMessage(errorMessage);
        return;
      }

      setState('success');
      setMessage('Webhook atualizado com sucesso.');
      setEditing(false);

      if (active) {
        await persistWebhookState(true, { silent: true });
      }

      router.refresh();
    } catch (error) {
      console.error('update_webhook_ui_error', error);
      setState('error');
      setMessage('Falha inesperada ao falar com a API. Tente novamente.');
    }
  }

  async function handleDelete() {
    if (isBusy) {
      return;
    }

    const confirmed = window.confirm('Tem certeza de que deseja remover este webhook?');
    if (!confirmed) {
      return;
    }

    try {
      setState('loading');
      setMessage('Removendo webhook...');
      const response = await fetch(`/api/webhooks/${encodeURIComponent(webhook.id)}`, {
        method: 'DELETE'
      });
      const payload = (await response.json().catch(() => null)) as { ok: boolean; error?: string } | null;

      if (!response.ok || !payload || payload.ok !== true) {
        const errorMessage = payload?.error ?? 'Não foi possível remover o webhook.';
        setState('error');
        setMessage(errorMessage);
        return;
      }

      setState('success');
      setMessage('Webhook removido com sucesso.');
      router.refresh();
    } catch (error) {
      console.error('delete_webhook_ui_error', error);
      setState('error');
      setMessage('Falha inesperada ao falar com a API. Tente novamente.');
    }
  }

  async function persistWebhookState(
    nextValue: boolean,
    { silent = false }: { silent?: boolean } = {}
  ): Promise<boolean> {
    const normalizedName = name.trim();
    const normalizedToken = token.trim();
    const normalizedUrl = url.trim() || webhook.url;

    try {
      const response = await fetch(`/api/webhooks/${encodeURIComponent(webhook.id)}/state`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          active: nextValue,
          token: normalizedToken.length > 0 ? normalizedToken : null,
          name: normalizedName.length > 0 ? normalizedName : null,
          url: normalizedUrl
        })
      });

      const payload = (await response.json().catch(() => null)) as { ok: boolean; error?: string } | null;

      if (!response.ok || !payload || payload.ok !== true) {
        const errorMessage = payload?.error ?? 'Não foi possível atualizar o status do webhook.';
        if (!silent) {
          setState('error');
          setMessage(errorMessage);
        } else {
          console.error('persist_webhook_state_failed', errorMessage);
        }
        return false;
      }

      setActive(nextValue);

      if (!silent) {
        setState('success');
        setMessage(nextValue ? 'Webhook ativado.' : 'Webhook desativado.');
      }

      return true;
    } catch (error) {
      if (!silent) {
        console.error('persist_webhook_state_failed', error);
        setState('error');
        setMessage('Falha inesperada ao atualizar o status do webhook.');
      } else {
        console.error('persist_webhook_state_failed', error);
      }
      return false;
    }
  }

  async function handleToggleActive(nextValue: boolean) {
    if (isBusy) {
      return;
    }

    setState('loading');
    setMessage(nextValue ? 'Ativando webhook...' : 'Desativando webhook...');

    const success = await persistWebhookState(nextValue);
    if (success) {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={active}
          disabled={isBusy}
          onChange={event => handleToggleActive(event.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-1 focus:ring-slate-200"
        />
        <span>{active ? 'Webhook ativo' : 'Webhook inativo'}</span>
      </label>

      {editing ? (
        <form onSubmit={handleUpdate} className="w-full max-w-xs space-y-3 text-left">
          <div className="space-y-1">
            <label htmlFor={`webhook-name-${webhook.id}`} className="text-xs font-medium text-slate-700">
              Nome
            </label>
            <input
              id={`webhook-name-${webhook.id}`}
              type="text"
              value={name}
              onChange={event => setName(event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Opcional"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`webhook-url-${webhook.id}`} className="text-xs font-medium text-slate-700">
              URL
            </label>
            <input
              id={`webhook-url-${webhook.id}`}
              type="url"
              value={url}
              onChange={event => setUrl(event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-700">Gatilhos</span>
            <fieldset className="grid gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
              {WEBHOOK_TRIGGER_OPTIONS.map(option => {
                const checked = triggers.includes(option.value);
                return (
                  <label key={option.value} className="flex items-start gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      value={option.value}
                      checked={checked}
                      onChange={() =>
                        setTriggers(current => toggleWebhookTrigger(current, option.value))
                      }
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-1 focus:ring-slate-200"
                    />
                    <span>
                      <span className="font-medium text-slate-900">{option.label}</span>
                      <span className="block text-[10px] text-slate-500">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <p className="text-[10px] text-slate-500">
              {triggers.length === 0
                ? 'Selecione pelo menos um gatilho para manter o webhook ativo.'
                : `${triggers.length} gatilho${triggers.length > 1 ? 's' : ''} ativo${
                    triggers.length > 1 ? 's' : ''
                  }.`}
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor={`webhook-products-${webhook.id}`} className="text-xs font-medium text-slate-700">
              Produtos
            </label>
            <select
              id={`webhook-products-${webhook.id}`}
              value={productId ?? ''}
              onChange={event => setProductId(event.target.value ? event.target.value : null)}
              disabled={isFetchingProducts}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="">Todos os produtos</option>
              {productOptions.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            {isLoadingProducts ? (
              <p className="text-[10px] text-slate-500">Carregando produtos...</p>
            ) : null}
            {productsError ? (
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-rose-600">
                <span>{productsError}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-[10px]"
                  onClick={() => reloadProducts()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500">Selecione um produto ou mantenha Todos para escopo global.</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor={`webhook-token-${webhook.id}`} className="text-xs font-medium text-slate-700">
              Token (opcional)
            </label>
            <input
              id={`webhook-token-${webhook.id}`}
              type="text"
              value={token}
              onChange={event => setToken(event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                resetForm();
                setEditing(false);
              }}
              className="gap-1"
            >
              <X className="h-4 w-4" aria-hidden />
              Cancelar
            </Button>
            <Button type="submit" size="sm" className="gap-2" disabled={isBusy}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Salvar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              resetForm();
              setEditing(true);
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Editar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            onClick={handleDelete}
            disabled={isBusy}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Remover
          </Button>
        </div>
      )}

      {state !== 'idle' ? (
        <p
          className={cn(
            'flex items-center gap-2 text-xs',
            state === 'error' ? 'text-rose-600' : state === 'success' ? 'text-emerald-600' : 'text-slate-600'
          )}
        >
          {isBusy ? (
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

function normalizeProductScope(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const lowerCased = trimmed.toLowerCase();
  if (lowerCased === 'all' || lowerCased === 'all_products') {
    return null;
  }

  return trimmed;
}
