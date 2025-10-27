import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runSync } from '@/lib/kiwify/syncEngine';
import { KiwifyHttpError } from '@/lib/kiwify/http';

const mocks = vi.hoisted(() => {
  const envMock = { SYNC_BUDGET_MS: 120000, KFY_PAGE_SIZE: 2 };
  const fetchMock = vi.fn();
  const writesMock = {
    upsertProducts: vi.fn(async () => 1),
    upsertCustomers: vi.fn(async () => 1),
    upsertDerivedCustomers: vi.fn(async () => 1),
    upsertSales: vi.fn(async () => 1),
    upsertSubscriptions: vi.fn(async () => 1),
    upsertEnrollments: vi.fn(async () => 1),
    upsertCoupons: vi.fn(async () => 1),
    upsertRefunds: vi.fn(async () => 1),
    upsertPayouts: vi.fn(async () => 1),
    resolveCustomerIds: vi.fn(async (ids: readonly string[]) => new Map(ids.map((id) => [id, id])))
  };
  const setSyncMetadataMock = vi.fn();
  return { envMock, fetchMock, writesMock, setSyncMetadataMock };
});

vi.mock('@/lib/env', () => ({
  loadEnv: () => mocks.envMock
}));

vi.mock('@/lib/kiwify/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/kiwify/http')>();
  return {
    ...actual,
    kiwifyFetch: mocks.fetchMock,
    KiwifyHttpError: actual.KiwifyHttpError
  };
});

vi.mock('@/lib/kiwify/writes', () => mocks.writesMock);

vi.mock('@/lib/kiwify/syncState', () => ({
  setSyncMetadata: mocks.setSyncMetadataMock,
  getSyncMetadata: vi.fn()
}));

function buildResponse(data: unknown): Response {
  return {
    json: async () => data
  } as Response;
}

describe('runSync - simple engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/v1/products')) {
        return buildResponse({ data: [{ id: 'prod_1', title: 'Course', price: 100 }] });
      }
      if (path.startsWith('/v1/customers')) {
        return buildResponse({ data: [{ id: 'cust_1', email: 'a@example.com' }] });
      }
      if (path.startsWith('/v1/sales')) {
        return buildResponse({
          data: [
            {
              id: 'sale_1',
              total_amount: 100,
              customer: { id: 'cust_1', email: 'a@example.com' },
              product: { id: 'prod_1', title: 'Course', price: 100 }
            }
          ]
        });
      }
      if (path.startsWith('/v1/subscriptions')) {
        return buildResponse({ data: [{ id: 'sub_1' }] });
      }
      if (path.startsWith('/v1/enrollments')) {
        return buildResponse({ data: [{ id: 'enroll_1' }] });
      }
      if (path.startsWith('/v1/coupons')) {
        return buildResponse({ data: [{ id: 'coupon_1' }] });
      }
      if (path.startsWith('/v1/refunds')) {
        return buildResponse({ data: [{ id: 'refund_1', sale_id: 'sale_1' }] });
      }
      if (path.startsWith('/v1/payouts')) {
        return buildResponse({ data: [{ id: 'payout_1' }] });
      }
      throw new Error(`Unhandled path ${path}`);
    });
  });

  it('processes all resources and derives customers and products from sales', async () => {
    const result = await runSync({ persist: true });

    expect(result.ok).toBe(true);
    expect(result.done).toBe(true);
    expect(result.stats).toMatchObject({
      products: expect.any(Number),
      customers: expect.any(Number),
      sales: expect.any(Number)
    });
    expect(mocks.writesMock.upsertCustomers).toHaveBeenCalled();
    expect(mocks.writesMock.upsertDerivedCustomers).toHaveBeenCalled();
    expect(mocks.writesMock.upsertProducts).toHaveBeenCalledTimes(2);
    expect(mocks.writesMock.upsertSales).toHaveBeenCalledTimes(1);
    expect(mocks.writesMock.resolveCustomerIds).toHaveBeenCalledWith(['cust_1']);
    expect(mocks.setSyncMetadataMock).toHaveBeenCalledTimes(1);
    const paths = mocks.fetchMock.mock.calls.map((call) => call[0] as string);
    expect(paths.some((path) => path.includes('/v1/sales'))).toBe(true);
  });

  it('continues when a resource is not available', async () => {
    mocks.fetchMock.mockImplementationOnce(async () => {
      throw new KiwifyHttpError('missing', { status: 404, url: '/v1/products', isHtml: false });
    });

    const result = await runSync({ resources: ['products', 'sales'] });

    expect(result.ok).toBe(true);
    expect(result.logs).toContain('resource_not_found:products');
  });

  it('propagates failures for other errors', async () => {
    mocks.fetchMock.mockImplementationOnce(async () => {
      throw new Error('boom');
    });

    const result = await runSync({ resources: ['products'] });

    expect(result.ok).toBe(false);
    expect(result.logs[result.logs.length - 1]).toContain('sync_failed:boom');
  });

  it('allows custom date ranges', async () => {
    await runSync({ resources: ['sales'], since: '2024-01-01', until: '2024-01-31' });

    const paths = mocks.fetchMock.mock.calls.map((call) => call[0] as string);
    expect(paths.some((path) => path.includes('start_date=2024-01-01'))).toBe(true);
    expect(paths.some((path) => path.includes('end_date=2024-01-31'))).toBe(true);
  });
});
