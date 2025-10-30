import { NextResponse } from 'next/server';
import { deleteWebhook, updateWebhook } from '@/lib/webhooks';
import {
  normalizeWebhookTriggers,
  type WebhookTrigger
} from '@/lib/webhooks/triggers';

export const dynamic = 'force-dynamic';

/**
 * Normalize and validate a raw triggers input into a list of webhook triggers.
 *
 * @param value - The raw input to normalize; expected to be an array of strings (or undefined). Strings will be trimmed and empty entries ignored.
 * @returns A readonly array of normalized `WebhookTrigger` when valid; `[]` if the input array contains only empty or whitespace strings; `null` if the input is not an array or normalizes to no valid triggers; `undefined` if `value` is `undefined`.
 */
function normalizeTriggers(value: unknown): readonly WebhookTrigger[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return null;
  }

  const rawValues = value.map(item => (typeof item === 'string' ? item.trim() : '')).filter(item => item.length > 0);
  if (rawValues.length === 0) {
    return [];
  }

  const triggers = normalizeWebhookTriggers(rawValues);
  if (triggers.length === 0) {
    return null;
  }

  return triggers;
}

/**
 * Update an existing webhook identified by route `id` using fields from the request JSON payload.
 *
 * Validates and accepts partial updates for `url`, `triggers`, `name`, `products`, and `token`. Returns validation errors for malformed or missing input and returns the updated webhook on success.
 *
 * @param request - The incoming HTTP request containing a JSON payload with update fields.
 * @param params - Route parameters object containing `id` (the webhook identifier).
 * @returns A JSON response object: `{ ok: true, webhook }` on success; `{ ok: false, error }` with an explanatory message on validation or server errors.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id?: string } }
) {
  const id = typeof params?.id === 'string' ? params.id : '';
  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Informe o webhook que deseja atualizar.' },
      { status: 400 }
    );
  }

  try {
    const payload = (await request.json().catch(() => null)) as
      | {
          url?: unknown;
          triggers?: unknown;
          name?: unknown;
          products?: unknown;
          token?: unknown;
        }
      | null;

    const hasKnownKeys =
      payload &&
      (Object.prototype.hasOwnProperty.call(payload, 'url') ||
        Object.prototype.hasOwnProperty.call(payload, 'triggers') ||
        Object.prototype.hasOwnProperty.call(payload, 'name') ||
        Object.prototype.hasOwnProperty.call(payload, 'products') ||
        Object.prototype.hasOwnProperty.call(payload, 'token'));

    if (!payload || !hasKnownKeys) {
      return NextResponse.json(
        { ok: false, error: 'Informe ao menos um campo para atualizar o webhook.' },
        { status: 400 }
      );
    }

    const url = typeof payload.url === 'string' ? payload.url.trim() : undefined;
    if (payload.url !== undefined && (!url || url.length === 0)) {
      return NextResponse.json(
        { ok: false, error: 'Informe uma URL válida para o webhook.' },
        { status: 400 }
      );
    }

    const triggers = normalizeTriggers(payload.triggers);
    if (triggers === null) {
      return NextResponse.json(
        { ok: false, error: 'Informe os gatilhos como uma lista válida.' },
        { status: 400 }
      );
    }
    if (triggers !== undefined && triggers.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Informe pelo menos um gatilho para o webhook.' },
        { status: 400 }
      );
    }

    let name: string | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
      if (payload?.name === null) {
        name = null;
      } else if (typeof payload?.name === 'string') {
        const trimmed = payload.name.trim();
        name = trimmed.length > 0 ? trimmed : null;
      } else {
        return NextResponse.json(
          { ok: false, error: 'Informe um nome válido para o webhook.' },
          { status: 400 }
        );
      }
    }

    let products: string | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(payload, 'products')) {
      if (payload?.products === null) {
        products = null;
      } else if (typeof payload?.products === 'string') {
        const trimmed = payload.products.trim();
        products = trimmed.length > 0 ? trimmed : 'all';
      } else {
        return NextResponse.json(
          { ok: false, error: 'Informe os produtos como uma string válida.' },
          { status: 400 }
        );
      }
    }

    let token: string | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(payload, 'token')) {
      if (payload?.token === null) {
        token = null;
      } else if (typeof payload?.token === 'string') {
        const trimmed = payload.token.trim();
        token = trimmed.length > 0 ? trimmed : null;
      } else {
        return NextResponse.json(
          { ok: false, error: 'Informe um token válido para o webhook.' },
          { status: 400 }
        );
      }
    }

    const webhook = await updateWebhook(id, {
      url,
      triggers,
      name,
      products,
      token
    });
    return NextResponse.json({ ok: true, webhook });
  } catch (error) {
    console.error('update_webhook_failed', error);
    const message = error instanceof Error ? error.message : 'Não foi possível atualizar o webhook agora.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id?: string } }
) {
  const id = typeof params?.id === 'string' ? params.id : '';
  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Informe o webhook que deseja excluir.' },
      { status: 400 }
    );
  }

  try {
    await deleteWebhook(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('delete_webhook_failed', error);
    const message = error instanceof Error ? error.message : 'Não foi possível excluir o webhook agora.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}