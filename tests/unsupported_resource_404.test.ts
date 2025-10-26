import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KiwifyHttpError, kiwifyFetch } from '@/lib/kiwify/http';
import { runSync } from '@/lib/kiwify/syncEngine';
import * as writes from '@/lib/kiwify/writes';
import * as syncState from '@/lib/kiwify/syncState';
import * as env from '@/lib/env';

vi.mock('@/lib/kiwify/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/kiwify/http')>('@/lib/kiwify/http');
  return { ...actual, kiwifyFetch: vi.fn() };
});

vi.mock('@/lib/kiwify/writes', async () => {
  const actual = await vi.importActual<typeof import('@/lib/kiwify/writes')>('@/lib/kiwify/writes');
  return {
    ...actual,
    upsertProducts: vi.fn(() => Promise.resolve(0)),
    upsertCustomers: vi.fn(() => Promise.resolve(0)),
    upsertCustomer: vi.fn(() => Promise.resolve(0)),
    upsertDerivedCustomers: vi.fn(() => Promise.resolve(0)),
    upsertSales: vi.fn(() => Promise.resolve(0)),
    upsertSubscriptions: vi.fn(() => Promise.resolve(0)),
    upsertEnrollments: vi.fn(() => Promise.resolve(0)),
    upsertCoupons: vi.fn(() => Promise.resolve(0)),
    upsertRefunds: vi.fn(() => Promise.resolve(0)),
    upsertPayouts: vi.fn(() => Promise.resolve(0))
  } satisfies typeof import('@/lib/kiwify/writes');
});

vi.mock('@/lib/kiwify/syncState', () => ({
  setSyncCursor: vi.fn(() => Promise.resolve()),
  getUnsupportedResources: vi.fn(),
  setUnsupportedResources: vi.fn(() => Promise.resolve()),
  getSalesSyncState: vi.fn(() => Promise.resolve(null)),
  setSalesSyncState: vi.fn(() => Promise.resolve())
}));

describe('runSync - unsupported optional resources', () => {
  const loadEnvMock = vi.spyOn(env, 'loadEnv');
  const fetchMock = kiwifyFetch as unknown as vi.Mock;
  const getUnsupportedMock = syncState.getUnsupportedResources as unknown as vi.Mock;
  const setUnsupportedMock = syncState.setUnsupportedResources as unknown as vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    loadEnvMock.mockReturnValue({ SYNC_BUDGET_MS: 20_000, KFY_PAGE_SIZE: 50 } as env.AppEnv);
  });

  it('marks refunds as unsupported after 404 and skips subsequent attempts', async () => {
    getUnsupportedMock
      .mockResolvedValueOnce(new Set<string>())
      .mockResolvedValue(new Set<string>(['refunds']));

    fetchMock.mockImplementation((url: string | URL) => {
      const resolved = typeof url === 'string' ? url : url.toString();
      if (resolved.includes('/v1/account-details')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ created_at: '2023-01-01T00:00:00.000Z' }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        );
      }
      if (resolved.includes('/v1/refunds')) {
        throw new KiwifyHttpError('Not found', {
          status: 404,
          url: resolved,
          isHtml: false
        });
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ data: [], meta: { pagination: { page: 1, total_pages: 1 } } }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });

    const firstRun = await runSync({
      cursor: { resource: 'refunds', page: 1, intervalIndex: 0, done: false },
      full: true
    });

    expect(firstRun.ok).toBe(true);
    expect(setUnsupportedMock).toHaveBeenCalled();
    const unsupportedArg = setUnsupportedMock.mock.calls[0]?.[0] as Set<string> | undefined;
    expect(unsupportedArg).toBeInstanceOf(Set);
    expect(unsupportedArg?.has('refunds')).toBe(true);
    expect(firstRun.logs.some((entry) => entry.includes('resource_not_found_skip:refunds'))).toBe(true);

    fetchMock.mockClear();
    setUnsupportedMock.mockClear();

    const secondRun = await runSync({
      cursor: { resource: 'refunds', page: 1, intervalIndex: 0, done: false },
      full: true
    });

    expect(secondRun.ok).toBe(true);
    expect(fetchMock.mock.calls.some((args) => `${args[0]}`.includes('/v1/refunds'))).toBe(false);
    expect(setUnsupportedMock).not.toHaveBeenCalled();
  });
});
