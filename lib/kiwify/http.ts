import { getAccessToken } from './client';

type Budget = { left: () => number } | undefined;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function kiwifyFetch(
  path: string,
  init?: RequestInit,
  attempt = 1,
  budget?: Budget,
): Promise<Response> {
  const base = process.env.KIWIFY_API_BASE_URL;
  const accountId = process.env.KIWIFY_ACCOUNT_ID;

  if (!base) {
    throw new Error('KIWIFY_API_BASE_URL não configurado');
  }
  if (!accountId) {
    throw new Error('KIWIFY_ACCOUNT_ID não configurado');
  }

  let token = await getAccessToken(false);
  const headers = new Headers(init?.headers ?? {});
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-kiwify-account-id', accountId);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const controller = new AbortController();
  const timeoutMs = Math.min(8000, Math.max(1000, budget?.left?.() ?? 8000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers,
    });

    if ((res.status === 401 || res.status === 403) && attempt === 1) {
      token = await getAccessToken(true);
      headers.set('authorization', `Bearer ${token}`);
      return kiwifyFetch(path, { ...init, headers }, 2, budget);
    }

    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(400 * attempt);
      return kiwifyFetch(path, init, attempt + 1, budget);
    }

    return res;
  } finally {
    clearTimeout(timeout);
  }
}
