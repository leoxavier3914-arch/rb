import { unstable_noStore as noStore } from 'next/cache';
import { fetchAbandonedCarts } from './abandonedCarts';
import type {
  AbandonedCart,
  AbandonedCartHistoryEntry,
  AbandonedCartSnapshot,
  AbandonedCartUpdate,
} from './types';

const parseTime = (value: string | null | undefined) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const time = Date.parse(value);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

const buildLeadKey = (snapshot: AbandonedCartSnapshot) => {
  const email = snapshot.customer_email?.trim().toLowerCase();
  const productKey =
    snapshot.product_id?.trim().toLowerCase() ||
    snapshot.product_name?.trim().toLowerCase() ||
    snapshot.id;

  return `${email ?? ''}::${productKey ?? ''}`;
};

const getSnapshotTime = (snapshot: AbandonedCartSnapshot) => {
  const candidates = [snapshot.updated_at, snapshot.created_at];
  let latest = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const time = parseTime(candidate);
    if (time > latest) {
      latest = time;
    }
  }

  return latest;
};

const getUpdateTime = (update: AbandonedCartUpdate) => {
  const candidates = [update.timestamp, update.snapshot.updated_at, update.snapshot.created_at];
  let latest = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const time = parseTime(candidate);
    if (time > latest) {
      latest = time;
    }
  }

  return latest;
};

const mergeHistoryEntry = (
  current: AbandonedCartHistoryEntry,
  incoming: AbandonedCartHistoryEntry,
): AbandonedCartHistoryEntry => {
  const updatesById = new Map<string, AbandonedCartUpdate>();

  const registerUpdate = (update: AbandonedCartUpdate) => {
    const existing = updatesById.get(update.id);

    if (!existing) {
      updatesById.set(update.id, update);
      return;
    }

    const existingTime = getUpdateTime(existing);
    const incomingTime = getUpdateTime(update);

    if (incomingTime >= existingTime) {
      updatesById.set(update.id, update);
    }
  };

  for (const update of current.updates) {
    registerUpdate(update);
  }

  for (const update of incoming.updates) {
    registerUpdate(update);
  }

  const updates = Array.from(updatesById.values()).sort((a, b) => getUpdateTime(a) - getUpdateTime(b));

  const snapshotTime = getSnapshotTime(current.snapshot);
  const incomingSnapshotTime = getSnapshotTime(incoming.snapshot);

  const snapshot = incomingSnapshotTime >= snapshotTime ? incoming.snapshot : current.snapshot;

  return {
    cartKey: current.cartKey,
    snapshot,
    updates,
  } satisfies AbandonedCartHistoryEntry;
};

const getHistoryEntryLatestTime = (entry: AbandonedCartHistoryEntry) => {
  if (entry.updates.length === 0) {
    return getSnapshotTime(entry.snapshot);
  }

  const latestUpdate = entry.updates[entry.updates.length - 1];
  return getUpdateTime(latestUpdate);
};

type LeadAccumulator = {
  key: string;
  email: string;
  name: string | null;
  phone: string | null;
  historyByCartKey: Map<string, AbandonedCartHistoryEntry>;
  hasConversion: boolean;
};

const ensureAccumulator = (
  map: Map<string, LeadAccumulator>,
  key: string,
  snapshot: AbandonedCartSnapshot,
) => {
  const existing = map.get(key);

  if (existing) {
    if (!existing.name && snapshot.customer_name) {
      existing.name = snapshot.customer_name;
    }

    if (!existing.phone && snapshot.customer_phone) {
      existing.phone = snapshot.customer_phone;
    }

    if (!existing.email && snapshot.customer_email) {
      existing.email = snapshot.customer_email;
    }

    return existing;
  }

  const accumulator: LeadAccumulator = {
    key,
    email: snapshot.customer_email ?? '',
    name: snapshot.customer_name ?? null,
    phone: snapshot.customer_phone ?? null,
    historyByCartKey: new Map(),
    hasConversion: false,
  };

  map.set(key, accumulator);
  return accumulator;
};

const CONVERSION_STATUSES = new Set(['approved', 'refunded']);

const registerHistoryEntry = (
  accumulator: LeadAccumulator,
  entry: AbandonedCartHistoryEntry,
) => {
  const existing = accumulator.historyByCartKey.get(entry.cartKey);

  if (existing) {
    accumulator.historyByCartKey.set(entry.cartKey, mergeHistoryEntry(existing, entry));
  } else {
    accumulator.historyByCartKey.set(entry.cartKey, {
      cartKey: entry.cartKey,
      snapshot: entry.snapshot,
      updates: entry.updates.slice().sort((a, b) => getUpdateTime(a) - getUpdateTime(b)),
    });
  }

  const { snapshot } = entry;
  if (CONVERSION_STATUSES.has(snapshot.status)) {
    accumulator.hasConversion = true;
  }

  for (const update of entry.updates) {
    const status = update.status ?? update.snapshot.status;
    if (status && CONVERSION_STATUSES.has(status)) {
      accumulator.hasConversion = true;
      break;
    }
  }
};

const createFallbackHistoryEntry = (cart: AbandonedCart): AbandonedCartHistoryEntry => ({
  cartKey: cart.cart_key,
  snapshot: cart,
  updates:
    cart.updates?.slice().sort((a, b) => getUpdateTime(a) - getUpdateTime(b)) ??
    [
      {
        id: cart.id,
        timestamp: cart.updated_at ?? cart.created_at ?? null,
        status: cart.status,
        event: cart.last_event,
        source: null,
        snapshot: cart,
      },
    ],
});

type LeadTimestampRecord = {
  value: string | null;
  time: number;
};

const considerTimestamp = (candidate: string | null | undefined, current: LeadTimestampRecord, pickLatest: boolean) => {
  const time = parseTime(candidate ?? null);
  if (time === Number.NEGATIVE_INFINITY) {
    return current;
  }

  if (pickLatest) {
    if (time >= current.time) {
      return { value: candidate ?? null, time };
    }
    return current;
  }

  if (time <= current.time) {
    return { value: candidate ?? null, time };
  }

  return current;
};

export type LeadRecord = {
  key: string;
  email: string;
  name: string | null;
  phone: string | null;
  productName: string | null;
  latestStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  checkoutUrl: string | null;
  history: AbandonedCartHistoryEntry[];
  latestUpdate: AbandonedCartUpdate | null;
  activeCartKey: string | null;
};

export function buildLeadsFromCarts(carts: AbandonedCart[]): LeadRecord[] {
  const groups = new Map<string, LeadAccumulator>();

  for (const cart of carts) {
    const key = buildLeadKey(cart);

    const accumulator = ensureAccumulator(groups, key, cart);
    const entries = cart.history && cart.history.length > 0 ? cart.history : [createFallbackHistoryEntry(cart)];

    for (const entry of entries) {
      const entryKey = buildLeadKey(entry.snapshot);
      if (entryKey !== key) {
        continue;
      }

      registerHistoryEntry(accumulator, entry);
    }
  }

  const leads: LeadRecord[] = [];

  groups.forEach((accumulator) => {
    if (accumulator.hasConversion) {
      return;
    }

    const historyEntries = Array.from(accumulator.historyByCartKey.values());

    if (historyEntries.length === 0) {
      return;
    }

    historyEntries.sort((a, b) => getHistoryEntryLatestTime(b) - getHistoryEntryLatestTime(a));

    let latestRecord: LeadTimestampRecord = { value: null, time: Number.NEGATIVE_INFINITY };
    let earliestRecord: LeadTimestampRecord = { value: null, time: Number.POSITIVE_INFINITY };
    let latestUpdate: AbandonedCartUpdate | null = null;
    let latestUpdateTime = Number.NEGATIVE_INFINITY;
    let activeCartKey: string | null = null;

    for (const entry of historyEntries) {
      const entrySnapshot = entry.snapshot;
      earliestRecord = considerTimestamp(entrySnapshot.created_at, earliestRecord, false);
      earliestRecord = considerTimestamp(entrySnapshot.updated_at, earliestRecord, false);
      latestRecord = considerTimestamp(entrySnapshot.updated_at, latestRecord, true);
      latestRecord = considerTimestamp(entrySnapshot.created_at, latestRecord, true);

      if (entry.updates.length > 0) {
        for (const update of entry.updates) {
          earliestRecord = considerTimestamp(update.timestamp, earliestRecord, false);
          earliestRecord = considerTimestamp(update.snapshot.created_at, earliestRecord, false);
          earliestRecord = considerTimestamp(update.snapshot.updated_at, earliestRecord, false);
          latestRecord = considerTimestamp(update.timestamp, latestRecord, true);
          latestRecord = considerTimestamp(update.snapshot.updated_at, latestRecord, true);
          latestRecord = considerTimestamp(update.snapshot.created_at, latestRecord, true);

          const updateTime = getUpdateTime(update);
          if (updateTime >= latestUpdateTime) {
            latestUpdate = update;
            latestUpdateTime = updateTime;
            activeCartKey = entry.cartKey;
          }
        }
      }
    }

    const referenceSnapshot = latestUpdate?.snapshot ?? historyEntries[0]?.snapshot ?? null;
    if (!activeCartKey) {
      activeCartKey = historyEntries[0]?.cartKey ?? null;
    }

    leads.push({
      key: accumulator.key,
      email: accumulator.email,
      name: accumulator.name,
      phone: accumulator.phone,
      productName: referenceSnapshot?.product_name ?? null,
      latestStatus: latestUpdate?.status ?? referenceSnapshot?.status ?? null,
      createdAt: earliestRecord.time === Number.POSITIVE_INFINITY ? null : earliestRecord.value,
      updatedAt: latestRecord.time === Number.NEGATIVE_INFINITY ? null : latestRecord.value,
      checkoutUrl: referenceSnapshot?.checkout_url ?? null,
      history: historyEntries,
      latestUpdate: latestUpdate ?? null,
      activeCartKey,
    });
  });

  return leads.sort((a, b) => parseTime(b.updatedAt) - parseTime(a.updatedAt));
}

export async function fetchLeads(): Promise<LeadRecord[]> {
  noStore();

  const carts = await fetchAbandonedCarts();
  return buildLeadsFromCarts(carts);
}

export type LeadMetrics = {
  totalLeads: number;
  newLeadsLast24h: number;
  activeLeadsLast24h: number;
};

export function computeLeadMetrics(leads: LeadRecord[], now = Date.now()): LeadMetrics {
  const DAY_IN_MS = 24 * 60 * 60 * 1000;
  const threshold = now - DAY_IN_MS;

  let newLeadsLast24h = 0;
  let activeLeadsLast24h = 0;

  for (const lead of leads) {
    const createdTime = parseTime(lead.createdAt);
    const updatedTime = parseTime(lead.updatedAt);

    if (createdTime >= threshold) {
      newLeadsLast24h += 1;
    }

    if (updatedTime >= threshold) {
      activeLeadsLast24h += 1;
    }
  }

  return {
    totalLeads: leads.length,
    newLeadsLast24h,
    activeLeadsLast24h,
  };
}

export const __testables = {
  buildLeadKey,
  mergeHistoryEntry,
};
