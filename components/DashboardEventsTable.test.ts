import { describe, expect, it } from 'vitest';
import { filterDashboardEvents } from './DashboardEventsTable';
import type { GroupedDashboardEvent } from '../lib/types';

const buildEvent = (overrides: Partial<GroupedDashboardEvent>): GroupedDashboardEvent => ({
  id: overrides.id ?? '1',
  customer_email: overrides.customer_email ?? 'user@example.com',
  customer_name: overrides.customer_name ?? 'User',
  customer_phone: overrides.customer_phone ?? null,
  product_id: overrides.product_id ?? 'prod',
  product_name: overrides.product_name ?? 'Produto',
  status: overrides.status ?? 'new',
  created_at: overrides.created_at ?? null,
  updated_at: overrides.updated_at ?? null,
  paid_at: overrides.paid_at ?? null,
  last_event: overrides.last_event ?? null,
  traffic_source: overrides.traffic_source ?? null,
  source: overrides.source ?? null,
  checkout_url: overrides.checkout_url ?? null,
  latest_timestamp: overrides.latest_timestamp ?? overrides.updated_at ?? null,
  latest_timestamp_source: overrides.latest_timestamp_source ?? 'updated_at',
});

describe('filterDashboardEvents', () => {
  it('returns all events when using the all filter', () => {
    const events = [
      buildEvent({ id: '1', status: 'new' }),
      buildEvent({ id: '2', status: 'approved' }),
    ];

    expect(filterDashboardEvents(events, 'all')).toEqual(events);
  });

  it('returns only events that match the selected status', () => {
    const events = [
      buildEvent({ id: '1', status: 'approved' }),
      buildEvent({ id: '2', status: 'refused' }),
      buildEvent({ id: '3', status: 'approved' }),
    ];

    const filtered = filterDashboardEvents(events, 'approved');

    expect(filtered).toHaveLength(2);
    expect(filtered.every((event) => event.status === 'approved')).toBe(true);
  });
});
