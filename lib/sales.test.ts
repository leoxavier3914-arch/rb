import { afterEach, describe, expect, it, vi } from 'vitest';
import * as sales from './sales';
import type { DashboardSale, AbandonedCart, Sale } from './types';

const { mapRowToDashboardSale } = sales.__testables;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mapRowToDashboardSale', () => {
  it('marks paid rows as approved regardless of timestamps', () => {
    const row = {
      id: '1',
      customer_email: 'user@example.com',
      status: 'pending',
      paid: true,
      paid_at: '2024-08-01T10:05:00.000Z',
      created_at: '2024-08-01T09:50:00.000Z',
      updated_at: '2024-08-01T10:05:00.000Z',
      payload: {},
    };

    const sale = mapRowToDashboardSale(row);

    expect(sale.status).toBe('approved');
  });

  it('normalizes pending tokens to new while within the grace period', () => {
    const row = {
      id: '2',
      customer_email: 'user@example.com',
      status: 'pending',
      paid: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      payload: { status: 'pending' },
    };

    const sale = mapRowToDashboardSale(row);

    expect(sale.status).toBe('new');
  });

  it('marks unpaid carts older than one hour as abandoned', () => {
    const row = {
      id: '3',
      customer_email: 'user@example.com',
      status: 'new',
      paid: false,
      created_at: '2024-08-01T09:00:00.000Z',
      updated_at: '2024-08-01T09:00:00.000Z',
      payload: {},
    };

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-08-01T10:30:00.000Z'));

    const sale = mapRowToDashboardSale(row);

    expect(sale.status).toBe('abandoned');

    vi.useRealTimers();
  });

  it('prefers checkout urls from the main row data when available', () => {
    const row = {
      id: 'checkout-row',
      customer_email: 'user@example.com',
      status: 'approved',
      paid: true,
      checkout_url: 'https://checkout.kiwify.com/from-row',
      payload: {
        checkout_url: 'https://checkout.kiwify.com/from-payload',
      },
    };

    const sale = mapRowToDashboardSale(row);

    expect(sale.checkout_url).toBe('https://checkout.kiwify.com/from-row');
  });
});

describe('groupLatestDashboardEvents', () => {
  it('keeps only the most recent event per customer/product combination', async () => {
    const baseEvent: DashboardSale = {
      id: '1',
      customer_email: 'user@example.com',
      customer_name: 'User',
      customer_phone: null,
      product_id: 'prod-1',
      product_name: 'Produto A',
      status: 'abandoned',
      created_at: '2024-05-01T10:00:00.000Z',
      updated_at: '2024-05-01T11:00:00.000Z',
      paid_at: null,
      last_event: 'checkout_created',
      traffic_source: null,
      source: 'webhook',
      checkout_url: null,
    };

    const newerEvent: DashboardSale = {
      ...baseEvent,
      id: '2',
      status: 'approved',
      updated_at: '2024-05-01T12:30:00.000Z',
    };

    const grouped = await sales.groupLatestDashboardEvents({ sales: [baseEvent, newerEvent] });

    expect(grouped).toHaveLength(1);
    expect(grouped[0].id).toBe('2');
    expect(grouped[0].status).toBe('approved');
    expect(grouped[0].latest_timestamp).toBe('2024-05-01T12:30:00.000Z');
    expect(grouped[0].latest_timestamp_source).toBe('updated_at');
  });

  it('uses product name as a fallback key and sorts by the latest timestamp', async () => {
    const abandoned: DashboardSale = {
      id: '3',
      customer_email: 'alt@example.com',
      customer_name: null,
      customer_phone: null,
      product_id: null,
      product_name: 'Produto B',
      status: 'abandoned',
      created_at: '2024-05-02T10:00:00.000Z',
      updated_at: null,
      paid_at: null,
      last_event: 'checkout_created',
      traffic_source: null,
      source: 'webhook',
      checkout_url: null,
    };

    const refunded: DashboardSale = {
      ...abandoned,
      id: '4',
      status: 'refunded',
      paid_at: '2024-05-03T09:00:00.000Z',
      last_event: 'refund_processed',
    };

    const otherProduct: DashboardSale = {
      id: '5',
      customer_email: 'user@example.com',
      customer_name: 'User',
      customer_phone: null,
      product_id: 'prod-2',
      product_name: 'Produto C',
      status: 'new',
      created_at: '2024-05-04T08:00:00.000Z',
      updated_at: null,
      paid_at: null,
      last_event: 'checkout_created',
      traffic_source: null,
      source: 'webhook',
      checkout_url: null,
    };

    const grouped = await sales.groupLatestDashboardEvents({
      sales: [abandoned, refunded, otherProduct],
    });

    expect(grouped).toHaveLength(2);
    expect(grouped[0].id).toBe('5');
    expect(grouped[0].latest_timestamp_source).toBe('created_at');
    expect(grouped[1].id).toBe('4');
    expect(grouped[1].latest_timestamp_source).toBe('paid_at');
  });
});

describe('fetchCustomersWithCheckouts', () => {
  it('merges approved sales with cart history per customer', async () => {
    const sale: Sale = {
      id: 'sale-1',
      customer_email: 'user@example.com',
      customer_name: 'Cliente Teste',
      customer_phone: '5511999999999',
      product_name: 'Produto A',
      product_id: 'prod-a',
      status: 'approved',
      created_at: '2024-05-01T10:00:00.000Z',
      updated_at: '2024-05-01T11:00:00.000Z',
      paid_at: '2024-05-01T11:10:00.000Z',
      traffic_source: null,
      source: null,
      abandoned_before_payment: false,
      checkout_url: 'https://checkout.example.com/sale-1',
    };

    const baseSnapshot = {
      id: 'cart-1',
      checkout_id: 'sale-1',
      customer_email: 'user@example.com',
      customer_name: 'Cliente Teste',
      customer_phone: '5511999999999',
      product_name: 'Produto A',
      product_id: 'prod-a',
      status: 'approved',
      paid: true,
      paid_at: '2024-05-01T11:10:00.000Z',
      discount_code: null,
      expires_at: null,
      last_event: 'payment.approved',
      created_at: '2024-05-01T10:00:00.000Z',
      updated_at: '2024-05-01T11:10:00.000Z',
      checkout_url: 'https://checkout.example.com/sale-1',
      traffic_source: null,
    } as const;

    const update = {
      id: 'update-1',
      timestamp: '2024-05-01T11:10:00.000Z',
      status: 'approved',
      event: 'payment.approved',
      source: 'webhook',
      snapshot: baseSnapshot,
    } as const;

    const cart: AbandonedCart = {
      ...baseSnapshot,
      cart_key: 'checkout:sale-1',
      updates: [update],
      history: [
        {
          cartKey: 'checkout:sale-1',
          snapshot: baseSnapshot,
          updates: [update],
        },
      ],
    };

    const result = sales.buildCustomersWithCheckouts({ sales: [sale], carts: [cart] });

    expect(result).toHaveLength(1);
    const customer = result[0];
    expect(customer.email).toBe('user@example.com');
    expect(customer.approvedSales).toHaveLength(1);
    expect(customer.history).toHaveLength(1);
    expect(customer.history[0].cartKey).toBe('checkout:sale-1');
  });

  it('creates synthetic history entries when a sale has no recorded cart history', async () => {
    const sale: Sale = {
      id: 'sale-2',
      customer_email: 'other@example.com',
      customer_name: 'Outra Pessoa',
      customer_phone: null,
      product_name: 'Produto B',
      product_id: 'prod-b',
      status: 'approved',
      created_at: '2024-05-02T08:00:00.000Z',
      updated_at: '2024-05-02T09:00:00.000Z',
      paid_at: '2024-05-02T09:15:00.000Z',
      traffic_source: null,
      source: null,
      abandoned_before_payment: false,
      checkout_url: 'https://checkout.example.com/sale-2',
    };

    const result = sales.buildCustomersWithCheckouts({ sales: [sale], carts: [] });

    expect(result).toHaveLength(1);
    const customer = result[0];
    expect(customer.history).toHaveLength(1);
    const syntheticEntry = customer.history[0];
    expect(syntheticEntry.snapshot.checkout_id).toBe('sale-2');
    expect(syntheticEntry.updates).toHaveLength(2);
    expect(syntheticEntry.updates[0].status).toBe('new');
    expect(syntheticEntry.updates[1].status).toBe('approved');
    expect(syntheticEntry.updates[0].timestamp).toBe('2024-05-02T08:00:00.000Z');
    expect(syntheticEntry.updates[1].timestamp).toBe('2024-05-02T09:15:00.000Z');
  });
});
