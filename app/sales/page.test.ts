import { describe, expect, it } from 'vitest';
import type { Sale } from '../../lib/types';
import { buildSalesSummary } from './page';

const buildSale = (overrides: Partial<Sale> = {}): Sale => ({
  id: 'sale',
  customer_email: 'user@example.com',
  customer_name: 'Customer',
  customer_phone: null,
  product_name: 'Produto',
  product_id: 'prod-1',
  status: 'approved',
  created_at: '2024-05-01T10:00:00.000Z',
  updated_at: '2024-05-01T11:00:00.000Z',
  paid_at: '2024-05-01T11:10:00.000Z',
  traffic_source: null,
  source: null,
  abandoned_before_payment: false,
  checkout_url: 'https://checkout.kiwify.com/sale',
  ...overrides,
});

describe('buildSalesSummary', () => {
  it('computes totals, approvals and recovery counts', () => {
    const summary = buildSalesSummary([
      buildSale({ id: '1', status: 'approved', abandoned_before_payment: true }),
      buildSale({ id: '2', status: 'approved', abandoned_before_payment: false }),
      buildSale({ id: '3', status: 'refunded' }),
    ]);

    expect(summary).toEqual({
      total: 3,
      approved: 2,
      refunded: 1,
      recovered: 1,
      approvalRate: 66.7,
    });
  });

  it('returns zero approval rate when there are no sales', () => {
    expect(buildSalesSummary([])).toEqual({
      total: 0,
      approved: 0,
      refunded: 0,
      recovered: 0,
      approvalRate: 0,
    });
  });
});
