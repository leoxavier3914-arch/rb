import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from './supabaseAdmin';
import type { AbandonedCart } from './types';
import {
  APPROVED_STATUS_TOKENS,
  PENDING_STATUS_TOKENS,
  REFUNDED_STATUS_TOKENS,
  SENT_STATUS_TOKENS,
  cleanText,
  coerceBoolean,
  normalizeStatusToken,
} from './normalization';

const parseTime = (value: string | null) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const time = Date.parse(value);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
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

const resolveStatus = (normalizedStatuses: string[], paid: boolean) => {
  if (normalizedStatuses.some((status) => REFUNDED_STATUS_TOKENS.has(status))) {
    return 'refunded';
  }

  if (paid || normalizedStatuses.some((status) => APPROVED_STATUS_TOKENS.has(status))) {
    return 'converted';
  }

  if (normalizedStatuses.some((status) => SENT_STATUS_TOKENS.has(status))) {
    return 'sent';
  }

  if (normalizedStatuses.some((status) => PENDING_STATUS_TOKENS.has(status))) {
    return 'pending';
  }

  return 'pending';
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
        const status = resolveStatus(normalizedStatuses, basePaid);
        const paid = status === 'refunded' ? false : basePaid;
        const checkoutUrl = extractCheckoutUrl(row, payload);
        const customerPhone = extractPhone(row, payload);

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
          paid_at: row.paid_at ?? null,
          discount_code: cleanText(row.discount_code) || discountFromPayload || null,
          expires_at: row.expires_at ?? row.schedule_at ?? null,
          last_event: row.last_event ?? null,
          last_reminder_at: row.sent_at ?? row.last_reminder_at ?? null,
          created_at: row.created_at ?? null,
          updated_at: row.updated_at ?? null,
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
