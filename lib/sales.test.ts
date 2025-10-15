import { describe, expect, it } from 'vitest';
import { __testables } from './sales';

const { mapRowToDashboardSale } = __testables;

describe('mapRowToDashboardSale', () => {
  it('keeps approved status when payment happens shortly after a reminder', () => {
    const row = {
      id: '1',
      customer_email: 'user@example.com',
      status: 'approved',
      paid: true,
      paid_at: '2024-08-01T10:05:00.000Z',
      sent_at: '2024-08-01T10:03:00.000Z',
      created_at: '2024-08-01T09:50:00.000Z',
      updated_at: '2024-08-01T10:05:00.000Z',
      payload: {},
    };

    const sale = mapRowToDashboardSale(row);

    expect(sale.status).toBe('approved');
    expect(sale.email_follow_up).toBe(false);
  });

  it('marks sale as converted when reminder is much earlier than payment', () => {
    const row = {
      id: '2',
      customer_email: 'user@example.com',
      status: 'approved',
      paid: true,
      paid_at: '2024-08-01T12:00:00.000Z',
      sent_at: '2024-08-01T10:00:00.000Z',
      created_at: '2024-08-01T09:00:00.000Z',
      updated_at: '2024-08-01T12:00:00.000Z',
      payload: {},
    };

    const sale = mapRowToDashboardSale(row);

    expect(sale.status).toBe('converted');
    expect(sale.email_follow_up).toBe(true);
  });

  it('uses status tokens when reminder timestamp is missing', () => {
    const row = {
      id: '3',
      customer_email: 'user@example.com',
      status: 'approved',
      paid: true,
      paid_at: '2024-08-01T12:00:00.000Z',
      last_event: 'manual.email.sent',
      created_at: '2024-08-01T11:00:00.000Z',
      updated_at: '2024-08-01T12:00:00.000Z',
      payload: {},
    };

    const sale = mapRowToDashboardSale(row);

    expect(sale.status).toBe('converted');
    expect(sale.email_follow_up).toBe(true);
  });
});
