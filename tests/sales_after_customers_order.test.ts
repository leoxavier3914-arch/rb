import { describe, expect, it, vi, beforeEach } from 'vitest';
import { kiwifyFetch } from '@/lib/kiwify/http';
import { runSync } from '@/lib/kiwify/syncEngine';
import { SupabaseWriteError } from '@/lib/kiwify/writes';
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
    upsertDerivedCustomers: vi.fn(() => Promise.resolve(1)),
    upsertSales: vi.fn(),
    upsertSubscriptions: vi.fn(() => Promise.resolve(0)),
    upsertEnrollments: vi.fn(() => Promise.resolve(0)),
    upsertCoupons: vi.fn(() => Promise.resolve(0)),
    upsertRefunds: vi.fn(() => Promise.resolve(0)),
    upsertPayouts: vi.fn(() => Promise.resolve(0))
  } satisfies typeof import('@/lib/kiwify/writes');
});

vi.mock('@/lib/kiwify/syncState', () => ({
  setSyncCursor: vi.fn(() => Promise.resolve()),
  getUnsupportedResources: vi.fn(() => Promise.resolve(new Set<string>())),
  setUnsupportedResources: vi.fn(() => Promise.resolve()),
  getSalesSyncState: vi.fn(() => Promise.resolve(null)),
  setSalesSyncState: vi.fn(() => Promise.resolve())
}));

describe('runSync - sales and customer ordering', () => {
  const loadEnvMock = vi.spyOn(env, 'loadEnv');
  const fetchMock = kiwifyFetch as unknown as vi.Mock;
  const upsertSalesMock = writes.upsertSales as unknown as vi.Mock;
  const upsertDerivedCustomersMock = writes.upsertDerivedCustomers as unknown as vi.Mock;
  const setUnsupportedMock = syncState.setUnsupportedResources as unknown as vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    loadEnvMock.mockReturnValue({ SYNC_BUDGET_MS: 20_000, KFY_PAGE_SIZE: 50 } as env.AppEnv);
  });

  it('retries sales write after upserting customers when FK fails', async () => {
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
      if (resolved.includes('/v1/sales')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  id: 'sale_1',
                  status: 'paid',
                  customer: { id: 'cust_1', email: 'buyer@example.com' },
                  total_amount_cents: 1000
                }
              ],
              meta: { pagination: { page: 1, total_pages: 1 } }
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ data: [], meta: { pagination: { page: 1, total_pages: 1 } } }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });

    upsertSalesMock.mockImplementationOnce(() => {
      throw new SupabaseWriteError('fk violation', { table: 'kfy_sales', code: '23503' });
    });
    upsertSalesMock.mockImplementation(() => Promise.resolve(1));

    const result = await runSync({
      cursor: { resource: 'sales', page: 1, intervalIndex: 0, done: false },
      full: true
    });

    expect(result.ok).toBe(true);
    expect(result.stats.sales ?? 0).toBeGreaterThanOrEqual(1);
    expect(upsertSalesMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(upsertDerivedCustomersMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(setUnsupportedMock).not.toHaveBeenCalled();
    expect(result.logs.some((entry) => entry.includes('sales_fk_retry_triggered'))).toBe(true);
  });
});
