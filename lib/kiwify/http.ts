import { getAccessToken } from './client';
import { loadEnv } from '@/lib/env';

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export interface KiwifyRequestInit extends Omit<RequestInit, 'body'> {
  readonly budgetEndsAt?: number;
  readonly json?: unknown;
}

export async function kiwifyFetch(path: string, init: KiwifyRequestInit = {}): Promise<Response> {
  const env = loadEnv();
  const budgetEndsAt = init.budgetEndsAt ?? Number.POSITIVE_INFINITY;
  let attempt = 1;
  let forceRefresh = false;

  while (true) {
    const now = Date.now();
    if (now >= budgetEndsAt) {
      throw new Error('Kiwify request budget exceeded');
    }

    const timeout = Math.min(8000, Math.max(0, budgetEndsAt - now));
    if (timeout <= 0) {
      throw new Error('Kiwify request budget exceeded');
    }

    const controller = new AbortController();
    const token = await getAccessToken(forceRefresh);
    forceRefresh = false;
    const headers = new Headers(init.headers ?? {});
    headers.set('authorization', `Bearer ${token}`);
    if (env.KIWIFY_ACCOUNT_ID) {
      headers.set('x-kiwify-account-id', env.KIWIFY_ACCOUNT_ID);
    }

    let body: BodyInit | null | undefined = init.body;
    if (init.json !== undefined) {
      body = JSON.stringify(init.json);
      headers.set('content-type', 'application/json');
    } else if (
      body &&
      typeof body === 'object' &&
      body.constructor === Object &&
      !(body instanceof ArrayBuffer) &&
      !ArrayBuffer.isView(body) &&
      !(body instanceof FormData) &&
      !(body instanceof URLSearchParams)
    ) {
      body = JSON.stringify(body);
      headers.set('content-type', 'application/json');
    }

    const requestInit: RequestInit = {
      ...init,
      body,
      headers,
      signal: controller.signal
    };
    delete (requestInit as Partial<KiwifyRequestInit>).budgetEndsAt;
    delete (requestInit as Partial<KiwifyRequestInit>).json;

    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${env.KIWIFY_API_BASE_URL ?? ''}${path}`, requestInit);

      if ((response.status === 401 || response.status === 403) && attempt === 1) {
        attempt += 1;
        clearTimeout(id);
        forceRefresh = true;
        continue;
      }

      if (RETRYABLE_STATUS.has(response.status) && attempt < 3) {
        const delayMs = await computeDelay(budgetEndsAt, attempt);
        if (delayMs === null) {
          return response;
        }
        attempt += 1;
        clearTimeout(id);
        await delay(delayMs);
        continue;
      }

      return response;
    } catch (error) {
      if (attempt >= 3) {
        throw error;
      }

      const delayMs = await computeDelay(budgetEndsAt, attempt);
      if (delayMs === null) {
        throw error;
      }
      attempt += 1;
      forceRefresh = true;
      await delay(delayMs);
    } finally {
      clearTimeout(id);
    }
  }
}

async function computeDelay(budgetEndsAt: number, attempt: number): Promise<number | null> {
  const remaining = budgetEndsAt - Date.now();
  if (remaining <= 0) {
    return null;
  }

  const base = Math.min(800, 400 * attempt);
  const jitter = base < 800 ? Math.random() * 200 : 0;
  return Math.min(base + jitter, remaining);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
