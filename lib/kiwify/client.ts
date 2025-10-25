import { z } from 'zod';
import { loadEnv } from '@/lib/env';

const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal('Bearer'),
  expires_in: z.number()
});

interface CachedToken {
  readonly token: string;
  readonly expiresAt: number;
}

let cachedToken: CachedToken | null = null;

export async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const env = loadEnv();
  if (!env.KIWIFY_CLIENT_ID || !env.KIWIFY_CLIENT_SECRET) {
    throw new Error('Credenciais da Kiwify não configuradas');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.KIWIFY_CLIENT_ID,
    client_secret: env.KIWIFY_CLIENT_SECRET
  });

  const response = await fetch(`${env.KIWIFY_API_BASE_URL ?? ''}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter token da Kiwify: ${response.status}`);
  }

  const json = await response.json();
  const parsed = tokenResponseSchema.parse(json);
  cachedToken = {
    token: parsed.access_token,
    expiresAt: Date.now() + parsed.expires_in * 1000
  };
  return cachedToken.token;
}
