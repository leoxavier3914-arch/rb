import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDefaultIntervals, runSync } from '@/lib/kiwify/syncEngine';
import * as env from '@/lib/env';
import { kiwifyFetch } from '@/lib/kiwify/http';
import * as writes from '@/lib/kiwify/writes';
import * as syncState from '@/lib/kiwify/syncState';

vi.mock('@/lib/kiwify/http', () => ({
  kiwifyFetch: vi.fn()
}));

vi.mock('@/lib/kiwify/writes', () => ({
  upsertProducts: vi.fn(() => Promise.resolve(1)),
  upsertCustomers: vi.fn(() => Promise.resolve(0)),
  upsertSales: vi.fn(() => Promise.resolve(0)),
  upsertSubscriptions: vi.fn(() => Promise.resolve(0)),
  upsertEnrollments: vi.fn(() => Promise.resolve(0)),
  upsertCoupons: vi.fn(() => Promise.resolve(0)),
  upsertRefunds: vi.fn(() => Promise.resolve(0)),
  upsertPayouts: vi.fn(() => Promise.resolve(0))
}));

vi.mock('@/lib/kiwify/syncState', () => ({
  setSyncCursor: vi.fn(() => Promise.resolve())
}));

const loadEnvMock = vi.spyOn(env, 'loadEnv');
const fetchMock = kiwifyFetch as unknown as ReturnType<typeof vi.fn>;

describe('syncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadEnvMock.mockReturnValue({ SYNC_BUDGET_MS: 20000, KFY_PAGE_SIZE: 2 } as env.AppEnv);
  });

  it('builds default intervals for 90 dias e hoje', () => {
    const intervals = buildDefaultIntervals();
    expect(intervals).toHaveLength(2);
    expect(intervals[0].start).toBeInstanceOf(Date);
  });

  it('processa página e avança intervalo', async () => {
    const responseBody = {
      data: [
        {
          id: 'prod_1',
          title: 'Produto',
          price: 10
        }
      ],
      meta: {
        pagination: {
          page: 1,
          total_pages: 1
        }
      }
    };

    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    );

    const result = await runSync({
      cursor: { resource: 'products', page: 1, intervalIndex: 0, done: false },
      persist: true
    });

    expect(result.ok).toBe(true);
    expect(result.done).toBe(true);
    expect(result.nextCursor).toBeNull();
    expect(result.stats.products).toBe(2);
    expect(writes.upsertProducts).toHaveBeenCalledTimes(2);
    expect(syncState.setSyncCursor).toHaveBeenCalledTimes(1);
  });

  it('short-circuits quando orçamento insuficiente', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(10).mockReturnValue(Number.MAX_SAFE_INTEGER);

    const cursor = { resource: 'products', page: 1, intervalIndex: 0, done: false } as const;
    const result = await runSync({ cursor });

    expect(result.ok).toBe(true);
    expect(result.done).toBe(false);
    expect(result.nextCursor).toMatchObject(cursor);
    expect(fetchMock).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });
});
