import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runSync } from '@/lib/kiwify/syncEngine';
import { kiwifyFetch } from '@/lib/kiwify/http';
import type { SaleRow } from '@/lib/kiwify/mappers';
import * as env from '@/lib/env';
import * as writes from '@/lib/kiwify/writes';

vi.mock('@/lib/kiwify/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/kiwify/http')>('@/lib/kiwify/http');
  return {
    ...actual,
    kiwifyFetch: vi.fn()
  };
});

vi.mock('@/lib/kiwify/writes', async () => {
  const actual = await vi.importActual<typeof import('@/lib/kiwify/writes')>('@/lib/kiwify/writes');
  const loadExistingMock = vi.fn(async (externalIds: readonly string[]) =>
    new Map(externalIds.map((id) => [id, id === 'cust_external' ? 'cust_internal' : id]))
  );
  const upsertSalesMock = vi.fn(() => Promise.resolve(0));
  return {
    ...actual,
    loadExistingCustomerIds: loadExistingMock,
    resolveCustomerIds: async (externalIds: readonly string[]) => {
      const uniqueExternalIds = Array.from(
        new Set(externalIds.filter((id): id is string => Boolean(id)))
      );
      if (uniqueExternalIds.length === 0) {
        return new Map();
      }
      const existingIds = await loadExistingMock(uniqueExternalIds);
      if (existingIds.size === 0) {
        return new Map(uniqueExternalIds.map((id) => [id, id]));
      }
      return new Map(uniqueExternalIds.map((id) => [id, existingIds.get(id) ?? id]));
    },
    upsertSales: upsertSalesMock,
    upsertDerivedCustomers: vi.fn(() => Promise.resolve(0)),
    upsertProducts: vi.fn(() => Promise.resolve(0)),
    upsertSubscriptions: vi.fn(() => Promise.resolve(0)),
    upsertEnrollments: vi.fn(() => Promise.resolve(0)),
    upsertCoupons: vi.fn(() => Promise.resolve(0)),
    upsertRefunds: vi.fn(() => Promise.resolve(0)),
    upsertPayouts: vi.fn(() => Promise.resolve(0))
  };
});

vi.mock('@/lib/kiwify/syncState', () => ({
  setSyncCursor: vi.fn(() => Promise.resolve()),
  getUnsupportedResources: vi.fn(() => Promise.resolve(new Set())),
  setUnsupportedResources: vi.fn(() => Promise.resolve()),
  getSalesSyncState: vi.fn(() => Promise.resolve(null)),
  setSalesSyncState: vi.fn(() => Promise.resolve())
}));

describe('syncEngine sales customer resolution', () => {
  const fetchMock = kiwifyFetch as unknown as ReturnType<typeof vi.fn>;
  let loadEnvMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    loadEnvMock = vi.spyOn(env, 'loadEnv').mockReturnValue({
      SYNC_BUDGET_MS: 20_000,
      KFY_PAGE_SIZE: 1,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
    } as env.AppEnv);
  });

  afterEach(() => {
    loadEnvMock.mockRestore();
  });

  it('remaps sale customer ids to the database primary key before writing', async () => {
    const loadExistingMock = writes.loadExistingCustomerIds as unknown as ReturnType<typeof vi.fn>;
    const upsertSalesMock = writes.upsertSales as unknown as ReturnType<typeof vi.fn>;
    const derivedCustomersMock = writes.upsertDerivedCustomers as unknown as ReturnType<typeof vi.fn>;

    upsertSalesMock.mockImplementation(async (rows: readonly SaleRow[]) => rows.length);

    fetchMock.mockImplementation((url: string | URL) => {
      const resolvedUrl = typeof url === 'string' ? url : url.toString();
      if (resolvedUrl.includes('/v1/account-details')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ created_at: '2020-01-01T00:00:00.000Z' }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        );
      }

      if (resolvedUrl.includes('/v1/sales')) {
        const payload = {
          data: [
            {
              id: 'sale_1',
              customer_id: 'cust_external',
              total_amount_cents: 1_000,
              fee_amount_cents: 100,
              net_amount_cents: 900,
              status: 'paid'
            }
          ],
          meta: { pagination: { page: 1, total_pages: 1 } }
        };
        return Promise.resolve(
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({ data: [], meta: { pagination: { page: 1, total_pages: 1 } } }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });

    try {
      const result = await runSync({
        cursor: { resource: 'sales', page: 1, intervalIndex: 0, done: false },
        persist: false
      });

      expect(result.ok).toBe(true);
      expect(upsertSalesMock).toHaveBeenCalled();
      const writtenRows = upsertSalesMock.mock.calls.flatMap(
        (call) => call[0] as readonly SaleRow[]
      );
      expect(writtenRows).toEqual(
        expect.arrayContaining([expect.objectContaining({ customer_id: 'cust_internal' })])
      );
      expect(writtenRows).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ customer_id: 'cust_external' })])
      );
      expect(loadExistingMock).toHaveBeenCalledWith(expect.arrayContaining(['cust_external']));
    } finally {
      upsertSalesMock.mockImplementation(() => Promise.resolve(0));
      derivedCustomersMock.mockImplementation(() => Promise.resolve(0));
    }
  });
});
