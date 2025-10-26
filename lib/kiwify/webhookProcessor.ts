import type { SupabaseClient } from '@supabase/supabase-js';
import {
  mapCouponPayload,
  mapCustomerPayload,
  mapCustomerFromSalePayload,
  mapEnrollmentPayload,
  mapPayoutPayload,
  mapProductPayload,
  mapRefundPayload,
  mapSalePayload,
  mapSubscriptionPayload,
  type CustomerRow,
  type ProductRow,
  type SaleRow
} from './mappers';
import {
  upsertCoupons,
  upsertCustomers,
  upsertCustomer,
  upsertEnrollments,
  upsertPayouts,
  upsertProducts,
  upsertRefunds,
  upsertSales,
  upsertSubscriptions
} from './writes';

interface ProcessResult {
  readonly metricsChanged: boolean;
}

interface SaleState {
  readonly status: string | null;
  readonly paid_at: string | null;
}

const METRIC_STATUSES = new Set(['approved', 'paid', 'refunded', 'rejected', 'canceled']);

export async function processKiwifyEvent(
  client: SupabaseClient,
  eventType: string,
  payload: Record<string, unknown>,
  rawPayload: unknown
): Promise<ProcessResult> {
  const normalizedType = eventType.toLowerCase();

  if (normalizedType.includes('sale')) {
    return handleSaleEvent(client, payload, rawPayload);
  }

  if (normalizedType.includes('product')) {
    const row = mapProductPayload(payload);
    await upsertProducts([row]);
    await snapshotEntity(client, 'product', row.id, row);
    return { metricsChanged: false };
  }

  if (normalizedType.includes('customer')) {
    const row = mapCustomerPayload(payload);
    await upsertCustomers([row]);
    if (row.id) {
      await snapshotEntity(client, 'customer', row.id, row);
    }
    return { metricsChanged: false };
  }

  if (normalizedType.includes('subscription')) {
    const row = mapSubscriptionPayload(payload);
    await upsertSubscriptions([row]);
    return { metricsChanged: false };
  }

  if (normalizedType.includes('enrollment')) {
    const row = mapEnrollmentPayload(payload);
    await upsertEnrollments([row]);
    return { metricsChanged: false };
  }

  if (normalizedType.includes('coupon')) {
    const row = mapCouponPayload(payload);
    await upsertCoupons([row]);
    return { metricsChanged: false };
  }

  if (normalizedType.includes('refund')) {
    const row = mapRefundPayload(payload);
    await upsertRefunds([row]);
    return { metricsChanged: true };
  }

  if (normalizedType.includes('payout')) {
    const row = mapPayoutPayload(payload);
    await upsertPayouts([row]);
    return { metricsChanged: false };
  }

  return { metricsChanged: false };
}

async function handleSaleEvent(
  client: SupabaseClient,
  payload: Record<string, unknown>,
  rawPayload: unknown
): Promise<ProcessResult> {
  const row = mapSalePayload(payload);
  if (!row.id) {
    throw new Error('ID da venda ausente no payload do webhook.');
  }

  const customerRow = mapCustomerFromSalePayload(payload, {
    onInvalidCustomerId: (rawId) => {
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'customer_missing_id',
          source: 'webhook',
          sale_id: row.id,
          customer_id: rawId ?? null
        })
      );
    }
  });
  if (customerRow) {
    await upsertCustomer(customerRow);
  }

  const previous = await loadSaleState(client, row.id);
  await upsertSales([row]);

  const statusChanged = normalizeStatus(previous?.status) !== normalizeStatus(row.status);
  const paidChanged = normalizeDate(previous?.paid_at) !== normalizeDate(row.paid_at);
  const shouldSnapshot = !previous || statusChanged || paidChanged;

  if (shouldSnapshot) {
    await snapshotEntity(client, 'sale', row.id, row);
  }

  if (statusChanged) {
    await insertSaleEvent(client, row.id, row.status ?? 'unknown', rawPayload);
  }

  const metricsChanged = shouldSnapshot || statusChanged;
  return { metricsChanged: metricsChanged || paidChanged || affectsMetrics(previous?.status, row.status) };
}

async function loadSaleState(client: SupabaseClient, saleId: string): Promise<SaleState | null> {
  const { data, error } = await client
    .from('kfy_sales')
    .select('status, paid_at')
    .eq('id', saleId)
    .limit(1);

  if (error) {
    throw new Error(`Falha ao carregar status anterior da venda ${saleId}: ${error.message ?? 'erro desconhecido'}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  const row = data[0] as Partial<SaleState>;
  return {
    status: typeof row.status === 'string' ? row.status : null,
    paid_at: typeof row.paid_at === 'string' ? row.paid_at : null
  };
}

async function insertSaleEvent(
  client: SupabaseClient,
  saleId: string,
  status: string,
  rawPayload: unknown
): Promise<void> {
  const { error } = await client.from('kfy_sale_events').insert({
    sale_id: saleId,
    type: status,
    at: new Date().toISOString(),
    meta: rawPayload ?? null
  });

  if (error) {
    throw new Error(`Falha ao registrar evento de venda ${saleId}: ${error.message ?? 'erro desconhecido'}`);
  }
}

async function snapshotEntity(
  client: SupabaseClient,
  entityType: string,
  entityId: string,
  data: ProductRow | CustomerRow | SaleRow
): Promise<void> {
  const nextVersion = await resolveNextVersion(client, entityType, entityId);
  const { error } = await client.from('entity_versions').insert({
    entity_type: entityType,
    entity_id: entityId,
    version: nextVersion,
    data,
    changed_at: new Date().toISOString()
  });

  if (error) {
    throw new Error(`Falha ao registrar versão de ${entityType} ${entityId}: ${error.message ?? 'erro desconhecido'}`);
  }
}

async function resolveNextVersion(
  client: SupabaseClient,
  entityType: string,
  entityId: string
): Promise<number> {
  const { data, error } = await client
    .from('entity_versions')
    .select('version')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('version', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Falha ao obter versão atual de ${entityType} ${entityId}: ${error.message ?? 'erro desconhecido'}`);
  }

  const current = data && data.length > 0 ? Number(data[0]?.version) : 0;
  return Number.isFinite(current) ? current + 1 : 1;
}

function normalizeStatus(status: string | null | undefined): string | null {
  if (!status) {
    return null;
  }
  return status.toLowerCase();
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp).toISOString();
}

function affectsMetrics(previous: string | null | undefined, next: string | null | undefined): boolean {
  const prev = normalizeStatus(previous);
  const nxt = normalizeStatus(next);
  if (prev === nxt) {
    return false;
  }
  return METRIC_STATUSES.has(prev ?? '') || METRIC_STATUSES.has(nxt ?? '');
}
