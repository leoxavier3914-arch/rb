import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAccessTokenMock = vi.fn();

vi.mock('@/lib/kiwify/client', () => ({
  getAccessToken: (...args: unknown[]) => getAccessTokenMock(...args),
}));

const originalFetch = global.fetch;

describe('kiwifyFetch', () => {
  beforeEach(() => {
    process.env.KIWIFY_API_BASE_URL = 'https://api.example.com';
    process.env.KIWIFY_ACCOUNT_ID = 'acc_1';
    getAccessTokenMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('revalida token em respostas 401 e repete a requisição', async () => {
    const responses = [
      new Response('unauthorized', { status: 401 }),
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ];
    const fetchSpy = vi.fn(async () => responses.shift()!);
    global.fetch = fetchSpy as typeof fetch;
    getAccessTokenMock.mockResolvedValueOnce('token-1');
    getAccessTokenMock.mockResolvedValueOnce('token-2');

    const { kiwifyFetch } = await import('@/lib/kiwify/http');
    const res = await kiwifyFetch('/sales');

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(getAccessTokenMock).toHaveBeenNthCalledWith(1, false);
    expect(getAccessTokenMock).toHaveBeenNthCalledWith(2, true);
  });

  it('repete requisições em 429/5xx até três tentativas', async () => {
    vi.useFakeTimers();
    const responses = [
      new Response('too many', { status: 429 }),
      new Response('error', { status: 500 }),
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ];
    const fetchSpy = vi.fn(async () => responses.shift()!);
    global.fetch = fetchSpy as typeof fetch;
    getAccessTokenMock.mockResolvedValue('token');

    const { kiwifyFetch } = await import('@/lib/kiwify/http');
    const promise = kiwifyFetch('/sales');

    await vi.advanceTimersByTimeAsync(2000);
    const res = await promise;

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});

