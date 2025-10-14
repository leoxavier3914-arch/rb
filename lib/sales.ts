import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from './supabaseAdmin';
import type { Sale } from './types';
import {
  APPROVED_STATUS_TOKENS,
  REFUNDED_STATUS_TOKENS,
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

const buildSaleKey = (sale: Sale) => {
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

export async function fetchApprovedSales(): Promise<Sale[]> {
  noStore();

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('abandoned_emails')
      .select('*')
      .order('paid_at', { ascending: false });

    if (error) {
      console.error('[kiwify-hub] erro ao consultar vendas aprovadas', error);
      return [];
    }

    const rows = (data ?? []) as Record<string, any>[];

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

    return Array.from(deduped.values());
  } catch (error) {
    console.error('[kiwify-hub] supabase indisponível ao buscar vendas aprovadas', error);
    return [];
  }
}
