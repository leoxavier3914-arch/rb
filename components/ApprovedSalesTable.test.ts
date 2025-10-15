import { describe, expect, it } from 'vitest';
import type { Sale } from '../lib/types';
import { EMPTY_MESSAGE, filterApprovedSales } from './ApprovedSalesTable';

const buildSale = (overrides: Partial<Sale> = {}): Sale => ({
  id: 'sale-1',
  customer_email: 'user@example.com',
  customer_name: 'Customer',
  customer_phone: null,
  product_name: 'Produto',
  product_id: 'prod-1',
  status: 'approved',
  created_at: '2024-05-01T10:00:00.000Z',
  updated_at: '2024-05-01T10:10:00.000Z',
  paid_at: '2024-05-01T10:15:00.000Z',
  traffic_source: null,
  source: null,
  abandoned_before_payment: false,
  checkout_url: 'https://checkout.kiwify.com/sale-1',
  ...overrides,
});

describe('filterApprovedSales', () => {
  it('keeps only approved sales', () => {
    const approved = buildSale();
    const refunded = buildSale({ id: 'sale-2', status: 'refunded' });

    const result = filterApprovedSales([approved, refunded]);

    expect(result).toEqual([approved]);
  });
});

describe('EMPTY_MESSAGE', () => {
  it('matches the copy used in the table', () => {
    expect(EMPTY_MESSAGE).toBe('Nenhuma venda aprovada encontrada.');
  });
});
