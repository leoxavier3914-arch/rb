import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from './supabaseAdmin';
import type { DashboardSale, DashboardSaleStatus, Sale } from './types';
import {
  APPROVED_STATUS_TOKENS,
  ABANDONED_STATUS_TOKENS,
  PENDING_STATUS_TOKENS,
  REFUNDED_STATUS_TOKENS,
  REFUSED_STATUS_TOKENS,
  SENT_STATUS_TOKENS,
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

const parseTime = (value: string | null | undefined) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
};

const ONE_HOUR_IN_MS = 60 * 60 * 1000;
const CONVERSION_FOLLOW_UP_MINIMUM_DELAY_MS = ONE_HOUR_IN_MS;

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
  tableNormalizedStatuses: string[];
  paid: boolean;
  paidAt: string | null;
  createdAt: string | null;
  lastReminderAt: string | null;
};

const evaluateReminderTiming = (paidAt: string | null, lastReminderAt: string | null) => {
  const paidTime = parseTime(paidAt);
  const reminderTime = parseTime(lastReminderAt);

  if (reminderTime === Number.NEGATIVE_INFINITY) {
    return {
      hasReminderTime: false,
      reminderValidForConversion: false,
      reminderValidForDisplay: false,
    };
  }

  if (paidTime === Number.NEGATIVE_INFINITY) {
    return {
      hasReminderTime: true,
      reminderValidForConversion: false,
      reminderValidForDisplay: true,
    };
  }

  if (!Number.isFinite(paidTime) || paidTime < reminderTime) {
    return {
      hasReminderTime: true,
      reminderValidForConversion: false,
      reminderValidForDisplay: false,
    };
  }

  const delay = paidTime - reminderTime;
  const meetsDelay = delay >= CONVERSION_FOLLOW_UP_MINIMUM_DELAY_MS;

  return {
    hasReminderTime: true,
    reminderValidForConversion: meetsDelay,
    reminderValidForDisplay: meetsDelay,
  };
};

const resolveDashboardStatus = ({
  normalizedStatuses,
  tableNormalizedStatuses,
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

  if (paid) {
    return 'approved';
  }

  const hasAbandonedStatus = normalizedStatuses.some((status) => ABANDONED_STATUS_TOKENS.has(status));
  if (hasAbandonedStatus) {
    return 'abandoned';
  }

  const createdTime = parseTime(createdAt);
  if (createdTime === Number.NEGATIVE_INFINITY) {
    const hasNewStatus = normalizedStatuses.some((status) => NEW_STATUS_TOKENS.has(status));
    const hasPendingStatus = normalizedStatuses.some((status) => PENDING_STATUS_TOKENS.has(status));
    if (hasPendingStatus && !hasNewStatus) {
      return 'abandoned';
    }
    return 'new';
  }

  const now = Date.now();
  if (now - createdTime >= ONE_HOUR_IN_MS) {
    return 'abandoned';
  }

  return 'new';
};

const mapRowToDashboardSale = (row: Record<string, any>): DashboardSale => {
  const payload = (row?.payload ?? {}) as Record<string, any>;
  const productFromPayload = cleanText(payload.product_name) || cleanText(payload.offer_name) || null;
  const trafficFromPayload = cleanText(payload.traffic_source);
  const checkoutUrl = extractCheckoutUrl(row, payload);

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

  const status = resolveDashboardStatus({
    normalizedStatuses,
    tableNormalizedStatuses,
    paid,
    paidAt,
    createdAt,
    lastReminderAt,
  });

  const { hasReminderTime, reminderValidForDisplay } = evaluateReminderTiming(paidAt, lastReminderAt);
  const hasFollowUpStatus = normalizedStatuses.some((status) => SENT_STATUS_TOKENS.has(status));
  const emailFollowUp = reminderValidForDisplay || (!hasReminderTime && hasFollowUpStatus);

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
    email_follow_up: emailFollowUp,
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

        const status: Sale['status'] = hasRefund ? 'refunded' : 'approved';
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

export const __testables = {
  mapRowToDashboardSale,
};
