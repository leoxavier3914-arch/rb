import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processKiwifyEvent } from '@/lib/kiwify/webhookProcessor';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as writes from '@/lib/kiwify/writes';

let callOrder: string[] = [];

vi.mock('@/lib/kiwify/writes', () => ({
  upsertCoupons: vi.fn(() => Promise.resolve(0)),
  upsertCustomers: vi.fn(() => Promise.resolve(0)),
  upsertCustomer: vi.fn(async () => {
    callOrder.push('customer');
    return 1;
  }),
  upsertDerivedCustomers: vi.fn(() => Promise.resolve(0)),
  upsertEnrollments: vi.fn(() => Promise.resolve(0)),
  upsertPayouts: vi.fn(() => Promise.resolve(0)),
  upsertProducts: vi.fn(() => Promise.resolve(0)),
  upsertRefunds: vi.fn(() => Promise.resolve(0)),
  upsertSales: vi.fn(async () => {
    callOrder.push('sales');
    return 1;
  }),
  upsertSubscriptions: vi.fn(() => Promise.resolve(0))
}));

function createClient(): SupabaseClient {
  const saleQuery = {
    select: vi.fn(() => saleQuery),
    eq: vi.fn(() => saleQuery),
    limit: vi.fn(async () => ({ data: [], error: null }))
  };

  const entitySelect = {
    select: vi.fn(() => entitySelect),
    eq: vi.fn(() => entitySelect),
    order: vi.fn(() => entitySelect),
    limit: vi.fn(async () => ({ data: [], error: null })),
    insert: vi.fn(async () => ({ error: null }))
  };

  const genericInsert = {
    insert: vi.fn(async () => ({ error: null }))
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'kfy_sales') {
        return saleQuery;
      }
      if (table === 'entity_versions') {
        return entitySelect;
      }
      if (table === 'kfy_sale_events') {
        return genericInsert;
      }
      return genericInsert;
    })
  } as unknown as SupabaseClient;
}

describe('processKiwifyEvent', () => {
  beforeEach(() => {
    callOrder = [];
    vi.clearAllMocks();
  });

  it('upserta cliente antes da venda quando id válido', async () => {
    const client = createClient();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const payload = {
      id: 'sale_valid',
      customer: {
        id: 'cust_valid',
        email: 'valid@example.com'
      }
    };

    const result = await processKiwifyEvent(client, 'sale.created', payload, payload);

    expect(result.metricsChanged).toBeTypeOf('boolean');
    expect(writes.upsertCustomer).toHaveBeenCalledTimes(1);
    expect(writes.upsertSales).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['customer', 'sales']);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('continua processamento quando cliente não possui id', async () => {
    const client = createClient();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const payload = {
      id: 'sale_missing_customer',
      customer: {
        id: undefined,
        email: 'missing@example.com'
      }
    };

    await processKiwifyEvent(client, 'sale.updated', payload, payload);

    expect(writes.upsertCustomer).not.toHaveBeenCalled();
    expect(writes.upsertSales).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('customer_missing_id')
    );

    warnSpy.mockRestore();
  });
});
