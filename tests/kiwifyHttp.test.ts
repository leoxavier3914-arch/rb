import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { kiwifyFetch } from '@/lib/kiwify/http';
import * as client from '@/lib/kiwify/client';
import * as env from '@/lib/env';

const loadEnvMock = vi.spyOn(env, 'loadEnv');

vi.mock('@/lib/kiwify/client');

describe('kiwifyFetch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    loadEnvMock.mockReturnValue({
      KIWIFY_API_BASE_URL: 'https://public-api.kiwify.com',
      KIWIFY_ACCOUNT_ID: 'acc_123'
    } as env.AppEnv);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renova token ao receber 401', async () => {
    const getAccessToken = vi.spyOn(client, 'getAccessToken');
    getAccessToken
      .mockResolvedValueOnce('token1')
      .mockResolvedValueOnce('token2');

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const promise = kiwifyFetch('/v1/products', { budgetEndsAt: Date.now() + 10_000 });
    const response = await promise;

    expect(response.status).toBe(200);
    expect(getAccessToken).toHaveBeenNthCalledWith(1, false);
    expect(getAccessToken).toHaveBeenNthCalledWith(2, true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tenta novamente em erros transitórios com respeito ao orçamento', async () => {
    const getAccessToken = vi.spyOn(client, 'getAccessToken');
    getAccessToken.mockResolvedValue('token');

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const promise = kiwifyFetch('/v1/products', { budgetEndsAt: Date.now() + 5_000 });
    await vi.advanceTimersByTimeAsync(800);
    const response = await promise;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('lança quando orçamento esgota antes do retry', async () => {
    const getAccessToken = vi.spyOn(client, 'getAccessToken');
    getAccessToken.mockResolvedValue('token');

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    const promise = kiwifyFetch('/v1/products', { budgetEndsAt: Date.now() + 100 });
    const handled = promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(200);
    await expect(promise).rejects.toThrow('Kiwify request budget exceeded');
    await handled;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
