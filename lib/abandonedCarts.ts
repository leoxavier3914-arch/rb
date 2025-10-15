import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from './supabaseAdmin';
import type { AbandonedCart } from './types';
import {
  APPROVED_STATUS_TOKENS,
  ABANDONED_STATUS_TOKENS,
  NEW_STATUS_TOKENS,
  PENDING_STATUS_TOKENS,
  REFUNDED_STATUS_TOKENS,
  SENT_STATUS_TOKENS,
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

const buildCartKey = (cart: AbandonedCart) => {
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

const resolveStatus = ({
  normalizedStatuses,
  paid,
  createdAt,
  lastReminderAt,
}: {
  normalizedStatuses: string[];
  paid: boolean;
  createdAt: string | null;
  lastReminderAt: string | null;
}) => {
  if (normalizedStatuses.some((status) => REFUNDED_STATUS_TOKENS.has(status))) {
    return 'refunded';
  }

  if (paid || normalizedStatuses.some((status) => APPROVED_STATUS_TOKENS.has(status))) {
    return 'converted';
  }

  const hasSentStatus =
    normalizedStatuses.some((status) => SENT_STATUS_TOKENS.has(status)) || Boolean(lastReminderAt);

  if (hasSentStatus) {
    return 'sent';
  }

  if (normalizedStatuses.some((status) => NEW_STATUS_TOKENS.has(status))) {
    return 'new';
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

  return createdTime === Number.NEGATIVE_INFINITY ? 'pending' : 'new';
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

    const mapped = rows
      .map((row) => {
        const payload = (row?.payload ?? {}) as Record<string, any>;
        const productFromPayload = cleanText(payload.product_name) || cleanText(payload.offer_name) || '';
        const discountFromPayload = cleanText(payload.coupon);
        const normalizedStatuses = [
          normalizeStatusToken(row.status),
          normalizeStatusToken(row.last_event),
          normalizeStatusToken(payload.status),
          normalizeStatusToken(payload.order_status),
          normalizeStatusToken(payload.orderStatus),
          normalizeStatusToken(payload.payment_status),
          normalizeStatusToken(payload.paymentStatus),
        ].filter(Boolean);

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
        const lastReminderAt =
          pickTimestamp(
            row.sent_at,
            row.last_reminder_at,
            payload.sent_at,
            payload.sentAt,
            payload.manual_sent_at,
            payload.manualSentAt,
            payload.last_reminder_at,
            payload.lastReminderAt,
          ) ?? null;

        const status = resolveStatus({
          normalizedStatuses,
          paid: basePaid,
          createdAt,
          lastReminderAt,
        });
        const paid = status === 'refunded' ? false : basePaid;
        const checkoutUrl = extractCheckoutUrl(row, payload);
        const customerPhone = extractPhone(row, payload);
        const paidAt = extractPaidAt(row, payload);

        return {
          id: String(row.id),
          customer_email: cleanText(row.customer_email) || cleanText(row.email) || '',
          customer_name: cleanText(row.customer_name) || null,
          customer_phone: customerPhone,
          product_name:
            cleanText(row.product_name) || cleanText(row.product_title) || productFromPayload || null,
          product_id: row.product_id ?? null,
          status,
          paid,
          paid_at: paidAt ?? null,
          discount_code: cleanText(row.discount_code) || discountFromPayload || null,
          expires_at: row.expires_at ?? row.schedule_at ?? null,
          last_event: row.last_event ?? null,
          last_reminder_at: lastReminderAt,
          created_at: createdAt,
          updated_at: updatedAt,
          checkout_url: checkoutUrl,
          traffic_source: cleanText(row.traffic_source) || cleanText(payload.traffic_source) || null,
        } satisfies AbandonedCart;
      });

    const deduped = new Map<string, AbandonedCart>();

    for (const cart of mapped) {
      const key = buildCartKey(cart);
      const existing = deduped.get(key);

      if (!existing) {
        deduped.set(key, cart);
        continue;
      }

      const currentTime = parseTime(cart.updated_at ?? cart.created_at ?? null);
      const existingTime = parseTime(existing.updated_at ?? existing.created_at ?? null);

      if (currentTime >= existingTime) {
        deduped.set(key, cart);
      }
    }

    return Array.from(deduped.values());
  } catch (error) {
    console.error('[kiwify-hub] supabase indisponível', error);
    return [];
  }
}
