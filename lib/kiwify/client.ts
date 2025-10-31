import { loadEnv } from '@/lib/env';
import { resolveApiUrl, resolveTokenUrl } from './baseUrl';

interface UnknownRecord {
  readonly [key: string]: unknown;
}

export interface KiwifyClient {
  readonly token: string;
  readonly accountId?: string;
  readonly baseUrl?: string;
  request(path: string, init?: RequestInit): Promise<Response>;
}

export interface KiwifyProduct {
  readonly id: string;
  readonly name: string;
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

export async function listProducts(client?: KiwifyClient): Promise<readonly KiwifyProduct[]> {
  const resolvedClient = client ?? (await createKiwifyClient());
  const response = await resolvedClient.request('/products');

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Falha ao listar produtos na Kiwify: ${response.status} ${body.slice(0, 120)}`);
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const records = extractProductRecords(payload);

  return records
    .map(parseProduct)
    .filter((product): product is KiwifyProduct => product !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
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

function extractProductRecords(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (isRecord(payload)) {
    if (Array.isArray(payload.data)) {
      return payload.data.filter(isRecord);
    }
    if (Array.isArray(payload.items)) {
      return payload.items.filter(isRecord);
    }
    if (Array.isArray(payload.products)) {
      return payload.products.filter(isRecord);
    }
    if (isRecord(payload.data)) {
      return [payload.data];
    }
    return [payload];
  }

  return [];
}

function parseProduct(payload: UnknownRecord): KiwifyProduct | null {
  const id = toNullableString(payload.id ?? payload.uuid);
  const name = toNullableString(payload.name ?? payload.title ?? payload.product_name);

  if (!id || !name) {
    return null;
  }

  return { id, name };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function toNullableString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  return null;
}
