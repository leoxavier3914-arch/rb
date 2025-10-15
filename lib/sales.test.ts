import { describe, expect, it, vi } from 'vitest';
import { __testables } from './sales';

const { mapRowToDashboardSale } = __testables;

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
});
