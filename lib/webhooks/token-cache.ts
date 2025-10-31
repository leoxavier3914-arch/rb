import { createKiwifyClient } from '@/lib/kiwify/client';
import { listWebhooks } from '@/lib/webhooks';
import { listWebhookSettings } from '@/lib/webhooks/settings';

const WEBHOOK_TOKENS_CACHE_TTL_MS = 60_000;

interface WebhookTokensCache {
  tokens: string[];
  byToken: Map<string, string>;
  expiresAt: number;
}

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
let cachedTokens: WebhookTokensCache | null = null;

async function ensureWebhookTokensCache(): Promise<WebhookTokensCache> {
  const now = Date.now();
  const previousCache = cachedTokens;
  if (previousCache && previousCache.expiresAt > now) {
    return previousCache;
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
      if (previousCache) {
        const mergedTokens = [...tokens];
        const mergedByToken = new Map(previousCache.byToken);

        for (const token of previousCache.tokens) {
          const normalized = typeof token === 'string' ? token.trim() : '';
          if (!normalized || seen.has(normalized)) {
            continue;
          }
          mergedTokens.push(normalized);
          seen.add(normalized);
        }

        for (const [token, webhookId] of byToken.entries()) {
          mergedByToken.set(token, webhookId);
        }

        cachedTokens = {
          tokens: mergedTokens,
          byToken: mergedByToken,
          expiresAt: now + WEBHOOK_TOKENS_CACHE_TTL_MS / 2
        };
        return cachedTokens;
      }
    }

    cachedTokens = {
      tokens,
      byToken,
      expiresAt: now + WEBHOOK_TOKENS_CACHE_TTL_MS
    };

    return cachedTokens;
  } catch (error) {
    console.error('load_known_webhook_tokens_failed', error);
    if (previousCache) {
      cachedTokens = {
        ...previousCache,
        expiresAt: now + WEBHOOK_TOKENS_CACHE_TTL_MS / 2
      };
      return cachedTokens;
    }

    cachedTokens = {
      tokens: [],
      byToken: new Map(),
      expiresAt: now + WEBHOOK_TOKENS_CACHE_TTL_MS / 2
    };
    return cachedTokens;
  }
}

export async function loadKnownWebhookTokens(): Promise<string[]> {
  const cache = await ensureWebhookTokensCache();
  return cache.tokens;
}

export async function resolveWebhookIdFromToken(token: string | null): Promise<string | null> {
  const normalized = typeof token === 'string' ? token.trim() : '';
  if (!normalized) {
    return null;
  }

  const cache = await ensureWebhookTokensCache();
  return cache.byToken.get(normalized) ?? null;
}

function resetTestingState() {
  cachedTokens = null;
  dependencies = { ...defaultDependencies };
}

function setDependencies(overrides: Partial<WebhookTokensDependencies>) {
  dependencies = { ...dependencies, ...overrides };
  cachedTokens = null;
}

export const __testing = {
  ensureWebhookTokensCache,
  resolveWebhookIdFromToken,
  loadKnownWebhookTokens,
  resetTestingState,
  setDependencies
};
