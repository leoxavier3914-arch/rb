import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from './supabaseAdmin';
import type {
  AbandonedCart,
  AbandonedCartHistoryEntry,
  AbandonedCartSnapshot,
  AbandonedCartUpdate,
} from './types';
import {
  APPROVED_STATUS_TOKENS,
  ABANDONED_STATUS_TOKENS,
  NEW_STATUS_TOKENS,
  PENDING_STATUS_TOKENS,
  REFUSED_STATUS_TOKENS,
  REFUNDED_STATUS_TOKENS,
  cleanText,
  coerceBoolean,
  normalizeStatusToken,
} from './normalization';

const parseTime = (value: string | null | undefined) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const time = Date.parse(value);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

const ONE_HOUR_IN_MS = 60 * 60 * 1000;

const getUpdateTimestamp = (update: AbandonedCartUpdate) =>
  update.timestamp ?? update.snapshot.updated_at ?? update.snapshot.created_at ?? null;

const SYNTHETIC_SOURCE_LABEL = 'sistema';

const STATUS_EVENT_MESSAGES: Record<string, string> = {
  new: 'Checkout criado',
  pending: 'Pagamento pendente',
  abandoned: 'Checkout abandonado',
  approved: 'Pagamento aprovado',
  refunded: 'Pedido reembolsado',
  refused: 'Pagamento recusado',
};

const cloneSnapshot = (
  snapshot: AbandonedCartSnapshot,
  overrides: Partial<AbandonedCartSnapshot> = {},
): AbandonedCartSnapshot => ({
  ...snapshot,
  ...overrides,
});

type CreateSyntheticUpdateOptions = {
  snapshotSource?: AbandonedCartSnapshot;
};

const createSyntheticUpdate = (
  baseSnapshot: AbandonedCartSnapshot,
  status: string,
  timestamp: string,
  overrides: Partial<AbandonedCartSnapshot> = {},
  options: CreateSyntheticUpdateOptions = {},
): AbandonedCartUpdate => {
  const normalizedStatus = normalizeStatusToken(status) ?? status;
  const event =
    overrides.last_event || STATUS_EVENT_MESSAGES[normalizedStatus] || 'Status atualizado';

  const snapshotSource = options.snapshotSource ?? baseSnapshot;

  const snapshot = cloneSnapshot(snapshotSource, {
    status: normalizedStatus,
    updated_at: timestamp,
    last_event: event,
    ...overrides,
  });

  return {
    id: `synthetic:${normalizedStatus}:${baseSnapshot.id}:${timestamp}`,
    timestamp,
    status: normalizedStatus,
    event,
    source: SYNTHETIC_SOURCE_LABEL,
    snapshot,
  } satisfies AbandonedCartUpdate;
};

const enrichUpdatesWithMilestones = (
  updates: AbandonedCartUpdate[],
  baseSnapshot: AbandonedCartSnapshot,
): AbandonedCartUpdate[] => {
  if (updates.length === 0) {
    return updates;
  }

  const sorted = updates
    .slice()
    .sort((a, b) => parseTime(getUpdateTimestamp(a)) - parseTime(getUpdateTimestamp(b)));

  const hasStatus = (status: string) =>
    sorted.some(
      (update) => normalizeStatusToken(update.status ?? update.snapshot.status) === status,
    );

  const hasStatusMeetingThreshold = (status: string, threshold: number) =>
    sorted.some((update) => {
      if (normalizeStatusToken(update.status ?? update.snapshot.status) !== status) {
        return false;
      }

      const time = parseTime(getUpdateTimestamp(update));
      return time >= threshold;
    });

  const creationTimestamp =
    baseSnapshot.created_at ?? getUpdateTimestamp(sorted[0]) ?? baseSnapshot.updated_at ?? null;

  const creationSnapshot = sorted[0]?.snapshot ?? baseSnapshot;

  if (creationTimestamp) {
    const creationStatus = normalizeStatusToken('new');
    if (creationStatus && !hasStatus(creationStatus)) {
      sorted.push(
        createSyntheticUpdate(baseSnapshot, 'new', creationTimestamp, {
          paid: false,
          paid_at: null,
          last_event: STATUS_EVENT_MESSAGES.new,
        },
        { snapshotSource: creationSnapshot },
        ),
      );
    }

    const creationTime = parseTime(creationTimestamp);
    if (creationTime !== Number.NEGATIVE_INFINITY) {
      for (let index = 0; index < sorted.length; index += 1) {
        const update = sorted[index];
        const status = normalizeStatusToken(update.status ?? update.snapshot.status);
        if (status !== 'abandoned') {
          continue;
        }

        const updateTime = parseTime(getUpdateTimestamp(update));
        if (updateTime <= creationTime) {
          const abandonedAt = new Date(creationTime + ONE_HOUR_IN_MS).toISOString();
          sorted[index] = createSyntheticUpdate(
            baseSnapshot,
            'abandoned',
            abandonedAt,
            {
              paid: false,
              paid_at: baseSnapshot.paid_at,
              last_event: STATUS_EVENT_MESSAGES.abandoned,
            },
            { snapshotSource: update.snapshot },
          );
        }
      }
    }
  }

  if (baseSnapshot.paid_at) {
    const approvedStatus = normalizeStatusToken('approved');
    if (approvedStatus) {
      const approvedIndex = sorted.findIndex(
        (update) => normalizeStatusToken(update.status ?? update.snapshot.status) === approvedStatus,
      );

      if (approvedIndex >= 0) {
        const existing = sorted[approvedIndex];
        const timestamp = baseSnapshot.paid_at;
        const snapshot = cloneSnapshot(existing.snapshot, {
          status: approvedStatus,
          updated_at: timestamp,
          paid: true,
          paid_at: baseSnapshot.paid_at,
          last_event: STATUS_EVENT_MESSAGES.approved,
        });

        sorted[approvedIndex] = {
          ...existing,
          status: approvedStatus,
          timestamp,
          event: STATUS_EVENT_MESSAGES.approved,
          snapshot,
        } satisfies AbandonedCartUpdate;
      } else {
        sorted.push(
          createSyntheticUpdate(
            baseSnapshot,
            'approved',
            baseSnapshot.paid_at,
            {
              paid: true,
              paid_at: baseSnapshot.paid_at,
              last_event: STATUS_EVENT_MESSAGES.approved,
            },
          ),
        );
      }
    }
  }

  const finalStatus = normalizeStatusToken(baseSnapshot.status);

  if (finalStatus) {
    let shouldAddFinalStatus = !hasStatus(finalStatus);
    let timestamp = baseSnapshot.updated_at ?? baseSnapshot.paid_at ?? creationTimestamp;

    if (finalStatus === 'abandoned') {
      const createdTime = parseTime(creationTimestamp);
      const abandonedThreshold =
        createdTime !== Number.NEGATIVE_INFINITY ? createdTime + ONE_HOUR_IN_MS : Number.NEGATIVE_INFINITY;

      const hasAfterThreshold =
        abandonedThreshold === Number.NEGATIVE_INFINITY
          ? hasStatus(finalStatus)
          : hasStatusMeetingThreshold(finalStatus, abandonedThreshold);

      shouldAddFinalStatus = !hasAfterThreshold;

      if (abandonedThreshold !== Number.NEGATIVE_INFINITY) {
        timestamp = new Date(abandonedThreshold).toISOString();
        if (shouldAddFinalStatus) {
          for (let index = sorted.length - 1; index >= 0; index -= 1) {
            const update = sorted[index];
            if (normalizeStatusToken(update.status ?? update.snapshot.status) !== finalStatus) {
              continue;
            }
            const time = parseTime(getUpdateTimestamp(update));
            if (time < abandonedThreshold) {
              sorted.splice(index, 1);
            }
          }
        }
      }
    }

    if (shouldAddFinalStatus && timestamp) {
      const overrides: Partial<AbandonedCartSnapshot> = {};
      if (finalStatus === 'abandoned' || finalStatus === 'pending' || finalStatus === 'refused') {
        overrides.paid = false;
      }
      if (finalStatus === 'refunded') {
        overrides.paid = false;
        overrides.paid_at = baseSnapshot.paid_at;
      }

      const finalSnapshotSource =
        sorted
          .slice()
          .reverse()
          .find(
            (update) => normalizeStatusToken(update.status ?? update.snapshot.status) === finalStatus,
          )?.snapshot ?? baseSnapshot;

      sorted.push(
        createSyntheticUpdate(
          baseSnapshot,
          finalStatus,
          timestamp,
          {
            ...overrides,
            last_event: STATUS_EVENT_MESSAGES[finalStatus] ?? baseSnapshot.last_event ?? null,
          },
          { snapshotSource: finalSnapshotSource },
        ),
      );
    }
  }

  const enriched = Array.from(
    new Map(
      sorted
        .map((update) => {
          const time = parseTime(getUpdateTimestamp(update));
          return [`${normalizeStatusToken(update.status ?? update.snapshot.status)}:${time}`, update] as const;
        })
        .reverse(),
    ).values(),
  );

  return enriched
    .sort((a, b) => parseTime(getUpdateTimestamp(a)) - parseTime(getUpdateTimestamp(b)))
    .map((update) => ({ ...update, snapshot: cloneSnapshot(update.snapshot) }));
};

const extractCheckoutUrl = (row: Record<string, any>, payload: Record<string, unknown>) => {
  const candidates = [row.checkout_url, row.checkoutUrl, payload.checkout_url, payload.checkoutUrl];

  for (const candidate of candidates) {
    const text = cleanText(candidate);
    if (text) {
      return text;
    }
  }

  return null;
};

const extractPaidAt = (row: Record<string, any>, payload: Record<string, unknown>) => {
  const candidates = [
    row.paid_at,
    payload.paid_at,
    payload.paidAt,
    payload.payment_date,
    payload.paymentDate,
    payload.approved_at,
    payload.approvedAt,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const text = cleanText(candidate);
    if (text) {
      return text;
    }
  }

  return row.paid_at ?? null;
};

const extractPhone = (row: Record<string, any>, payload: Record<string, unknown>) => {
  const candidates = [
    row.customer_phone,
    row.phone,
    row.customer_phone_number,
    payload.customer_phone,
    payload.customerPhone,
    payload.phone,
    payload.phone_number,
  ];

  for (const candidate of candidates) {
    const text = cleanText(candidate);
    if (text) {
      return text;
    }
  }

  return null;
};

const buildCartKey = (cart: AbandonedCartSnapshot) => {
  const checkoutId = cart.checkout_id?.trim();
  if (checkoutId) {
    return `checkout:${checkoutId}`;
  }

  const id = cart.id?.trim();
  if (id) {
    return `id:${id}`;
  }

  const email = cart.customer_email?.toLowerCase();
  if (email) {
    return `email:${email}`;
  }

  const phone = cart.customer_phone?.replace(/\D+/g, '');
  if (phone) {
    return `phone:${phone}`;
  }

  return `id:${cart.id}`;
};

const pickTimestamp = (...candidates: Array<unknown>) => {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const text = cleanText(candidate);
    if (text) {
      return text;
    }
  }

  return null;
};

const DEFAULT_HISTORY_LIMIT = 1000;

const resolveHistoryLimit = () => {
  const rawValue = process.env.ABANDONED_CARTS_HISTORY_LIMIT;
  if (!rawValue) {
    return DEFAULT_HISTORY_LIMIT;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_HISTORY_LIMIT;
  }

  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : DEFAULT_HISTORY_LIMIT;
};

const buildCustomerKey = (snapshot: AbandonedCartSnapshot) => {
  const email = snapshot.customer_email?.trim().toLowerCase();
  if (email) {
    return `email:${email}`;
  }

  const phone = snapshot.customer_phone?.replace(/\D+/g, '');
  if (phone) {
    return `phone:${phone}`;
  }

  const name = snapshot.customer_name?.trim().toLowerCase();
  if (name) {
    return `name:${name}`;
  }

  return `id:${snapshot.id}`;
};

const buildSnapshotFromRow = (row: Record<string, any>): AbandonedCartSnapshot => {
  const payload = (row?.payload ?? {}) as Record<string, any>;
  const productFromPayload = cleanText(payload.product_name) || cleanText(payload.offer_name) || '';
  const discountFromPayload = cleanText(payload.coupon);
  const tableNormalizedStatuses = [
    normalizeStatusToken(row.status),
    normalizeStatusToken(row.last_event),
  ].filter(Boolean);
  const payloadNormalizedStatuses = [
    normalizeStatusToken(payload.status),
    normalizeStatusToken(payload.order_status),
    normalizeStatusToken(payload.orderStatus),
    normalizeStatusToken(payload.payment_status),
    normalizeStatusToken(payload.paymentStatus),
  ].filter(Boolean);
  const normalizedStatuses = [...tableNormalizedStatuses, ...payloadNormalizedStatuses];

  const paidFromPayloadTokens = [
    payload.paid,
    payload.is_paid,
    payload.isPaid,
    payload.payment_paid,
    payload.paymentPaid,
    payload.was_paid,
    payload.wasPaid,
  ];
  const paidFromPayload = paidFromPayloadTokens.some((token) => coerceBoolean(token));
  const basePaid = coerceBoolean(row.paid) || paidFromPayload;
  const createdAt =
    pickTimestamp(row.created_at, payload.created_at, payload.createdAt) ?? row.created_at ?? null;
  const updatedAt =
    pickTimestamp(row.updated_at, payload.updated_at, payload.updatedAt) ?? row.updated_at ?? null;
  const status = resolveStatus({
    normalizedStatuses,
    paid: basePaid,
    createdAt,
  });
  const paid = status === 'refunded' ? false : basePaid;
  const checkoutUrl = extractCheckoutUrl(row, payload);
  const checkoutId = typeof row.checkout_id === 'string' ? cleanText(row.checkout_id) : null;
  const customerPhone = extractPhone(row, payload);
  const paidAt = extractPaidAt(row, payload);

  return {
    id: String(row.id),
    checkout_id: checkoutId,
    customer_email: cleanText(row.customer_email) || cleanText(row.email) || '',
    customer_name: cleanText(row.customer_name) || null,
    customer_phone: customerPhone,
    product_name: cleanText(row.product_name) || cleanText(row.product_title) || productFromPayload || null,
    product_id: row.product_id ?? null,
    status,
    paid,
    paid_at: paidAt ?? null,
    discount_code: cleanText(row.discount_code) || discountFromPayload || null,
    expires_at: row.expires_at ?? row.schedule_at ?? null,
    last_event: row.last_event ?? null,
    created_at: createdAt,
    updated_at: updatedAt,
    checkout_url: checkoutUrl,
    traffic_source: cleanText(row.traffic_source) || cleanText(payload.traffic_source) || null,
  } satisfies AbandonedCartSnapshot;
};

const buildUpdateFromRow = (row: Record<string, any>): AbandonedCartUpdate => {
  const snapshot = buildSnapshotFromRow(row);
  const timestamp = snapshot.updated_at ?? snapshot.created_at ?? null;
  const source = cleanText(row.source) || null;

  return {
    id: String(row.id),
    timestamp,
    status: snapshot.status,
    event: snapshot.last_event ?? null,
    source,
    snapshot,
  } satisfies AbandonedCartUpdate;
};

export const resolveStatus = ({
  normalizedStatuses,
  paid,
  createdAt,
}: {
  normalizedStatuses: string[];
  paid: boolean;
  createdAt: string | null;
}) => {
  if (normalizedStatuses.some((status) => REFUSED_STATUS_TOKENS.has(status))) {
    return 'refused';
  }

  if (normalizedStatuses.some((status) => REFUNDED_STATUS_TOKENS.has(status))) {
    return 'refunded';
  }

  if (paid || normalizedStatuses.some((status) => APPROVED_STATUS_TOKENS.has(status))) {
    return 'approved';
  }

  const hasAbandonedStatus = normalizedStatuses.some((status) => ABANDONED_STATUS_TOKENS.has(status));
  if (hasAbandonedStatus) {
    return 'abandoned';
  }

  const createdTime = parseTime(createdAt);
  if (createdTime !== Number.NEGATIVE_INFINITY) {
    const now = Date.now();
    if (now - createdTime >= ONE_HOUR_IN_MS) {
      return 'abandoned';
    }
  }

  if (normalizedStatuses.some((status) => PENDING_STATUS_TOKENS.has(status))) {
    return 'pending';
  }

  if (normalizedStatuses.some((status) => NEW_STATUS_TOKENS.has(status))) {
    return 'new';
  }

  return 'new';
};

export async function fetchAbandonedCarts(): Promise<AbandonedCart[]> {
  noStore();

  try {
    const supabase = getSupabaseAdmin();

    const historyLimit = resolveHistoryLimit();

    const { data, error } = await supabase
      .from('abandoned_emails')
      .select('*')
      .neq('source', 'kiwify.webhook_purchase')
      .order('updated_at', { ascending: false })
      .limit(historyLimit);

    if (error) {
      console.error('[kiwify-hub] erro ao consultar carrinhos', error);
      return [];
    }

    const rows = (data ?? []) as Record<string, any>[];

    const grouped = new Map<
      string,
      { snapshot: AbandonedCartSnapshot; updates: AbandonedCartUpdate[]; customerKey: string }
    >();
    const historyByCustomer = new Map<
      string,
      Map<string, { snapshot: AbandonedCartSnapshot; updates: AbandonedCartUpdate[] }>
    >();

    rows.forEach((row) => {
      const update = buildUpdateFromRow(row);
      const key = buildCartKey(update.snapshot);
      const customerKey = buildCustomerKey(update.snapshot);
      const timestamp = parseTime(
        update.timestamp ?? update.snapshot.updated_at ?? update.snapshot.created_at,
      );
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, { snapshot: update.snapshot, updates: [update], customerKey });
      } else {
        existing.updates.push(update);

        const existingTime = parseTime(
          existing.snapshot.updated_at ?? existing.snapshot.created_at ?? null,
        );

        if (timestamp >= existingTime) {
          existing.snapshot = update.snapshot;
        }
      }

      let customerHistory = historyByCustomer.get(customerKey);
      if (!customerHistory) {
        customerHistory = new Map();
        historyByCustomer.set(customerKey, customerHistory);
      }

      const existingHistory = customerHistory.get(key);

      if (!existingHistory) {
        customerHistory.set(key, { snapshot: update.snapshot, updates: [update] });
      } else {
        existingHistory.updates.push(update);

        const existingHistoryTime = parseTime(
          existingHistory.snapshot.updated_at ?? existingHistory.snapshot.created_at ?? null,
        );

        if (timestamp >= existingHistoryTime) {
          existingHistory.snapshot = update.snapshot;
        }
      }
    });

    const normalizedHistory = new Map<string, AbandonedCartHistoryEntry[]>();

    historyByCustomer.forEach((cartHistory, customerKey) => {
      const entries: AbandonedCartHistoryEntry[] = Array.from(cartHistory.entries()).map(
        ([cartKey, { snapshot, updates }]) => {
          const sortedUpdates = updates
            .slice()
            .sort((a, b) => {
              const timeA = parseTime(a.timestamp ?? a.snapshot.updated_at ?? a.snapshot.created_at);
              const timeB = parseTime(b.timestamp ?? b.snapshot.updated_at ?? b.snapshot.created_at);

              if (timeA !== timeB) {
                return timeA - timeB;
              }

              return a.id.localeCompare(b.id);
            });

          const enrichedUpdates = enrichUpdatesWithMilestones(sortedUpdates, snapshot);

          return {
            cartKey,
            snapshot,
            updates: enrichedUpdates,
          } satisfies AbandonedCartHistoryEntry;
        },
      );

      entries.sort((a, b) => {
        const lastUpdateA = a.updates[a.updates.length - 1];
        const lastUpdateB = b.updates[b.updates.length - 1];
        const timeA = parseTime(
          lastUpdateA?.timestamp ?? lastUpdateA?.snapshot.updated_at ?? lastUpdateA?.snapshot.created_at,
        );
        const timeB = parseTime(
          lastUpdateB?.timestamp ?? lastUpdateB?.snapshot.updated_at ?? lastUpdateB?.snapshot.created_at,
        );

        if (timeA !== timeB) {
          return timeB - timeA;
        }

        return a.snapshot.id.localeCompare(b.snapshot.id);
      });

      normalizedHistory.set(customerKey, entries);
    });

    return Array.from(grouped.entries()).map(([cartKey, { snapshot, updates, customerKey }]) => {
      const sortedUpdates = updates
        .slice()
        .sort((a, b) => {
          const timeA = parseTime(a.timestamp ?? a.snapshot.updated_at ?? a.snapshot.created_at);
          const timeB = parseTime(b.timestamp ?? b.snapshot.updated_at ?? b.snapshot.created_at);

          if (timeA !== timeB) {
            return timeA - timeB;
          }

          return a.id.localeCompare(b.id);
        });

      const enrichedUpdates = enrichUpdatesWithMilestones(sortedUpdates, snapshot);

      const historyEntries = normalizedHistory.get(customerKey) ?? [];

      return {
        ...snapshot,
        cart_key: cartKey,
        updates: enrichedUpdates,
        history: historyEntries.map((entry) => ({
          cartKey: entry.cartKey,
          snapshot: entry.snapshot,
          updates: entry.cartKey === cartKey ? enrichedUpdates : entry.updates,
        })),
      } satisfies AbandonedCart;
    });
  } catch (error) {
    console.error('[kiwify-hub] supabase indisponível', error);
    return [];
  }
}

export const __testables = {
  enrichUpdatesWithMilestones,
};
