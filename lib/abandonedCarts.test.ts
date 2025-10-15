import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveStatus, __testables } from './abandonedCarts';
import type { AbandonedCartSnapshot, AbandonedCartUpdate } from './types';

const { enrichUpdatesWithMilestones } = __testables;

describe('resolveStatus', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'abandoned' for carts stuck as new after an hour without payment", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T02:00:00.000Z'));

    const status = resolveStatus({
      normalizedStatuses: ['new'],
      paid: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    expect(status).toBe('abandoned');
  });
});

describe('enrichUpdatesWithMilestones', () => {
  const baseSnapshot: AbandonedCartSnapshot = {
    id: 'cart-1',
    checkout_id: 'checkout-1',
    customer_email: 'user@example.com',
    customer_name: 'User',
    customer_phone: null,
    product_name: 'Produto',
    product_id: 'produto-1',
    status: 'abandoned',
    paid: false,
    paid_at: null,
    discount_code: null,
    expires_at: null,
    last_event: null,
    created_at: '2024-01-01T10:00:00.000Z',
    updated_at: '2024-01-01T10:30:00.000Z',
    checkout_url: null,
    traffic_source: null,
  };

  const makeUpdate = (overrides: Partial<AbandonedCartUpdate>): AbandonedCartUpdate => ({
    id: overrides.id ?? 'update-1',
    timestamp: overrides.timestamp ?? baseSnapshot.updated_at,
    status: overrides.status ?? 'abandoned',
    event: overrides.event ?? null,
    source: overrides.source ?? 'webhook',
    snapshot: overrides.snapshot ?? baseSnapshot,
  });

  it('adds a synthetic creation event when the timeline starts as abandoned', () => {
    const updates = [makeUpdate({})];

    const enriched = enrichUpdatesWithMilestones(updates, baseSnapshot);

    expect(enriched[0].status).toBe('new');
    expect(enriched[0].timestamp).toBe('2024-01-01T10:00:00.000Z');
    expect(enriched.some((update) => update.status === 'abandoned')).toBe(true);
  });

  it('adds an abandoned transition one hour after creation when none is recorded', () => {
    const snapshot = { ...baseSnapshot, updated_at: baseSnapshot.created_at };
    const updates = [
      makeUpdate({
        timestamp: snapshot.created_at,
        snapshot,
      }),
    ];

    const enriched = enrichUpdatesWithMilestones(updates, snapshot);

    const abandonedEvents = enriched.filter((update) => update.status === 'abandoned');
    expect(abandonedEvents).toHaveLength(1);
    expect(abandonedEvents[0]?.timestamp).toBe('2024-01-01T11:00:00.000Z');
  });

  it('includes payment approval when paid_at is present', () => {
    const snapshot = { ...baseSnapshot, status: 'approved', paid: true, paid_at: '2024-01-01T11:30:00.000Z' };
    const updates = [
      makeUpdate({
        status: 'approved',
        timestamp: '2024-01-01T11:45:00.000Z',
        snapshot,
      }),
    ];

    const enriched = enrichUpdatesWithMilestones(updates, snapshot);

    const approvedEvents = enriched.filter((update) => update.status === 'approved');
    expect(approvedEvents.some((update) => update.timestamp === '2024-01-01T11:30:00.000Z')).toBe(true);
  });

  it('reuses webhook approved update when timestamp differs from paid_at', () => {
    const snapshot = {
      ...baseSnapshot,
      status: 'approved',
      paid: true,
      paid_at: '2024-01-01T11:30:00.000Z',
    };

    const updates: AbandonedCartUpdate[] = [
      {
        id: 'update-new',
        timestamp: snapshot.created_at,
        status: 'new',
        event: 'Checkout criado',
        source: 'webhook',
        snapshot: {
          ...snapshot,
          status: 'new',
          paid: false,
          paid_at: null,
          updated_at: snapshot.created_at,
          last_event: 'Checkout criado',
        },
      },
      {
        id: 'update-approved',
        timestamp: '2024-01-01T11:45:00.000Z',
        status: 'approved',
        event: 'Pagamento aprovado',
        source: 'webhook',
        snapshot: {
          ...snapshot,
          status: 'approved',
          updated_at: '2024-01-01T11:45:00.000Z',
          last_event: 'Pagamento aprovado',
          paid_at: '2024-01-01T11:45:00.000Z',
        },
      },
    ];

    const enriched = enrichUpdatesWithMilestones(updates, snapshot);

    expect(enriched.filter((update) => update.source === 'sistema')).toHaveLength(0);

    const approvedUpdates = enriched.filter((update) => update.status === 'approved');
    expect(approvedUpdates).toHaveLength(1);
    expect(approvedUpdates[0]?.id).toBe('update-approved');
    expect(approvedUpdates[0]?.timestamp).toBe(snapshot.paid_at);
    expect(approvedUpdates[0]?.snapshot.paid).toBe(true);
    expect(approvedUpdates[0]?.snapshot.paid_at).toBe(snapshot.paid_at);
  });
});
