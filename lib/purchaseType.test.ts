import { describe, expect, it } from 'vitest';
import type { AbandonedCartSnapshot, AbandonedCartUpdate } from './types';
import { PURCHASE_TYPE_LABEL, resolvePurchaseType } from './purchaseType';

const buildSnapshot = (overrides: Partial<AbandonedCartSnapshot> = {}): AbandonedCartSnapshot => ({
  id: 'checkout-1',
  checkout_id: 'checkout-1',
  customer_email: 'client@example.com',
  customer_name: 'Cliente',
  customer_phone: null,
  product_name: 'Produto',
  product_id: 'prod-1',
  status: 'new',
  paid: false,
  paid_at: null,
  discount_code: null,
  expires_at: null,
  last_event: null,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T01:00:00.000Z',
  checkout_url: null,
  traffic_source: null,
  ...overrides,
});

const buildUpdate = (overrides: Partial<AbandonedCartUpdate> = {}): AbandonedCartUpdate => ({
  id: 'update-1',
  timestamp: '2024-01-01T00:30:00.000Z',
  status: 'new',
  event: 'Checkout criado',
  source: 'test',
  snapshot: buildSnapshot(),
  ...overrides,
});

describe('resolvePurchaseType', () => {
  it('returns null when there is no payment information', () => {
    const snapshot = buildSnapshot();
    const updates: AbandonedCartUpdate[] = [buildUpdate()];

    expect(resolvePurchaseType(updates, snapshot)).toBeNull();
  });

  it('classifies as direct purchase when checkout is paid without abandonment', () => {
    const snapshot = buildSnapshot({ paid: true, paid_at: '2024-01-01T01:30:00.000Z', status: 'approved' });
    const updates: AbandonedCartUpdate[] = [
      buildUpdate({ status: 'new' }),
      buildUpdate({ id: 'update-2', status: 'approved', timestamp: '2024-01-01T01:30:00.000Z' }),
    ];

    expect(resolvePurchaseType(updates, snapshot)).toBe('direct');
  });

  it('classifies as return purchase when abandonment happens before approval', () => {
    const snapshot = buildSnapshot({ paid: true, paid_at: '2024-01-01T02:30:00.000Z', status: 'approved' });
    const updates: AbandonedCartUpdate[] = [
      buildUpdate({ status: 'new' }),
      buildUpdate({ id: 'update-2', status: 'abandoned', timestamp: '2024-01-01T01:30:00.000Z' }),
      buildUpdate({ id: 'update-3', status: 'approved', timestamp: '2024-01-01T02:30:00.000Z' }),
    ];

    expect(resolvePurchaseType(updates, snapshot)).toBe('return');
  });

  it('uses snapshot information when approval update is missing', () => {
    const snapshot = buildSnapshot({ paid: true, paid_at: '2024-01-01T02:30:00.000Z', status: 'approved' });
    const updates: AbandonedCartUpdate[] = [
      buildUpdate({ status: 'new' }),
      buildUpdate({ id: 'update-2', status: 'abandoned', timestamp: '2024-01-01T01:30:00.000Z' }),
    ];

    expect(resolvePurchaseType(updates, snapshot)).toBe('return');
  });
});

describe('PURCHASE_TYPE_LABEL', () => {
  it('provides localized labels for purchase types', () => {
    expect(PURCHASE_TYPE_LABEL.direct).toBe('Compra direta');
    expect(PURCHASE_TYPE_LABEL.return).toBe('Compra retorno');
  });
});
