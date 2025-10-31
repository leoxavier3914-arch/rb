import { NextResponse } from 'next/server';

import {
  resolveIncomingWebhookEvent,
  storeWebhookEvent
} from '@/lib/webhooks/events';
import { listWebhookSettings } from '@/lib/webhooks/settings';
import { inferWebhookTokenFromSignature } from '@/lib/webhooks/signature';

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
  const rawBody = typeof body === 'string' ? body : '';

  const incoming = resolveIncomingWebhookEvent({
    payload: parsed,
    headers: request.headers,
    receivedAt
  });

  let webhookToken = incoming.webhookToken;

  if (!webhookToken) {
    try {
      const inferredToken = await resolveTokenFromSignature(incoming.headers, rawBody);
      if (inferredToken) {
        webhookToken = inferredToken;
      }
    } catch (error) {
      console.error('infer_webhook_token_from_signature_failed', error);
    }
  }

  try {
    const event = await storeWebhookEvent({
      ...incoming,
      webhookToken
    });
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    console.error('store_webhook_event_failed', error);
    const message =
      error instanceof Error ? error.message : 'Não foi possível registrar o evento do webhook agora.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function resolveTokenFromSignature(
  headers: Record<string, string>,
  rawBody: string
): Promise<string | null> {
  const knownTokens = await loadKnownWebhookTokens();
  if (knownTokens.length === 0) {
    return null;
  }

  return inferWebhookTokenFromSignature({
    headers,
    rawBody,
    knownTokens
  });
}

const WEBHOOK_TOKENS_CACHE_TTL_MS = 60_000;

let cachedTokens:
  | {
      readonly tokens: string[];
      readonly expiresAt: number;
    }
  | null = null;

async function loadKnownWebhookTokens(): Promise<string[]> {
  const now = Date.now();
  if (cachedTokens && cachedTokens.expiresAt > now) {
    return cachedTokens.tokens;
  }

  try {
    const settings = await listWebhookSettings();
    const tokens = settings
      .map(setting => (typeof setting.token === 'string' ? setting.token.trim() : ''))
      .filter((token): token is string => token.length > 0);

    cachedTokens = {
      tokens,
      expiresAt: now + WEBHOOK_TOKENS_CACHE_TTL_MS
    };

    return tokens;
  } catch (error) {
    console.error('load_known_webhook_tokens_failed', error);
    cachedTokens = {
      tokens: [],
      expiresAt: now + WEBHOOK_TOKENS_CACHE_TTL_MS / 2
    };
    return [];
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
