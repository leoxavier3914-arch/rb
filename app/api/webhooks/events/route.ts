import { NextResponse } from 'next/server';

import {
  resolveIncomingWebhookEvent,
  storeWebhookEvent
} from '@/lib/webhooks/events';
import { createKiwifyClient } from '@/lib/kiwify/client';
import { listWebhooks } from '@/lib/webhooks';
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

  let webhookId = incoming.webhookId;
  if (!webhookId && webhookToken) {
    webhookId = await resolveWebhookIdFromToken(webhookToken);
  }

  try {
    const event = await storeWebhookEvent({
      ...incoming,
      webhookId,
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

interface WebhookTokensCache {
  tokens: string[];
  byToken: Map<string, string>;
  expiresAt: number;
}

let cachedTokens: WebhookTokensCache | null = null;

type WebhookTokensDependencies = {
  listWebhookSettings: typeof listWebhookSettings;
  createKiwifyClient: typeof createKiwifyClient;
  listWebhooks: typeof listWebhooks;
};

const defaultDependencies: WebhookTokensDependencies = {
  listWebhookSettings,
  createKiwifyClient,
  listWebhooks
};

let dependencies: WebhookTokensDependencies = { ...defaultDependencies };

async function ensureWebhookTokensCache(): Promise<WebhookTokensCache> {
  const now = Date.now();
  if (cachedTokens && cachedTokens.expiresAt > now) {
    return cachedTokens;
  }

  try {
    const {
      listWebhookSettings: loadSettings,
      createKiwifyClient: buildClient,
      listWebhooks: fetchWebhooks
    } = dependencies;

    const settings = await loadSettings();
    const tokens: string[] = [];
    const byToken = new Map<string, string>();
    const seen = new Set<string>();

    for (const setting of settings) {
      const token = typeof setting.token === 'string' ? setting.token.trim() : '';
      if (!token) {
        continue;
      }
      if (!seen.has(token)) {
        tokens.push(token);
        seen.add(token);
      }

      const webhookId = typeof setting.webhookId === 'string' ? setting.webhookId.trim() : '';
      if (webhookId && !byToken.has(token)) {
        byToken.set(token, webhookId);
      }
    }

    try {
      const client = await buildClient();
      const webhooks = await fetchWebhooks(client);

      for (const webhook of webhooks) {
        const token = typeof webhook.token === 'string' ? webhook.token.trim() : '';
        if (!token) {
          continue;
        }
        if (!seen.has(token)) {
          tokens.push(token);
          seen.add(token);
        }

        const webhookId = typeof webhook.id === 'string' ? webhook.id.trim() : '';
        if (webhookId && !byToken.has(token)) {
          byToken.set(token, webhookId);
        }
      }
    } catch (error) {
      console.error('load_remote_webhooks_failed', error);
    }

    cachedTokens = {
      tokens,
      byToken,
      expiresAt: now + WEBHOOK_TOKENS_CACHE_TTL_MS
    };

    return cachedTokens;
  } catch (error) {
    console.error('load_known_webhook_tokens_failed', error);
    cachedTokens = {
      tokens: [],
      byToken: new Map(),
      expiresAt: now + WEBHOOK_TOKENS_CACHE_TTL_MS / 2
    };
    return cachedTokens;
  }
}

async function loadKnownWebhookTokens(): Promise<string[]> {
  const cache = await ensureWebhookTokensCache();
  return cache.tokens;
}

async function resolveWebhookIdFromToken(token: string | null): Promise<string | null> {
  const normalized = typeof token === 'string' ? token.trim() : '';
  if (!normalized) {
    return null;
  }

  const cache = await ensureWebhookTokensCache();
  return cache.byToken.get(normalized) ?? null;
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

export const __testing = {
  ensureWebhookTokensCache,
  resolveWebhookIdFromToken,
  loadKnownWebhookTokens,
  resetTestingState() {
    cachedTokens = null;
    dependencies = { ...defaultDependencies };
  },
  setDependencies(overrides: Partial<WebhookTokensDependencies>) {
    dependencies = { ...dependencies, ...overrides };
    cachedTokens = null;
  }
};
