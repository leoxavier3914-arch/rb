import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  assertIsAdmin: vi.fn(),
}));

const kiwifyFetchMock = vi.fn();

vi.mock('@/lib/kiwify/http', () => ({
  kiwifyFetch: (...args: unknown[]) => kiwifyFetchMock(...args),
}));

const hasSupabaseConfigMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  hasSupabaseConfig: () => hasSupabaseConfigMock(),
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

const createQuery = (data: unknown) => ({
  select: () => createQuery(data),
  order: () => createQuery(data),
  limit: () => createQuery(data),
  in: () => createQuery(data),
  or: () => createQuery(data),
  then(onFulfilled: (value: { data: unknown; error: null }) => unknown) {
    return Promise.resolve({ data, error: null }).then(onFulfilled);
  },
  catch(onRejected: (reason: unknown) => unknown) {
    return Promise.resolve({ data, error: null }).catch(onRejected);
  },
  finally(onFinally: () => void) {
    return Promise.resolve({ data, error: null }).finally(onFinally);
  },
});

beforeEach(() => {
  hasSupabaseConfigMock.mockReturnValue(true);
  getSupabaseAdminMock.mockReset();
  kiwifyFetchMock.mockReset();
});

describe('hub routes', () => {
  it('lista produtos sem chamar kiwifyFetch', async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => createQuery([
        { id: 'p1', title: 'Produto', price_cents: 1000, created_at: '2024-01-01', updated_at: '2024-01-01' },
      ]),
    });

    const { GET } = await import('@/app/api/hub/products/route');
    const response = await GET(new NextRequest('http://localhost/api/hub/products'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(kiwifyFetchMock).not.toHaveBeenCalled();
  });

  it('lista vendas do hub sem usar kiwifyFetch', async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => createQuery([
        { id: 's1', status: 'paid', customer_id: 'c1', total_amount_cents: 5000, created_at: '2024-01-01', paid_at: null, updated_at: null },
      ]),
    });

    const { GET } = await import('@/app/api/hub/sales/route');
    const response = await GET(new NextRequest('http://localhost/api/hub/sales'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0].id).toBe('s1');
    expect(kiwifyFetchMock).not.toHaveBeenCalled();
  });

  it('agrega estatísticas usando apenas o banco local', async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => createQuery([
        { status: 'paid', total_amount_cents: 1000 },
        { status: 'paid', total_amount_cents: 2000 },
      ]),
    });

    const { GET } = await import('@/app/api/hub/stats/route');
    const response = await GET(new NextRequest('http://localhost/api/hub/stats'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totals.grossCents).toBe(3000);
    expect(body.statusCounts.paid).toBe(2);
    expect(kiwifyFetchMock).not.toHaveBeenCalled();
  });
});

