import { getAccessToken } from './client';
import { loadEnv } from '@/lib/env';

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export interface KiwifyRequestInit extends RequestInit {
  readonly budgetEndsAt?: number;
}

export async function kiwifyFetch(path: string, init: KiwifyRequestInit = {}, attempt = 1): Promise<Response> {
  const env = loadEnv();
  const budgetEndsAt = init.budgetEndsAt ?? Number.POSITIVE_INFINITY;
  const timeout = Math.min(8000, Math.max(0, budgetEndsAt - Date.now()));
  const controller = new AbortController();
  const token = await getAccessToken();

  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-kiwify-account-id', env.KIWIFY_ACCOUNT_ID ?? '');

  const url = `${env.KIWIFY_API_BASE_URL ?? ''}${path}`;
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers
    });

    if (response.status === 401 || response.status === 403) {
      if (attempt > 1) {
        return response;
      }
      await getAccessToken(true);
      return kiwifyFetch(path, init, attempt + 1);
    }

    if (RETRYABLE_STATUS.has(response.status) && attempt < 3 && Date.now() < budgetEndsAt) {
      await delay(Math.min(800, 400 * attempt));
      return kiwifyFetch(path, init, attempt + 1);
    }

    return response;
  } catch (error) {
    if (attempt >= 3 || Date.now() >= budgetEndsAt) {
      throw error;
    }
    await delay(Math.min(800, 400 * attempt));
    return kiwifyFetch(path, init, attempt + 1);
  } finally {
    clearTimeout(id);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
