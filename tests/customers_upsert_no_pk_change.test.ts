import { describe, expect, it } from 'vitest';
import type { CustomerRow } from '@/lib/kiwify/mappers';
import { prepareCustomerUpsertRows } from '@/lib/kiwify/writes';

describe('prepareCustomerUpsertRows', () => {
  it('preserves existing primary keys when external ids already exist', () => {
    const input: CustomerRow = {
      id: 'cust_incoming',
      external_id: 'cust_external',
      name: 'Buyer',
      email: 'buyer@example.com',
      phone: null,
      country: null,
      state: null,
      city: null,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      raw: {}
    };

    const prepared = prepareCustomerUpsertRows([input], new Map([[input.external_id, 'cust_existing']]));
    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.id).toBe('cust_existing');
    expect(prepared[0]?.external_id).toBe('cust_external');
  });
});
