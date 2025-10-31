import { NextResponse } from 'next/server';

import {
  resolveIncomingWebhookEvent,
  storeWebhookEvent
} from '@/lib/webhooks/events';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const receivedAt = new Date();
  let body: string | null = null;
  try {
    body = await request.text();
  } catch (error) {
    console.error('read_webhook_body_failed', error);
  }

  const parsed = parseBody(body);

  const incoming = resolveIncomingWebhookEvent({
    payload: parsed,
    headers: request.headers,
    receivedAt
  });

  try {
    const event = await storeWebhookEvent(incoming);
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    console.error('store_webhook_event_failed', error);
    const message =
      error instanceof Error ? error.message : 'Não foi possível registrar o evento do webhook agora.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function parseBody(body: string | null): unknown {
  if (!body) {
    return {};
  }

  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return {};
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return { raw: trimmed };
  }
}
