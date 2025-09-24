import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from './supabaseAdmin';
import type { Sale } from './types';

const IGNORED_TEXT_VALUES = new Set([
  '',
  '-',
  '—',
  'unknown',
  'desconhecido',
  'desconhecida',
  'sem origem',
  'sem origem definida',
  'nao informado',
  'não informado',
  'não informado',
]);

const clean = (value: unknown) => {
  if (typeof value !== 'string') {
    return '';
  }

  const text = value.trim();
  if (!text) {
    return '';
  }

  const normalized = text.normalize('NFC').toLowerCase();
  return IGNORED_TEXT_VALUES.has(normalized) ? '' : text;
};

const TRUE_TOKENS = new Set(['true', 't', '1', 'yes', 'y', 'sim', 's']);
const FALSE_TOKENS = new Set(['false', 'f', '0', 'no', 'n', 'nao', 'não', 'não']);

const coerceBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'bigint') {
    return value !== BigInt(0);
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (TRUE_TOKENS.has(normalized)) {
      return true;
    }
    if (FALSE_TOKENS.has(normalized)) {
      return false;
    }
  }

  return false;
};

const APPROVED_STATUS_TOKENS = new Set([
  'converted',
  'convertido',
  'paid',
  'pago',
  'paga',
  'pagamento aprovado',
  'payment.approved',
  'payment_approved',
  'pagamento.aprovado',
  'approved',
  'aprovado',
  'aprovada',
  'approved_pending_settlement',
  'completed',
  'complete',
  'concluido',
  'concluído',
]);

const normalizeStatus = (value: unknown): string => {
  const text = clean(value);
  return text ? text.toLowerCase() : '';
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

    const text = clean(candidate);
    if (text) {
      return text;
    }
  }

  return row.paid_at ?? null;
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

    const filteredRows = rows.filter((row) => {
      const payload = (row?.payload ?? {}) as Record<string, unknown>;
      const paid = coerceBoolean(row.paid);
      if (paid) {
        return true;
      }

      const statuses = [
        normalizeStatus(row.status),
        normalizeStatus(payload.status),
        normalizeStatus(payload.order_status),
        normalizeStatus(payload.orderStatus),
        normalizeStatus(payload.payment_status),
        normalizeStatus(payload.paymentStatus),
        normalizeStatus(row.last_event),
      ].filter(Boolean);

      return statuses.some((status) => APPROVED_STATUS_TOKENS.has(status));
    });

    return filteredRows.map((row) => {
      const payload = (row?.payload ?? {}) as Record<string, unknown>;
      const productFromPayload = clean(payload.product_name) || clean(payload.offer_name);
      const trafficFromPayload = clean(payload.traffic_source);
      const statusFromRow = clean(row.status);
      const statusFromPayload =
        clean(payload.status) ||
        clean(payload.order_status) ||
        clean(payload.orderStatus) ||
        clean(payload.payment_status) ||
        clean(payload.paymentStatus);
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
      const statusIndicatesPaid = APPROVED_STATUS_TOKENS.has(normalizeStatus(statusFromPayload));
      const paid = coerceBoolean(row.paid) || paidFromPayload || statusIndicatesPaid;
      const paidAt = extractPaidAt(row, payload);

      return {
        id: String(row.id),
        customer_email: clean(row.customer_email) || clean(row.email) || '',
        customer_name: clean(row.customer_name) || null,
        product_name:
          clean(row.product_name) || clean(row.product_title) || productFromPayload || null,
        product_id: clean(row.product_id) || null,
        status: statusFromRow || statusFromPayload || (paid ? 'converted' : null),
        paid_at: paidAt ?? null,
        traffic_source: clean(row.traffic_source) || trafficFromPayload || null,
        source: clean(row.source) || null,
      } satisfies Sale;
    });
  } catch (error) {
    console.error('[kiwify-hub] supabase indisponível ao buscar vendas aprovadas', error);
    return [];
  }
}
