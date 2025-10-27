import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDefaultIntervals, runSync } from '@/lib/kiwify/syncEngine';
import * as env from '@/lib/env';
import { KiwifyHttpError, kiwifyFetch } from '@/lib/kiwify/http';
import * as writes from '@/lib/kiwify/writes';
import * as syncState from '@/lib/kiwify/syncState';

vi.mock('@/lib/kiwify/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/kiwify/http')>('@/lib/kiwify/http');
  return {
    ...actual,
    kiwifyFetch: vi.fn()
  };
});

vi.mock('@/lib/kiwify/writes', () => ({
  upsertProducts: vi.fn(() => Promise.resolve(1)),
  upsertCustomers: vi.fn(() => Promise.resolve(0)),
  upsertCustomer: vi.fn(() => Promise.resolve(0)),
  upsertDerivedCustomers: vi.fn(() => Promise.resolve(0)),
  upsertSales: vi.fn(() => Promise.resolve(0)),
  upsertSubscriptions: vi.fn(() => Promise.resolve(0)),
  upsertEnrollments: vi.fn(() => Promise.resolve(0)),
  upsertCoupons: vi.fn(() => Promise.resolve(0)),
  upsertRefunds: vi.fn(() => Promise.resolve(0)),
  upsertPayouts: vi.fn(() => Promise.resolve(0)),
  resolveCustomerIds: vi.fn(async (externalIds: readonly string[]) =>
    new Map(externalIds.map((id) => [id, id]))
  )
}));

vi.mock('@/lib/kiwify/syncState', () => ({
  setSyncCursor: vi.fn(() => Promise.resolve()),
  getUnsupportedResources: vi.fn(() => Promise.resolve(new Set())),
  setUnsupportedResources: vi.fn(() => Promise.resolve()),
  getSalesSyncState: vi.fn(() => Promise.resolve(null)),
  setSalesSyncState: vi.fn(() => Promise.resolve())
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

    const salesResponses = [
      responseBody,
      { data: [], meta: { pagination: { page: 1, total_pages: 1 } } },
      { data: [], meta: { pagination: { page: 1, total_pages: 1 } } },
      { data: [], meta: { pagination: { page: 1, total_pages: 1 } } },
      { data: [], meta: { pagination: { page: 1, total_pages: 1 } } }
    ];
    let salesCallIndex = 0;

    fetchMock.mockImplementation((url: string | URL) => {
      const resolvedUrl = typeof url === 'string' ? url : url.toString();
      if (resolvedUrl.includes('/v1/account-details')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              created_at: '2020-01-01T00:00:00.000Z'
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        );
      }

      if (resolvedUrl.includes('/v1/sales')) {
        const payload = salesResponses[salesCallIndex] ?? salesResponses[salesResponses.length - 1];
        salesCallIndex += 1;
        return Promise.resolve(
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });

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

  it('upserta clientes derivados ao processar vendas', async () => {
    const responseBody = {
      data: [
        {
          id: 'sale_1',
          customer: {
            id: 'cust_1',
            email: 'buyer@example.com'
          }
        }
      ],
      meta: {
        pagination: {
          page: 1,
          total_pages: 1
        }
      }
    };

    const salesMissingIdResponses = [
      responseBody,
      { data: [], meta: { pagination: { page: 1, total_pages: 1 } } },
      { data: [], meta: { pagination: { page: 1, total_pages: 1 } } },
      { data: [], meta: { pagination: { page: 1, total_pages: 1 } } },
      { data: [], meta: { pagination: { page: 1, total_pages: 1 } } }
    ];
    let salesMissingIdIndex = 0;

    fetchMock.mockImplementation((url: string | URL) => {
      const resolvedUrl = typeof url === 'string' ? url : url.toString();
      if (resolvedUrl.includes('/v1/account-details')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              created_at: '2020-01-01T00:00:00.000Z'
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        );
      }

      if (resolvedUrl.includes('/v1/sales')) {
        const payload = salesMissingIdResponses[salesMissingIdIndex] ??
          salesMissingIdResponses[salesMissingIdResponses.length - 1];
        salesMissingIdIndex += 1;
        return Promise.resolve(
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });

    const result = await runSync({
      cursor: { resource: 'sales', page: 1, intervalIndex: 0, done: false },
      full: true
    });

    expect(result.ok).toBe(true);
    expect(writes.upsertDerivedCustomers).toHaveBeenCalledTimes(1);
    expect(writes.upsertDerivedCustomers).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'cust_1' })])
    );
    expect(writes.upsertSales).toHaveBeenCalledTimes(1);
  });

  it('interpreta paginação como strings e percorre múltiplas páginas', async () => {
    const paginatedResponses = [
      {
        data: [
          {
            id: 'prod_1',
            title: 'Produto 1'
          }
        ],
        meta: {
          pagination: {
            page: '1',
            per_page: '2',
            total: '5'
          }
        }
      },
      {
        data: [
          {
            id: 'prod_2',
            title: 'Produto 2'
          }
        ],
        meta: {
          pagination: {
            page: '2',
            per_page: '2',
            total: '5'
          }
        }
      },
      {
        data: [
          {
            id: 'prod_3',
            title: 'Produto 3'
          }
        ],
        meta: {
          pagination: {
            page: '3',
            per_page: '2',
            total: '5'
          }
        }
      }
    ];

    let productIndex = 0;

    const defaultResponse = {
      data: [],
      meta: { pagination: { page: 1, total_pages: 1 } }
    };

    fetchMock.mockImplementation((url: string | URL) => {
      const resolvedUrl = typeof url === 'string' ? url : url.toString();

      if (resolvedUrl.includes('/v1/products')) {
        const payload =
          paginatedResponses[productIndex] ?? paginatedResponses[paginatedResponses.length - 1];
        productIndex += 1;
        return Promise.resolve(
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify(defaultResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });

    const result = await runSync({
      cursor: { resource: 'products', page: 1, intervalIndex: 0, done: false },
      full: true
    });

    const productCalls = fetchMock.mock.calls.filter(([input]) => {
      const resolved = typeof input === 'string' ? input : (input as URL).toString();
      return resolved.includes('/v1/products');
    });

    expect(result.ok).toBe(true);
    expect(productCalls).toHaveLength(3);
    expect(writes.upsertProducts).toHaveBeenCalledTimes(3);
    expect(result.stats.products).toBe(3);
  });

  it('usa data de criação da conta para expandir backfill completo em todos os recursos com faixa', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T00:00:00.000Z'));

    const capturedUrls: string[] = [];

    fetchMock.mockImplementation((url: string | URL) => {
      const resolvedUrl = typeof url === 'string' ? url : url.toString();
      capturedUrls.push(resolvedUrl);

      if (resolvedUrl.includes('/v1/account-details')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              created_at: '2021-01-01T00:00:00.000Z'
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [],
            meta: { pagination: { page: 1, total_pages: 1 } }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });

    try {
      const result = await runSync({ full: true, persist: false });

      expect(result.ok).toBe(true);

      const subscriptionCalls = capturedUrls.filter((url) => url.includes('/v1/subscriptions'));
      expect(subscriptionCalls.length).toBeGreaterThan(0);
      const firstSubscriptionUrl = new URL(subscriptionCalls[0]!, 'https://example.test');
      const subscriptionStartDate = firstSubscriptionUrl.searchParams.get('start_date');
      expect(subscriptionStartDate).toBe('2021-01-01T00:00:00.000Z');

      const salesCalls = capturedUrls.filter((url) => url.includes('/v1/sales'));
      expect(salesCalls.length).toBeGreaterThan(0);
      const firstSalesUrl = new URL(salesCalls[0]!, 'https://example.test');
      const salesStartDate = firstSalesUrl.searchParams.get('start_date');
      expect(salesStartDate).toBe('2021-01-01');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignora clientes derivados sem id e loga customer_missing_id', async () => {
    const responseBody = {
      data: [
        {
          id: 'sale_2',
          customer: {
            id: null,
            email: 'buyer-missing@example.com'
          }
        }
      ],
      meta: {
        pagination: {
          page: 1,
          total_pages: 1
        }
      }
    };

    const salesMissingIdResponses = [
      responseBody,
      { data: [], meta: { pagination: { page: 1, total_pages: 1 } } },
      { data: [], meta: { pagination: { page: 1, total_pages: 1 } } },
      { data: [], meta: { pagination: { page: 1, total_pages: 1 } } },
      { data: [], meta: { pagination: { page: 1, total_pages: 1 } } }
    ];
    let missingIdCallIndex = 0;

    fetchMock.mockImplementation((url: string | URL) => {
      const resolvedUrl = typeof url === 'string' ? url : url.toString();
      if (resolvedUrl.includes('/v1/account-details')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              created_at: '2020-01-01T00:00:00.000Z'
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        );
      }

      if (resolvedUrl.includes('/v1/sales')) {
        const payload = salesMissingIdResponses[missingIdCallIndex] ??
          salesMissingIdResponses[salesMissingIdResponses.length - 1];
        missingIdCallIndex += 1;
        return Promise.resolve(
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ data: [], meta: { pagination: { page: 1, total_pages: 1 } } }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });

    const result = await runSync({
      cursor: { resource: 'sales', page: 1, intervalIndex: 0, done: false }
    });

    expect(result.ok).toBe(true);
    expect(
      result.logs.some((log) => {
        try {
          const parsed = JSON.parse(log);
          return parsed.event === 'customer_missing_id' && parsed.sale_id === 'sale_2';
        } catch {
          return false;
        }
      })
    ).toBe(true);
    expect(writes.upsertDerivedCustomers).not.toHaveBeenCalled();
    expect(writes.upsertSales).toHaveBeenCalledTimes(1);
  });

  it('marca recurso como não suportado ao receber 404', async () => {
    const notFoundError = new KiwifyHttpError('not found', {
      status: 404,
      url: 'https://example.test/v1/coupons',
      isHtml: false
    });

    fetchMock.mockImplementation((url: string | URL) => {
      const resolvedUrl = typeof url === 'string' ? url : url.toString();
      if (resolvedUrl.includes('/v1/account-details')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              created_at: '2020-01-01T00:00:00.000Z'
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        );
      }

      if (resolvedUrl.includes('/v1/coupons')) {
        return Promise.reject(notFoundError);
      }

      if (resolvedUrl.includes('/v1/refunds')) {
        return Promise.resolve(
          new Response(JSON.stringify(refundsResponse), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ data: [], meta: { pagination: { page: 1, total_pages: 1 } } }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });

    const refundsResponse = {
      data: [],
      meta: {
        pagination: { page: 1, total_pages: 1 }
      }
    };

    const result = await runSync({
      cursor: { resource: 'coupons', page: 1, intervalIndex: 0, done: false }
    });

    expect(result.ok).toBe(true);
    expect(result.logs.some((log) => log.startsWith('resource_not_found_skip'))).toBe(true);
    expect(syncState.setUnsupportedResources).toHaveBeenCalledTimes(1);
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
