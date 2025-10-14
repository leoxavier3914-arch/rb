import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from './supabaseAdmin';
import type { DashboardSale, DashboardSaleStatus, Sale } from './types';
import {
  APPROVED_STATUS_TOKENS,
  PENDING_STATUS_TOKENS,
  REFUNDED_STATUS_TOKENS,
  REFUSED_STATUS_TOKENS,
  SENT_STATUS_TOKENS,
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

const parseTime = (value: string | null | undefined) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
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
  paidAt: string | null;
  createdAt: string | null;
  lastReminderAt: string | null;
};

const resolveDashboardStatus = ({
  normalizedStatuses,
  paid,
  paidAt,
  createdAt,
  lastReminderAt,
}: ResolveStatusParams): DashboardSaleStatus => {
  if (normalizedStatuses.some((status) => REFUNDED_STATUS_TOKENS.has(status))) {
    return 'refunded';
  }

  if (normalizedStatuses.some((status) => REFUSED_STATUS_TOKENS.has(status))) {
    return 'refused';
  }

  const hasSentStatus =
    normalizedStatuses.some((status) => SENT_STATUS_TOKENS.has(status)) || Boolean(lastReminderAt);

  const hasPendingStatus = normalizedStatuses.some((status) => PENDING_STATUS_TOKENS.has(status));

  if (paid) {
    if (hasSentStatus) {
      const reminderTime = parseTime(lastReminderAt);
      const paidTime = parseTime(paidAt);

      if (reminderTime !== Number.NEGATIVE_INFINITY && paidTime !== Number.NEGATIVE_INFINITY) {
        if (paidTime >= reminderTime) {
          return 'converted';
        }
      } else {
        return 'converted';
      }
    }

    return 'approved';
  }

  if (hasSentStatus) {
    return 'sent';
  }

  const createdTime = parseTime(createdAt);

  if (createdTime === Number.NEGATIVE_INFINITY) {
    return hasPendingStatus ? 'abandoned' : 'new';
  }

  const now = Date.now();
  return now - createdTime >= ONE_HOUR_IN_MS ? 'abandoned' : 'new';
};

const mapRowToDashboardSale = (row: Record<string, any>): DashboardSale => {
  const payload = (row?.payload ?? {}) as Record<string, any>;
  const productFromPayload = cleanText(payload.product_name) || cleanText(payload.offer_name) || null;
  const trafficFromPayload = cleanText(payload.traffic_source);
  const checkoutUrl = extractCheckoutUrl(row, payload);

  const normalizedStatuses = [
    normalizeStatusToken(row.status),
    normalizeStatusToken(payload.status),
    normalizeStatusToken(payload.order_status),
    normalizeStatusToken(payload.orderStatus),
    normalizeStatusToken(payload.payment_status),
    normalizeStatusToken(payload.paymentStatus),
    normalizeStatusToken(row.last_event),
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
  const lastReminderAt =
    pickTimestamp(
      row.sent_at,
      row.last_reminder_at,
      payload.sent_at,
      payload.sentAt,
      payload.last_reminder_at,
      payload.lastReminderAt,
    ) ?? null;

  const status = resolveDashboardStatus({
    normalizedStatuses,
    paid,
    paidAt,
    createdAt,
    lastReminderAt,
  });

  return {
    id: String(row.id),
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
    last_reminder_at: lastReminderAt,
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

export async function fetchApprovedSales(): Promise<Sale[]> {
  noStore();

  try {
    const rows = await fetchSalesRows();

    const mappedRows = rows
      .map((row) => {
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

        const status: Sale['status'] = hasRefund ? 'refunded' : 'converted';
        const paidAt = extractPaidAt(row, payload);
        const customerPhone = extractPhone(row, payload);

        return {
          id: String(row.id),
          customer_email: cleanText(row.customer_email) || cleanText(row.email) || '',
          customer_name: cleanText(row.customer_name) || null,
          customer_phone: customerPhone,
          product_name:
            cleanText(row.product_name) || cleanText(row.product_title) || productFromPayload || null,
          product_id: cleanText(row.product_id) || null,
          status,
          paid_at: paidAt ?? null,
          traffic_source: cleanText(row.traffic_source) || trafficFromPayload || null,
          source: cleanText(row.source) || null,
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
