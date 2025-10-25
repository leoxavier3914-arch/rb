import { describe, expect, it, vi, beforeEach } from 'vitest';
import { kiwifyFetch } from '@/lib/kiwify/http';
import * as client from '@/lib/kiwify/client';
import * as env from '@/lib/env';

const loadEnvMock = vi.spyOn(env, 'loadEnv');

vi.mock('@/lib/kiwify/client');

describe('kiwifyFetch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    loadEnvMock.mockReturnValue({
      KIWIFY_API_BASE_URL: 'https://public-api.kiwify.com',
      KIWIFY_ACCOUNT_ID: 'acc_123'
    } as env.AppEnv);
  });

  it('renova token ao receber 401', async () => {
    const getAccessToken = vi.spyOn(client, 'getAccessToken');
    getAccessToken.mockResolvedValueOnce('token1');
    getAccessToken.mockResolvedValueOnce('token2');

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const response = await kiwifyFetch('/v1/products');
    expect(response.status).toBe(200);
    expect(getAccessToken).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tenta novamente em erros transitórios', async () => {
    const getAccessToken = vi.spyOn(client, 'getAccessToken');
    getAccessToken.mockResolvedValue('token');

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const response = await kiwifyFetch('/v1/products', { budgetEndsAt: Date.now() + 1_000 });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
