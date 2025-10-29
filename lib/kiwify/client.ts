import { loadEnv } from '@/lib/env';
import { resolveApiUrl, resolveTokenUrl } from './baseUrl';

export interface KiwifyClient {
  readonly token: string;
  readonly accountId?: string;
  readonly baseUrl?: string;
  request(path: string, init?: RequestInit): Promise<Response>;
}

export async function createKiwifyClient(): Promise<KiwifyClient> {
  const env = loadEnv();
  const clientId = env.KIWIFY_CLIENT_ID;
  const clientSecret = env.KIWIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Credenciais da Kiwify não configuradas.');
  }

  const token = await fetchAccessToken(clientId, clientSecret, env.KIWIFY_API_BASE_URL);
  const accountId = env.KIWIFY_ACCOUNT_ID ?? undefined;
  const baseUrl = env.KIWIFY_API_BASE_URL;

  return {
    token,
    accountId,
    baseUrl,
    request(path: string, init?: RequestInit) {
      const headers = new Headers(init?.headers);
      headers.set('authorization', `Bearer ${token}`);
      if (accountId) {
        headers.set('x-kiwify-account-id', accountId);
      }

      return fetch(resolveApiUrl(baseUrl, path), {
        ...init,
        headers
      });
    }
  };
}

export async function fetchAccessToken(
  clientId: string,
  clientSecret: string,
  baseUrl: string | undefined
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret
  });

  const response = await fetch(resolveTokenUrl(baseUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter token OAuth da Kiwify: ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const token = typeof payload.access_token === 'string' ? payload.access_token : null;
  if (!token) {
    throw new Error('Resposta inválida ao solicitar token da Kiwify.');
  }

  return token;
}
