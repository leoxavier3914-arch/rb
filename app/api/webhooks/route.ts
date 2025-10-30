import { NextResponse } from 'next/server';
import { createWebhook } from '@/lib/webhooks';
import {
  normalizeWebhookTriggers,
  type WebhookTrigger
} from '@/lib/webhooks/triggers';

export const dynamic = 'force-dynamic';

/**
 * Normalize a raw value into a list of webhook triggers or indicate invalid input.
 *
 * Takes any value and attempts to produce a normalized, readonly array of WebhookTrigger objects.
 *
 * @param value - The raw payload field (expected to be an array of values, typically strings) to normalize into triggers.
 * @returns `readonly WebhookTrigger[]` with normalized triggers when the input is an array with valid trigger strings;
 * an empty array when the input is an array but contains no valid string entries;
 * `null` when the input is not an array or when normalization yields no valid triggers (invalid input).
 */
function normalizeTriggers(value: unknown): readonly WebhookTrigger[] | null {
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
 * Handle HTTP POST requests to create a webhook from a JSON payload.
 *
 * Validates required fields (URL and triggers), creates the webhook when valid, and returns a JSON response indicating success or failure.
 *
 * @returns A JSON object `{ ok: true, webhook }` containing the created webhook on success, or `{ ok: false, error }` with an explanatory error message on validation or server failure.
 */
export async function POST(request: Request) {
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

    const url = typeof payload?.url === 'string' ? payload.url.trim() : '';
    if (!url) {
      return NextResponse.json(
        { ok: false, error: 'Informe a URL que receberá as notificações.' },
        { status: 400 }
      );
    }

    const triggers = normalizeTriggers(payload?.triggers);
    if (!triggers) {
      return NextResponse.json(
        { ok: false, error: 'Informe os gatilhos do webhook como uma lista válida.' },
        { status: 400 }
      );
    }

    if (triggers.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Informe pelo menos um gatilho para o webhook.' },
        { status: 400 }
      );
    }

    const name = typeof payload?.name === 'string' ? payload.name.trim() : undefined;
    const products = typeof payload?.products === 'string' ? payload.products.trim() : undefined;
    const token = typeof payload?.token === 'string' ? payload.token.trim() : undefined;

    const webhook = await createWebhook({ url, triggers, name, products, token });

    return NextResponse.json({ ok: true, webhook });
  } catch (error) {
    console.error('create_webhook_failed', error);
    const message = error instanceof Error ? error.message : 'Não foi possível criar o webhook agora.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}