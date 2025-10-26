import { describe, expect, it } from 'vitest';

import { mapSalePayload } from '@/lib/kiwify/mappers';

describe('mapSalePayload', () => {
  it('normaliza o customer_id usando normalizeExternalId', () => {
    const mapped = mapSalePayload({
      id: 'sale_123',
      customer_id: ' 123 ',
      customer: {
        id: ' 123 '
      }
    });

    expect(mapped.customer_id).toBe('123');
  });

  it('retorna null quando customer_id é a string "null"', () => {
    const mapped = mapSalePayload({
      id: 'sale_456',
      customer_id: 'null'
    });

    expect(mapped.customer_id).toBeNull();
  });
});
