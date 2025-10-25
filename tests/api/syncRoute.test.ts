import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  assertIsAdmin: vi.fn(),
}));

const runSyncMock = vi.fn();
const getCursorMock = vi.fn();
const setCursorMock = vi.fn();

vi.mock('@/lib/kiwify/syncEngine', () => ({
  runSync: (...args: unknown[]) => runSyncMock(...args),
}));

vi.mock('@/lib/kiwify/syncState', () => ({
  getSyncCursor: () => getCursorMock(),
  setSyncCursor: (...args: unknown[]) => setCursorMock(...args),
}));

beforeEach(() => {
  runSyncMock.mockReset();
  getCursorMock.mockReset();
  setCursorMock.mockReset();
});

describe('sync route', () => {
  it('retorna estado persistido no GET', async () => {
    getCursorMock.mockResolvedValue({ cursor: { resource: 'sales' }, lastRunAt: '2024-01-01T00:00:00Z' });

    const { GET } = await import('@/app/api/kfy/sync/route');
    const request = new NextRequest('http://localhost/api/kfy/sync');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.state).toEqual({ cursor: { resource: 'sales' }, lastRunAt: '2024-01-01T00:00:00Z' });
  });

  it('usa cursor persistido quando persist=true', async () => {
    getCursorMock.mockResolvedValue({ cursor: { resource: 'products', page: 2 } });
    runSyncMock.mockResolvedValue({
      ok: true,
      done: false,
      nextCursor: { resource: 'sales', page: 1 },
      stats: { pagesFetched: 1 },
      logs: [],
    });

    const { POST } = await import('@/app/api/kfy/sync/route');
    const request = new NextRequest('http://localhost/api/kfy/sync', {
      method: 'POST',
      body: JSON.stringify({ persist: true }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(runSyncMock).toHaveBeenCalledWith({
      full: undefined,
      range: null,
      cursor: { resource: 'products', page: 2 },
    }, expect.any(Number));
    expect(setCursorMock).toHaveBeenCalledWith({ resource: 'sales', page: 1 }, { pagesFetched: 1 });
    expect(body.nextCursor).toEqual({ resource: 'sales', page: 1 });
  });
});

