import { getAccessToken } from './client';

export async function kiwifyFetch(path: string, init?: RequestInit, attempt = 1): Promise<Response> {
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

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });

  if ((res.status === 401 || res.status === 403) && attempt === 1) {
    token = await getAccessToken(true);
    headers.set('authorization', `Bearer ${token}`);
    return kiwifyFetch(path, { ...init, headers }, 2);
  }

  return res;
}
