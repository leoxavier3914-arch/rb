import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/kfy/sync/route';
import type { SyncRequest, SyncResult } from '@/lib/kiwify/syncEngine';

const mocks = vi.hoisted(() => {
  const runSyncMock = vi.fn<[_: SyncRequest], Promise<SyncResult>>();
  return {
    assertIsAdminMock: vi.fn(),
    buildRateLimitKeyMock: vi.fn(() => 'key'),
    checkRateLimitMock: vi.fn(),
    getSyncCursorMock: vi.fn(),
    setSyncCursorMock: vi.fn(),
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

vi.mock('@/lib/kiwify/syncState', () => ({
  getSyncCursor: mocks.getSyncCursorMock,
  setSyncCursor: mocks.setSyncCursorMock
}));

vi.mock('@/lib/cache', () => ({
  delByPrefix: mocks.delByPrefixMock,
  METRICS_CACHE_PREFIXES: ['metrics:']
}));

vi.mock('@/lib/kiwify/syncEngine', () => ({
  runSync: mocks.runSyncMock
}));

const { assertIsAdminMock, buildRateLimitKeyMock, checkRateLimitMock, getSyncCursorMock, runSyncMock } = mocks;

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
    getSyncCursorMock.mockResolvedValue(null);
    runSyncMock.mockResolvedValue({
      ok: true,
      done: true,
      nextCursor: null,
      stats: {},
      logs: []
    });
  });

  it('respects rate limit for standard sync requests', async () => {
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

  it('bypasses rate limit for backfill operations', async () => {
    const response = await POST(buildRequest({ persist: true }));

    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it('permite reiniciar o cursor quando null é enviado explicitamente', async () => {
    getSyncCursorMock.mockResolvedValue({
      resource: 'sales',
      page: 1,
      intervalIndex: 0,
      done: false
    });

    const response = await POST(buildRequest({ cursor: null }));

    expect(response.status).toBe(200);
    expect(getSyncCursorMock).not.toHaveBeenCalled();
    expect(runSyncMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: null })
    );
  });

  it('usa cursor persistido quando não for informado no corpo', async () => {
    const persistedCursor = { resource: 'products', page: 2, intervalIndex: 1, done: false };
    getSyncCursorMock.mockResolvedValueOnce(persistedCursor);

    const response = await POST(buildRequest({}));

    expect(response.status).toBe(200);
    expect(getSyncCursorMock).toHaveBeenCalledTimes(1);
    expect(runSyncMock).toHaveBeenCalledWith(expect.objectContaining({ cursor: persistedCursor }));
  });
});
