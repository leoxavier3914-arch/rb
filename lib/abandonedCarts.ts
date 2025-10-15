import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from './supabaseAdmin';
import type { AbandonedCart, AbandonedCartSnapshot, AbandonedCartUpdate } from './types';
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

    const { data, error } = await supabase
      .from('abandoned_emails')
      .select('*')
      .neq('source', 'kiwify.webhook_purchase')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[kiwify-hub] erro ao consultar carrinhos', error);
      return [];
    }

    const rows = (data ?? []) as Record<string, any>[];

    const grouped = new Map<string, { snapshot: AbandonedCartSnapshot; updates: AbandonedCartUpdate[] }>();

    rows.forEach((row) => {
      const update = buildUpdateFromRow(row);
      const key = buildCartKey(update.snapshot);
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, { snapshot: update.snapshot, updates: [update] });
        return;
      }

      existing.updates.push(update);

      const currentTime = parseTime(update.timestamp ?? update.snapshot.updated_at ?? update.snapshot.created_at);
      const existingTime = parseTime(existing.snapshot.updated_at ?? existing.snapshot.created_at ?? null);

      if (currentTime >= existingTime) {
        existing.snapshot = update.snapshot;
      }
    });

    return Array.from(grouped.values()).map(({ snapshot, updates }) => ({
      ...snapshot,
      updates: updates
        .slice()
        .sort((a, b) => {
          const timeA = parseTime(a.timestamp ?? a.snapshot.updated_at ?? a.snapshot.created_at);
          const timeB = parseTime(b.timestamp ?? b.snapshot.updated_at ?? b.snapshot.created_at);

          if (timeA !== timeB) {
            return timeA - timeB;
          }

          return a.id.localeCompare(b.id);
        }),
    }));
  } catch (error) {
    console.error('[kiwify-hub] supabase indisponível', error);
    return [];
  }
}
