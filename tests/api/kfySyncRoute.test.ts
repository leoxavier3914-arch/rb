import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/kfy/sync/route';
import type { SyncRequest, SyncResult } from '@/lib/kiwify/syncEngine';

const mocks = vi.hoisted(() => {
  const runSyncMock = vi.fn<[_: SyncRequest], Promise<SyncResult>>();
  return {
    assertIsAdminMock: vi.fn(),
    buildRateLimitKeyMock: vi.fn(() => 'key'),
    checkRateLimitMock: vi.fn(),
    delByPrefixMock: vi.fn(),
    runSyncMock
  };
});

vi.mock('@/lib/auth', () => ({
  assertIsAdmin: mocks.assertIsAdminMock
}));

vi.mock('@/lib/rateLimit', () => ({
  buildRateLimitKey: mocks.buildRateLimitKeyMock,
  checkRateLimit: mocks.checkRateLimitMock
}));

vi.mock('@/lib/cache', () => ({
  delByPrefix: mocks.delByPrefixMock,
  METRICS_CACHE_PREFIXES: ['metrics:']
}));

vi.mock('@/lib/kiwify/syncEngine', () => ({
  runSync: mocks.runSyncMock
}));

const { assertIsAdminMock, buildRateLimitKeyMock, checkRateLimitMock, delByPrefixMock, runSyncMock } = mocks;

function buildRequest(body: unknown): import('next/server').NextRequest {
  const request = new Request('https://example.com/api/kfy/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }) as unknown as import('next/server').NextRequest;
  (request as unknown as { nextUrl: URL }).nextUrl = new URL('https://example.com/api/kfy/sync');
  (request as unknown as { ip?: string }).ip = '127.0.0.1';
  return request;
}

describe('POST /api/kfy/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    checkRateLimitMock.mockResolvedValue({ allowed: true, remaining: 1 });
    runSyncMock.mockResolvedValue({
      ok: true,
      done: true,
      nextCursor: null,
      stats: {},
      logs: []
    });
  });

  it('respects rate limit for non-persistent requests', async () => {
    checkRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0 });

    const response = await POST(buildRequest({}));

    expect(checkRateLimitMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: 'rate_limited',
      error: 'Too many requests, try again soon.'
    });
    expect(runSyncMock).not.toHaveBeenCalled();
  });

  it('bypasses rate limit for persistent runs', async () => {
    const response = await POST(buildRequest({ persist: true }));

    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(delByPrefixMock).toHaveBeenCalledWith(['metrics:']);
  });

  it('forwards body to runSync', async () => {
    const response = await POST(buildRequest({ persist: true, resources: ['sales'], since: '2024-01-01' }));

    expect(response.status).toBe(200);
    expect(runSyncMock).toHaveBeenCalledWith({ persist: true, resources: ['sales'], since: '2024-01-01' });
  });

  it('returns failure payload when sync fails', async () => {
    runSyncMock.mockResolvedValueOnce({
      ok: false,
      done: true,
      nextCursor: null,
      stats: {},
      logs: ['failed reason']
    });

    const response = await POST(buildRequest({ persist: true }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: 'sync_failed',
      error: 'failed reason'
    });
  });
});
