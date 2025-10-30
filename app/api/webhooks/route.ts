import { NextResponse } from 'next/server';
import { createWebhook } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

function normalizeEvents(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const events = value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(item => item.length > 0);
  return events.length > 0 ? events : [];
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as
      | { url?: unknown; events?: unknown; status?: unknown; secret?: unknown }
      | null;

    const url = typeof payload?.url === 'string' ? payload.url.trim() : '';
    if (!url) {
      return NextResponse.json(
        { ok: false, error: 'Informe a URL que receberá as notificações.' },
        { status: 400 }
      );
    }

    const events = normalizeEvents(payload?.events);
    if (!events) {
      return NextResponse.json(
        { ok: false, error: 'Informe os eventos do webhook como uma lista.' },
        { status: 400 }
      );
    }

    if (events.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Informe pelo menos um evento para o webhook.' },
        { status: 400 }
      );
    }

    const status = typeof payload?.status === 'string' ? payload.status : undefined;
    const secret =
      typeof payload?.secret === 'string' && payload.secret.trim() !== '' ? payload.secret : undefined;

    const webhook = await createWebhook({ url, events, status, secret });

    return NextResponse.json({ ok: true, webhook });
  } catch (error) {
    console.error('create_webhook_failed', error);
    const message = error instanceof Error ? error.message : 'Não foi possível criar o webhook agora.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
