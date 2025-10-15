import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from './supabaseAdmin';
import type {
  AbandonedCart,
  AbandonedCartHistoryEntry,
  AbandonedCartSnapshot,
  AbandonedCartUpdate,
  DashboardSale,
  DashboardSaleStatus,
  GroupedDashboardEvent,
  GroupedDashboardEventSource,
  Sale,
  CustomerCheckoutAggregate,
} from './types';
import { fetchAbandonedCarts } from './abandonedCarts';
import {
  APPROVED_STATUS_TOKENS,
  ABANDONED_STATUS_TOKENS,
  PENDING_STATUS_TOKENS,
  REFUNDED_STATUS_TOKENS,
  REFUSED_STATUS_TOKENS,
  NEW_STATUS_TOKENS,
  cleanText,
  coerceBoolean,
  normalizeStatusToken,
} from './normalization';

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

const resolveSaleId = (row: Record<string, any>) => {
  const checkoutIdCandidates = [row.checkout_id, row.checkoutId];

  for (const candidate of checkoutIdCandidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    } else if (candidate !== null && candidate !== undefined) {
      const value = String(candidate).trim();
      if (value) {
        return value;
      }
    }
  }

  const rawId = row.id;

  if (typeof rawId === 'string') {
    const trimmed = rawId.trim();
    return trimmed || rawId;
  }

  if (rawId === null || rawId === undefined) {
    return '';
  }

  return String(rawId);
};

const parseTime = (value: string | null | undefined) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
};

const resolveLatestTimestamp = (sale: DashboardSale) => {
  const candidates: Array<{
    value: string | null;
    source: GroupedDashboardEventSource;
  }> = [
    { value: sale.updated_at, source: 'updated_at' },
    { value: sale.paid_at, source: 'paid_at' },
    { value: sale.created_at, source: 'created_at' },
  ];

  let latestValue: string | null = null;
  let latestSource: GroupedDashboardEventSource = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const time = parseTime(candidate.value);
    if (time > latestTime) {
      latestTime = time;
      latestValue = candidate.value ?? null;
      latestSource = candidate.source;
    }
  }

  return {
    latestTimestamp: latestValue,
    latestSource,
    latestTime,
  };
};

const ONE_HOUR_IN_MS = 60 * 60 * 1000;

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

type ResolveStatusParams = {
  normalizedStatuses: string[];
  paid: boolean;
  createdAt: string | null;
};

const resolveDashboardStatus = ({
  normalizedStatuses,
  paid,
  createdAt,
}: ResolveStatusParams): DashboardSaleStatus => {
  if (normalizedStatuses.some((status) => REFUNDED_STATUS_TOKENS.has(status))) {
    return 'refunded';
  }

  if (normalizedStatuses.some((status) => REFUSED_STATUS_TOKENS.has(status))) {
    return 'refused';
  }

  if (paid) {
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

  const hasFreshToken = normalizedStatuses.some(
    (status) => NEW_STATUS_TOKENS.has(status) || PENDING_STATUS_TOKENS.has(status),
  );

  if (hasFreshToken) {
    return 'new';
  }

  return 'new';
};

const mapRowToDashboardSale = (row: Record<string, any>): DashboardSale => {
  const payload = (row?.payload ?? {}) as Record<string, any>;
  const productFromPayload = cleanText(payload.product_name) || cleanText(payload.offer_name) || null;
  const trafficFromPayload = cleanText(payload.traffic_source);
  const checkoutUrl = extractCheckoutUrl(row, payload);
  const id = resolveSaleId(row);

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
  const paid =
    coerceBoolean(row.paid) ||
    paidFromPayload ||
    normalizedStatuses.some((status) => APPROVED_STATUS_TOKENS.has(status));

  const paidAt = extractPaidAt(row, payload);
  const customerPhone = extractPhone(row, payload);

  const createdAt =
    pickTimestamp(row.created_at, payload.created_at, payload.createdAt) ?? row.created_at ?? null;
  const updatedAt =
    pickTimestamp(row.updated_at, payload.updated_at, payload.updatedAt) ?? row.updated_at ?? null;
  const status = resolveDashboardStatus({
    normalizedStatuses,
    paid,
    createdAt,
  });

  return {
    id,
    customer_email: cleanText(row.customer_email) || cleanText(row.email) || '',
    customer_name: cleanText(row.customer_name) || null,
    customer_phone: customerPhone,
    product_name: cleanText(row.product_name) || cleanText(row.product_title) || productFromPayload,
    product_id: cleanText(row.product_id) || null,
    status,
    created_at: createdAt,
    updated_at: updatedAt,
    paid_at: paidAt ?? null,
    last_event: cleanText(row.last_event) || null,
    traffic_source: cleanText(row.traffic_source) || trafficFromPayload || null,
    source: cleanText(row.source) || null,
    checkout_url: checkoutUrl,
  } satisfies DashboardSale;
};

const buildSaleKey = (sale: Sale) => {
  const id = sale.id?.trim();
  if (id) {
    return `id:${id}`;
  }

  const email = sale.customer_email?.toLowerCase();
  if (email) {
    return `email:${email}`;
  }

  const phone = sale.customer_phone?.replace(/\D+/g, '');
  if (phone) {
    return `phone:${phone}`;
  }

  return `id:${sale.id}`;
};

const fetchSalesRows = async (): Promise<Record<string, any>[]> => {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('abandoned_emails')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Record<string, any>[];
};

export async function fetchDashboardSales(): Promise<DashboardSale[]> {
  noStore();

  try {
    const rows = await fetchSalesRows();
    return rows.map(mapRowToDashboardSale);
  } catch (error) {
    console.error('[kiwify-hub] supabase indisponível ao buscar dados do dashboard', error);
    return [];
  }
}

const buildEventKey = (sale: DashboardSale) => {
  const email = sale.customer_email?.toLowerCase() ?? '';
  const productKey = sale.product_id?.toLowerCase() || sale.product_name?.toLowerCase() || sale.id;
  return `${email}::${productKey}`;
};

type GroupLatestDashboardEventsParams = {
  sales?: DashboardSale[];
};

export async function groupLatestDashboardEvents(
  { sales: providedSales }: GroupLatestDashboardEventsParams = {},
): Promise<GroupedDashboardEvent[]> {
  const sales = providedSales ?? (await fetchDashboardSales());
  const deduped = new Map<string, GroupedDashboardEvent>();

  for (const sale of sales) {
    const key = buildEventKey(sale);
    const current = deduped.get(key);
    const { latestTimestamp, latestSource, latestTime } = resolveLatestTimestamp(sale);

    const enrichedSale: GroupedDashboardEvent = {
      ...sale,
      latest_timestamp: latestTimestamp,
      latest_timestamp_source: latestSource,
    };

    if (!current) {
      deduped.set(key, enrichedSale);
      continue;
    }

    const currentTime = parseTime(current.latest_timestamp);

    if (latestTime >= currentTime) {
      deduped.set(key, enrichedSale);
    }
  }

  return Array.from(deduped.values()).sort(
    (a, b) => parseTime(b.latest_timestamp) - parseTime(a.latest_timestamp),
  );
}

export async function fetchApprovedSales(): Promise<Sale[]> {
  noStore();

  try {
    const rows = await fetchSalesRows();

    const mappedRows = rows
      .map((row) => {
        const { checkout_url } = mapRowToDashboardSale(row);
        const saleId = resolveSaleId(row);
        const payload = (row?.payload ?? {}) as Record<string, unknown>;
        const productFromPayload = cleanText(payload.product_name) || cleanText(payload.offer_name);
        const trafficFromPayload = cleanText(payload.traffic_source);
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
        const normalizedStatuses = [
          normalizeStatusToken(row.status),
          normalizeStatusToken(payload.status),
          normalizeStatusToken(payload.order_status),
          normalizeStatusToken(payload.orderStatus),
          normalizeStatusToken(payload.payment_status),
          normalizeStatusToken(payload.paymentStatus),
          normalizeStatusToken(row.last_event),
        ].filter(Boolean);

        const paid = coerceBoolean(row.paid) || paidFromPayload;
        const hasRefund = normalizedStatuses.some((status) => REFUNDED_STATUS_TOKENS.has(status));
        const hasApproval = paid || normalizedStatuses.some((status) => APPROVED_STATUS_TOKENS.has(status));

        if (!hasRefund && !hasApproval) {
          return null;
        }

        const status: Sale['status'] = hasRefund ? 'refunded' : 'approved';
        const paidAt = extractPaidAt(row, payload);
        const customerPhone = extractPhone(row, payload);
        const createdAt =
          pickTimestamp(row.created_at, payload.created_at, payload.createdAt) ?? row.created_at ?? null;
        const updatedAt =
          pickTimestamp(row.updated_at, payload.updated_at, payload.updatedAt) ?? row.updated_at ?? null;
        const hasAbandonedStatus = normalizedStatuses.some((status) => ABANDONED_STATUS_TOKENS.has(status));
        const createdTime = parseTime(createdAt);
        const paidTime = parseTime(paidAt);
        const hasValidTimeline =
          Number.isFinite(createdTime) && Number.isFinite(paidTime) && paidTime > createdTime;
        const abandonmentDelay = hasValidTimeline ? paidTime - createdTime : null;
        const abandonedBeforePayment =
          hasAbandonedStatus || (typeof abandonmentDelay === 'number' && abandonmentDelay >= ONE_HOUR_IN_MS);

        return {
          id: saleId,
          customer_email: cleanText(row.customer_email) || cleanText(row.email) || '',
          customer_name: cleanText(row.customer_name) || null,
          customer_phone: customerPhone,
          product_name:
            cleanText(row.product_name) || cleanText(row.product_title) || productFromPayload || null,
          product_id: cleanText(row.product_id) || null,
          status,
          created_at: createdAt,
          updated_at: updatedAt,
          paid_at: paidAt ?? null,
          traffic_source: cleanText(row.traffic_source) || trafficFromPayload || null,
          source: cleanText(row.source) || null,
          abandoned_before_payment: abandonedBeforePayment,
          checkout_url,
        } satisfies Sale;
      })
      .filter((sale): sale is Sale => sale !== null);

    const deduped = new Map<string, Sale>();

    for (const sale of mappedRows) {
      const key = buildSaleKey(sale);
      const existing = deduped.get(key);

      if (!existing) {
        deduped.set(key, sale);
        continue;
      }

      const currentTime = sale.paid_at ? Date.parse(sale.paid_at) : Number.NEGATIVE_INFINITY;
      const existingTime = existing.paid_at ? Date.parse(existing.paid_at) : Number.NEGATIVE_INFINITY;

      if (currentTime >= existingTime) {
        deduped.set(key, sale);
      }
    }

    return Array.from(deduped.values()).sort((a, b) => parseTime(b.paid_at) - parseTime(a.paid_at));
  } catch (error) {
    console.error('[kiwify-hub] supabase indisponível ao buscar vendas aprovadas', error);
    return [];
  }
}

const getHistoryEntryLatestTime = (entry: AbandonedCartHistoryEntry) => {
  const updates = entry?.updates ?? [];
  const latestUpdate = updates[updates.length - 1];
  const candidates = [
    latestUpdate?.timestamp,
    latestUpdate?.snapshot.updated_at,
    latestUpdate?.snapshot.created_at,
    entry?.snapshot.updated_at,
    entry?.snapshot.created_at,
  ];

  let latest = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const time = parseTime(candidate ?? null);
    if (time > latest) {
      latest = time;
    }
  }

  return latest;
};

const getAggregateLatestTime = (aggregate: CustomerCheckoutAggregate) => {
  const latestSaleTime = aggregate.approvedSales.reduce((acc, sale) => {
    const time = parseTime(sale.paid_at);
    return time > acc ? time : acc;
  }, Number.NEGATIVE_INFINITY);

  const latestHistoryTime = aggregate.history.reduce((acc, entry) => {
    const time = getHistoryEntryLatestTime(entry);
    return time > acc ? time : acc;
  }, Number.NEGATIVE_INFINITY);

  return Math.max(latestSaleTime, latestHistoryTime);
};

const normalizeEmailKey = (value: string | null | undefined) => {
  const email = cleanText(value);
  return email ? email.toLowerCase() : null;
};

type AggregateAccumulator = {
  email: string;
  name: string | null;
  phone: string | null;
  approvedSales: Sale[];
  historyByCartKey: Map<string, AbandonedCartHistoryEntry>;
};

const ensureAggregateRecord = (
  aggregates: Map<string, AggregateAccumulator>,
  key: string,
  email: string,
) => {
  let record = aggregates.get(key);

  if (!record) {
    record = {
      email,
      name: null,
      phone: null,
      approvedSales: [],
      historyByCartKey: new Map(),
    } satisfies AggregateAccumulator;
    aggregates.set(key, record);
    return record;
  }

  if (email && (!record.email || record.email === key)) {
    record.email = email;
  }

  return record;
};

const createHistoryEntryFromSale = (sale: Sale): AbandonedCartHistoryEntry => {
  const canonicalId = sale.id.trim() || sale.id;
  const createdAt = sale.created_at ?? sale.paid_at ?? sale.updated_at ?? null;
  const updatedAt = sale.updated_at ?? sale.paid_at ?? sale.created_at ?? null;

  const baseSnapshot: AbandonedCartSnapshot = {
    id: canonicalId,
    checkout_id: canonicalId,
    customer_email: sale.customer_email,
    customer_name: sale.customer_name,
    customer_phone: sale.customer_phone,
    product_name: sale.product_name,
    product_id: sale.product_id,
    status: sale.status,
    paid: sale.status === 'approved',
    paid_at: sale.paid_at,
    discount_code: null,
    expires_at: null,
    last_event: sale.status === 'approved' ? 'Pagamento aprovado' : 'Pedido reembolsado',
    created_at: createdAt,
    updated_at: updatedAt,
    checkout_url: sale.checkout_url,
    traffic_source: sale.traffic_source,
  };

  const updates: AbandonedCartUpdate[] = [];

  if (createdAt) {
    updates.push({
      id: `sale:${canonicalId}:new`,
      timestamp: createdAt,
      status: 'new',
      event: 'Checkout criado',
      source: 'sale',
      snapshot: {
        ...baseSnapshot,
        status: 'new',
        paid: false,
        paid_at: null,
        updated_at: createdAt,
        last_event: 'Checkout criado',
      },
    });
  }

  if (sale.paid_at) {
    updates.push({
      id: `sale:${canonicalId}:approved`,
      timestamp: sale.paid_at,
      status: 'approved',
      event: 'Pagamento aprovado',
      source: 'sale',
      snapshot: {
        ...baseSnapshot,
        status: 'approved',
        paid: true,
        paid_at: sale.paid_at,
        updated_at: sale.paid_at,
        last_event: 'Pagamento aprovado',
      },
    });
  }

  if (sale.status === 'refunded') {
    const refundedAt = sale.updated_at ?? sale.paid_at ?? createdAt;
    if (refundedAt) {
      updates.push({
        id: `sale:${canonicalId}:refunded`,
        timestamp: refundedAt,
        status: 'refunded',
        event: 'Pedido reembolsado',
        source: 'sale',
        snapshot: {
          ...baseSnapshot,
          status: 'refunded',
          paid: false,
          paid_at: sale.paid_at,
          updated_at: refundedAt,
          last_event: 'Pedido reembolsado',
        },
      });
    }
  }

  if (updates.length === 0) {
    updates.push({
      id: `sale:${canonicalId}`,
      timestamp: updatedAt,
      status: sale.status,
      event: baseSnapshot.last_event,
      source: 'sale',
      snapshot: baseSnapshot,
    });
  }

  updates.sort((a, b) => parseTime(a.timestamp) - parseTime(b.timestamp));

  return {
    cartKey: `sale:${canonicalId}`,
    snapshot: baseSnapshot,
    updates,
  };
};

export function buildCustomersWithCheckouts({
  sales,
  carts,
}: {
  sales: Sale[];
  carts: AbandonedCart[];
}): CustomerCheckoutAggregate[] {
  const aggregates = new Map<string, AggregateAccumulator>();

  const approvedSales = sales.filter((sale) => sale.status === 'approved');

  for (const sale of approvedSales) {
    const key = normalizeEmailKey(sale.customer_email);
    if (!key) {
      continue;
    }

    const displayEmail = cleanText(sale.customer_email) || sale.customer_email || key;
    const record = ensureAggregateRecord(aggregates, key, displayEmail);

    if (!record.name && sale.customer_name) {
      record.name = sale.customer_name;
    }

    if (!record.phone && sale.customer_phone) {
      record.phone = sale.customer_phone;
    }

    record.approvedSales.push(sale);
  }

  for (const cart of carts) {
    const key = normalizeEmailKey(cart.customer_email);
    if (!key) {
      continue;
    }

    const displayEmail = cleanText(cart.customer_email) || cart.customer_email || key;
    const record = ensureAggregateRecord(aggregates, key, displayEmail);

    if (!record.name && cart.customer_name) {
      record.name = cart.customer_name;
    }

    if (!record.phone && cart.customer_phone) {
      record.phone = cart.customer_phone;
    }

    const historyEntries = cart.history ?? [];

    for (const entry of historyEntries) {
      if (!entry?.cartKey) {
        continue;
      }

      const existing = record.historyByCartKey.get(entry.cartKey);

      if (!existing) {
        record.historyByCartKey.set(entry.cartKey, entry);
        continue;
      }

      const existingTime = getHistoryEntryLatestTime(existing);
      const candidateTime = getHistoryEntryLatestTime(entry);

      if (candidateTime >= existingTime) {
        record.historyByCartKey.set(entry.cartKey, entry);
      }
    }
  }

  aggregates.forEach((record) => {
    const existingEntries = Array.from(record.historyByCartKey.values());

    for (const sale of record.approvedSales) {
      if (!sale.id) {
        continue;
      }

      const hasMatchingHistory = existingEntries.some((entry) => {
        const snapshot = entry.snapshot;
        const snapshotId = snapshot.checkout_id ?? snapshot.id;
        if (!snapshotId) {
          return false;
        }

        const normalizedSnapshotId =
          typeof snapshotId === 'string' ? snapshotId.trim() : String(snapshotId).trim();
        const normalizedSaleId = sale.id.trim() || sale.id;

        return normalizedSnapshotId ? normalizedSnapshotId === normalizedSaleId : false;
      });

      if (hasMatchingHistory) {
        continue;
      }

      const syntheticEntry = createHistoryEntryFromSale(sale);
      record.historyByCartKey.set(syntheticEntry.cartKey, syntheticEntry);
      existingEntries.push(syntheticEntry);
    }
  });

  const result: CustomerCheckoutAggregate[] = Array.from(aggregates.values()).map((record) => {
    const sortedSales = record.approvedSales
      .slice()
      .sort((a, b) => parseTime(b.paid_at) - parseTime(a.paid_at));

    const historyEntries = Array.from(record.historyByCartKey.values()).sort((a, b) => {
      const diff = getHistoryEntryLatestTime(b) - getHistoryEntryLatestTime(a);
      if (diff !== 0) {
        return diff;
      }

      return a.cartKey.localeCompare(b.cartKey);
    });

    return {
      email: record.email || '',
      name: record.name ?? null,
      phone: record.phone ?? null,
      approvedSales: sortedSales,
      history: historyEntries,
    } satisfies CustomerCheckoutAggregate;
  });

  result.sort((a, b) => {
    const diff = getAggregateLatestTime(b) - getAggregateLatestTime(a);
    if (diff !== 0) {
      return diff;
    }

    return a.email.localeCompare(b.email);
  });

  return result;
}

export async function fetchCustomersWithCheckouts(): Promise<CustomerCheckoutAggregate[]> {
  noStore();

  const [sales, carts] = await Promise.all([fetchApprovedSales(), fetchAbandonedCarts()]);

  return buildCustomersWithCheckouts({ sales, carts });
}

export const __testables = {
  mapRowToDashboardSale,
  resolveLatestTimestamp,
  buildCustomersWithCheckouts,
};
