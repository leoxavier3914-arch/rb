import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mapCustomerFromSalePayload } from '@/lib/kiwify/mappers';

describe('mapCustomerFromSalePayload', () => {
  const fixedDate = new Date('2024-02-03T04:05:06.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cria cliente derivado a partir de campos planos quando customer aninhado está ausente', () => {
    const result = mapCustomerFromSalePayload({
      id: 'sale_abc',
      customer_id: '  cust-789  ',
      customer_name: 'Example Buyer',
      customer_email: 'buyer@example.com',
      customer_phone: '+5511999999999'
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe('cust-789');
    expect(result?.external_id).toBe('cust-789');
    expect(result?.name).toBe('Example Buyer');
    expect(result?.email).toBe('buyer@example.com');
    expect(result?.phone).toBe('+5511999999999');
    expect(result?.created_at).toBe(fixedDate.toISOString());
    expect(result?.updated_at).toBe(fixedDate.toISOString());
  });

  it('retorna null e chama callback quando id derivado é inválido', () => {
    const onInvalid = vi.fn();

    const result = mapCustomerFromSalePayload(
      {
        id: 'sale_def',
        customer_id: '   ',
        customer_email: 'missing-id@example.com'
      },
      { onInvalidCustomerId: onInvalid }
    );

    expect(result).toBeNull();
    expect(onInvalid).toHaveBeenCalledWith('   ');
  });
});
