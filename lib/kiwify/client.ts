import { z } from 'zod';
import { loadEnv } from '@/lib/env';
import { resolveTokenUrl } from './baseUrl';
import { getServiceClient } from '@/lib/supabase';

const TOKEN_STATE_ID = 'kiwify_token';

const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int()
});

const persistedTokenSchema = z.object({
  access_token: z.string(),
  expires_at: z.string().transform((value, ctx) => {
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid expires_at' });
    }
    return timestamp;
  })
});

interface CachedToken {
  readonly token: string;
  readonly expiresAt: number;
}

let cachedToken: CachedToken | null = null;
let loadingPromise: Promise<CachedToken | null> | null = null;

export async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const cached = await getCachedToken();
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached.token;
    }
  }

  const fresh = await fetchAndPersistToken();
  return fresh.token;
}

async function getCachedToken(): Promise<CachedToken | null> {
  if (cachedToken) {
    return cachedToken;
  }

  if (!loadingPromise) {
    loadingPromise = loadPersistedToken();
  }

  cachedToken = await loadingPromise;
  loadingPromise = null;
  return cachedToken;
}

async function loadPersistedToken(): Promise<CachedToken | null> {
  try {
    const client = getServiceClient();
    const { data, error } = await client.from('app_state').select('value').eq('id', TOKEN_STATE_ID).single();
    if (error || !data) {
      return null;
    }

    const parsed = persistedTokenSchema.safeParse(data.value);
    if (!parsed.success) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'kiwify_token_cache_invalid',
          error: parsed.error.message
        })
      );
      return null;
    }

    return {
      token: parsed.data.access_token,
      expiresAt: parsed.data.expires_at
    };
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'kiwify_token_cache_read_failed', error }));
    return null;
  }
}

async function fetchAndPersistToken(): Promise<CachedToken> {
  const env = loadEnv();
  if (!env.KIWIFY_API_BASE_URL || !env.KIWIFY_CLIENT_ID || !env.KIWIFY_CLIENT_SECRET) {
    throw new Error('Credenciais da Kiwify não configuradas');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.KIWIFY_CLIENT_ID,
    client_secret: env.KIWIFY_CLIENT_SECRET
  });

  const tokenUrl = resolveTokenUrl(env.KIWIFY_API_BASE_URL);
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter token da Kiwify: ${response.status}`);
  }

  const payload = await response.json();
  const parsed = tokenResponseSchema.parse(payload);
  const expiresAt = Date.now() + parsed.expires_in * 1000;

  cachedToken = {
    token: parsed.access_token,
    expiresAt
  };

  try {
    const client = getServiceClient();
    const { error } = await client.from('app_state').upsert({
      id: TOKEN_STATE_ID,
      value: {
        access_token: parsed.access_token,
        expires_at: new Date(expiresAt).toISOString()
      }
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'kiwify_token_cache_write_failed', error }));
  }

  return cachedToken;
}
