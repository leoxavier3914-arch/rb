import { NextResponse } from 'next/server';

import {
  resolveIncomingWebhookEvent,
  storeWebhookEvent,
  verifyIncomingWebhookSignature
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

  const verification = await verifyIncomingWebhookSignature({
    rawBody: body,
    signature: incoming.signature,
    signatureAlgorithm: incoming.signatureAlgorithm,
    webhookToken: incoming.webhookToken,
    webhookId: incoming.webhookId
  });

  try {
    const eventPayload = await storeWebhookEvent({
      eventId: incoming.eventId,
      trigger: incoming.trigger,
      status: incoming.status,
      source: incoming.source,
      webhookToken: verification.token ?? incoming.webhookToken,
      headers: incoming.headers,
      payload: incoming.payload,
      occurredAt: incoming.occurredAt,
      receivedAt: incoming.receivedAt
    });

    return NextResponse.json({
      ok: true,
      event: eventPayload,
      signatureVerified: verification.verified,
      verifiedWebhookId: verification.webhookId ?? incoming.webhookId,
      matchedToken: verification.token ?? incoming.webhookToken ?? null
    });
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
