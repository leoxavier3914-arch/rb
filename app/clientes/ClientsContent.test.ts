import { describe, expect, it } from 'vitest';
import { getUniqueProducts } from './ClientsContent';
import type {
  AbandonedCartHistoryEntry,
  AbandonedCartSnapshot,
  AbandonedCartUpdate,
  CustomerCheckoutAggregate,
} from '../../lib/types';

const buildSnapshot = (overrides: Partial<AbandonedCartSnapshot> = {}): AbandonedCartSnapshot => ({
  id: 'checkout-1',
  checkout_id: 'checkout-1',
  customer_email: 'client@example.com',
  customer_name: 'Cliente',
  customer_phone: null,
  product_name: 'Produto via histórico',
  product_id: 'prod-1',
  status: 'new',
  paid: false,
  paid_at: null,
  discount_code: null,
  expires_at: null,
  last_event: null,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  checkout_url: null,
  traffic_source: null,
  ...overrides,
});

const buildUpdate = (overrides: Partial<AbandonedCartUpdate> = {}): AbandonedCartUpdate => ({
  id: 'update-1',
  timestamp: '2024-01-02T00:00:00.000Z',
  status: 'new',
  event: 'Checkout atualizado',
  source: 'test',
  snapshot: buildSnapshot({ product_name: 'Produto atualizado', updated_at: '2024-01-02T00:00:00.000Z' }),
  ...overrides,
});

const buildHistoryEntry = (
  overrides: Partial<AbandonedCartHistoryEntry> = {},
): AbandonedCartHistoryEntry => ({
  cartKey: 'history-1',
  snapshot: buildSnapshot(),
  updates: [buildUpdate()],
  ...overrides,
});

describe('getUniqueProducts', () => {
  it('returns product names from history when there are no approved sales', () => {
    const client: CustomerCheckoutAggregate = {
      email: 'client@example.com',
      name: 'Cliente',
      phone: null,
      approvedSales: [],
      history: [buildHistoryEntry()],
    };

    const products = getUniqueProducts(client);

    expect(products[0]).toBe('Produto atualizado');
    expect(products).toContain('Produto via histórico');
  });
});
