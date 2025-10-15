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
  created_at: '2023-12-31T23:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  paid_at: '2024-01-01T00:00:00.000Z',
  traffic_source: null,
  source: null,
  abandoned_before_payment: false,
  checkout_url: null,
  ...overrides,
});

describe('getConversionLabel', () => {
  it('returns "Aprovado retorno" for sales that were abandoned before payment', () => {
    const sale = buildSale({ abandoned_before_payment: true });
    expect(getConversionLabel(sale)).toBe('Aprovado retorno');
  });

  it('returns "Aprovado direto" for non-direct conversion sources when not abandoned', () => {
    const sale = buildSale({ source: 'custom.integration' });
    expect(getConversionLabel(sale)).toBe('Aprovado direto');
  });

  it('returns "Aprovado direto" as default for direct approvals', () => {
    const sale = buildSale();
    expect(getConversionLabel(sale)).toBe('Aprovado direto');
  });
});
