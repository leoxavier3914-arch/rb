import { describe, expect, it } from 'vitest';
import { getConversionLabel } from '../../lib/conversion';
import type { Sale } from '../../lib/types';

const buildSale = (overrides: Partial<Sale> = {}): Sale => ({
  id: '1',
  customer_email: 'user@example.com',
  customer_name: 'Customer',
  customer_phone: null,
  product_name: 'Product',
  product_id: 'prod',
  status: 'approved',
  paid_at: '2024-01-01T00:00:00.000Z',
  traffic_source: null,
  source: null,
  email_follow_up: false,
  ...overrides,
});

describe('getConversionLabel', () => {
  it('returns "Aprovado retorno" for follow-up approvals', () => {
    const sale = buildSale({ email_follow_up: true });
    expect(getConversionLabel(sale)).toBe('Aprovado retorno');
  });

  it('returns "Carrinho recuperado" for non-direct conversions without follow-up flag', () => {
    const sale = buildSale({ source: 'custom.integration' });
    expect(getConversionLabel(sale)).toBe('Carrinho recuperado');
  });

  it('returns "Aprovado direto" as fallback', () => {
    const sale = buildSale();
    expect(getConversionLabel(sale)).toBe('Aprovado direto');
  });
});
