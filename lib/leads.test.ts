import { describe, expect, it } from 'vitest';
import type {
  AbandonedCart,
  AbandonedCartHistoryEntry,
  AbandonedCartSnapshot,
  AbandonedCartUpdate,
} from './types';
import { buildLeadsFromCarts, computeLeadMetrics, type LeadRecord } from './leads';

const makeSnapshot = (overrides: Partial<AbandonedCartSnapshot>): AbandonedCartSnapshot => ({
  id: overrides.id ?? 'cart-1',
  checkout_id: overrides.checkout_id ?? null,
  customer_email: overrides.customer_email ?? 'lead@example.com',
  customer_name: overrides.customer_name ?? 'Lead Example',
  customer_phone: overrides.customer_phone ?? null,
  product_name: overrides.product_name ?? 'Produto X',
  product_id: overrides.product_id ?? 'produto-x',
  status: overrides.status ?? 'pending',
  paid: overrides.paid ?? false,
  paid_at: overrides.paid_at ?? null,
  discount_code: overrides.discount_code ?? null,
  expires_at: overrides.expires_at ?? null,
  last_event: overrides.last_event ?? null,
  created_at: overrides.created_at ?? '2024-05-01T10:00:00.000Z',
  updated_at: overrides.updated_at ?? overrides.created_at ?? '2024-05-01T10:00:00.000Z',
  checkout_url: overrides.checkout_url ?? 'https://checkout.example.com',
  traffic_source: overrides.traffic_source ?? null,
});

const makeUpdate = (snapshot: AbandonedCartSnapshot, overrides: Partial<AbandonedCartUpdate>): AbandonedCartUpdate => ({
  id: overrides.id ?? `${snapshot.id}-update`,
  timestamp: overrides.timestamp ?? snapshot.updated_at,
  status: overrides.status ?? snapshot.status,
  event: overrides.event ?? null,
  source: overrides.source ?? null,
  snapshot: overrides.snapshot ?? snapshot,
});

const makeHistoryEntry = (
  snapshot: AbandonedCartSnapshot,
  updates: AbandonedCartUpdate[],
  overrides: Partial<AbandonedCartHistoryEntry> = {},
): AbandonedCartHistoryEntry => ({
  cartKey: overrides.cartKey ?? `checkout:${snapshot.id}`,
  snapshot: overrides.snapshot ?? snapshot,
  updates,
});

const makeCart = (
  snapshotOverrides: Partial<AbandonedCartSnapshot>,
  historyOverrides: Partial<AbandonedCartHistoryEntry>[] = [],
) => {
  const snapshot = makeSnapshot(snapshotOverrides);
  const defaultUpdate = makeUpdate(snapshot, {});
  const baseHistory = makeHistoryEntry(snapshot, [defaultUpdate]);
  const historyEntries = historyOverrides.length > 0
    ? historyOverrides.map((entryOverrides, index) => {
        const entrySnapshot = entryOverrides.snapshot ?? snapshot;
        const updates = entryOverrides.updates ?? [
          makeUpdate(entrySnapshot, { id: `${entrySnapshot.id}-update-${index}` }),
        ];
        return makeHistoryEntry(entrySnapshot, updates, entryOverrides);
      })
    : [baseHistory];

  return {
    ...snapshot,
    cart_key: baseHistory.cartKey,
    updates: historyEntries[0]?.updates ?? [defaultUpdate],
    history: historyEntries,
  } satisfies AbandonedCart;
};

describe('buildLeadsFromCarts', () => {
  it('filters out leads with approved or refunded history entries', () => {
    const activeLead = makeCart({
      id: 'cart-1',
      customer_email: 'lead@example.com',
      product_id: 'produto-x',
      status: 'pending',
      created_at: '2024-05-01T10:00:00.000Z',
      updated_at: '2024-05-01T12:00:00.000Z',
    });

    const convertedSnapshot = makeSnapshot({
      id: 'cart-2',
      customer_email: 'buyer@example.com',
      product_id: 'produto-y',
      status: 'approved',
      created_at: '2024-05-02T10:00:00.000Z',
      updated_at: '2024-05-02T11:00:00.000Z',
    });

    const convertedHistory = makeHistoryEntry(convertedSnapshot, [
      makeUpdate(convertedSnapshot, { status: 'approved', timestamp: '2024-05-02T11:00:00.000Z' }),
    ]);

    const convertedCart: AbandonedCart = {
      ...convertedSnapshot,
      cart_key: convertedHistory.cartKey,
      updates: convertedHistory.updates,
      history: [convertedHistory],
    };

    const leads = buildLeadsFromCarts([activeLead, convertedCart]);

    expect(leads).toHaveLength(1);
    expect(leads[0]?.email).toBe('lead@example.com');
  });

  it('groups carts by customer key and keeps combined history', () => {
    const firstSnapshot = makeSnapshot({
      id: 'cart-a',
      customer_email: 'multi@example.com',
      product_id: 'produto-z',
      created_at: '2024-05-03T09:00:00.000Z',
      updated_at: '2024-05-03T09:10:00.000Z',
    });

    const secondSnapshot = makeSnapshot({
      id: 'cart-b',
      customer_email: 'multi@example.com',
      product_id: 'produto-z',
      created_at: '2024-05-04T09:00:00.000Z',
      updated_at: '2024-05-04T09:30:00.000Z',
    });

    const firstHistory = makeHistoryEntry(firstSnapshot, [
      makeUpdate(firstSnapshot, { id: 'u-1', timestamp: '2024-05-03T09:05:00.000Z', status: 'new' }),
      makeUpdate(firstSnapshot, { id: 'u-2', timestamp: '2024-05-03T09:10:00.000Z', status: 'pending' }),
    ]);

    const secondHistory = makeHistoryEntry(secondSnapshot, [
      makeUpdate(secondSnapshot, { id: 'u-3', timestamp: '2024-05-04T09:15:00.000Z', status: 'pending' }),
      makeUpdate(secondSnapshot, { id: 'u-4', timestamp: '2024-05-04T09:30:00.000Z', status: 'abandoned' }),
    ]);

    const aggregatedCart: AbandonedCart = {
      ...secondSnapshot,
      cart_key: secondHistory.cartKey,
      updates: secondHistory.updates,
      history: [firstHistory, secondHistory],
    };

    const leads = buildLeadsFromCarts([aggregatedCart]);

    expect(leads).toHaveLength(1);
    expect(leads[0]?.history).toHaveLength(2);
    expect(leads[0]?.updatedAt).toBe('2024-05-04T09:30:00.000Z');
    expect(leads[0]?.createdAt).toBe('2024-05-03T09:00:00.000Z');
  });

  it('keeps abandoned snapshot status even when latest update differs', () => {
    const abandonedSnapshot = makeSnapshot({
      id: 'cart-stale',
      status: 'abandoned',
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-02T00:00:00.000Z',
    });

    const pendingUpdate = makeUpdate(abandonedSnapshot, {
      id: 'cart-stale-update',
      timestamp: '2023-01-03T00:00:00.000Z',
      status: 'pending',
    });

    const historyEntry = makeHistoryEntry(abandonedSnapshot, [pendingUpdate]);

    const cart: AbandonedCart = {
      ...abandonedSnapshot,
      cart_key: historyEntry.cartKey,
      updates: historyEntry.updates,
      history: [historyEntry],
    };

    const leads = buildLeadsFromCarts([cart]);

    expect(leads).toHaveLength(1);
    expect(leads[0]?.latestStatus).toBe('abandoned');
  });
});

describe('computeLeadMetrics', () => {
  it('counts total, new and active leads within 24 hours', () => {
    const baseLead = (overrides: Partial<LeadRecord>): LeadRecord => ({
      key: overrides.key ?? 'lead-1',
      email: overrides.email ?? 'lead@example.com',
      name: overrides.name ?? null,
      phone: overrides.phone ?? null,
      productName: overrides.productName ?? null,
      latestStatus: overrides.latestStatus ?? null,
      createdAt: overrides.createdAt ?? '2024-05-05T10:00:00.000Z',
      updatedAt: overrides.updatedAt ?? '2024-05-05T12:00:00.000Z',
      checkoutUrl: overrides.checkoutUrl ?? null,
      history: overrides.history ?? [],
      latestUpdate: overrides.latestUpdate ?? null,
      activeCartKey: overrides.activeCartKey ?? null,
    });

    const now = Date.parse('2024-05-06T12:00:00.000Z');

    const leads: LeadRecord[] = [
      baseLead({ key: 'recent', createdAt: '2024-05-06T09:00:00.000Z', updatedAt: '2024-05-06T10:00:00.000Z' }),
      baseLead({ key: 'stale', createdAt: '2024-04-01T10:00:00.000Z', updatedAt: '2024-04-02T10:00:00.000Z' }),
      baseLead({ key: 'active', createdAt: '2024-05-01T10:00:00.000Z', updatedAt: '2024-05-06T11:00:00.000Z' }),
    ];

    const metrics = computeLeadMetrics(leads, now);

    expect(metrics.totalLeads).toBe(3);
    expect(metrics.newLeadsLast24h).toBe(1);
    expect(metrics.activeLeadsLast24h).toBe(2);
  });
});
