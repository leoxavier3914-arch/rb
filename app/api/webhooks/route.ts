import { NextResponse } from 'next/server';
import { createWebhook } from '@/lib/webhooks';
import {
  normalizeWebhookTriggers,
  type WebhookTrigger
} from '@/lib/webhooks/triggers';

export const dynamic = 'force-dynamic';

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

    let products: string | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(payload ?? {}, 'products')) {
      if (payload?.products === null) {
        products = null;
      } else if (typeof payload?.products === 'string') {
        const trimmed = payload.products.trim();
        products = trimmed.length > 0 ? trimmed : null;
      } else {
        return NextResponse.json(
          { ok: false, error: 'Informe os produtos como uma string válida.' },
          { status: 400 }
        );
      }
    }

    const token = typeof payload?.token === 'string' ? payload.token.trim() : undefined;

    const webhook = await createWebhook({ url, triggers, name, products, token });

    return NextResponse.json({ ok: true, webhook });
  } catch (error) {
    console.error('create_webhook_failed', error);
    const message = error instanceof Error ? error.message : 'Não foi possível criar o webhook agora.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
